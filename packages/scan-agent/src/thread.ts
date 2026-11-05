import { execFile, spawn } from 'node:child_process';
import { existsSync, realpathSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import { type AgentOutcome, type AgentRun, type Identity, MODEL } from '#agent';
import { threadSettings } from '#thread-settings';

export const PROVIDER = 'claudeAgent';
export const PROJECT_TITLE = 'ysl · rapports de scan';

const POLL_MS = 15_000;
/** The start hook runs within seconds: past this, the settings were not read. */
const MARKER_GRACE_MS = 3 * 60_000;

export type T3Result = { code: number; stdout: string; stderr: string };

export type ThreadDeps = {
  t3: (args: string[], input?: string) => Promise<T3Result>;
  /** Ends the Claude Code session running in the project's folder. */
  stopSession: (root: string) => Promise<number>;
  sleep: (ms: number) => Promise<unknown>;
  now: () => number;
};

export type ThreadRun = AgentRun & {
  root: string;
  title: string;
  gitDir: string;
  identity: Identity | null;
  plugins: string[];
  guard: string[];
};

const launched = z.looseObject({ threadId: z.string().min(1) });

const shown = z.looseObject({
  thread: z.looseObject({
    threadId: z.string(),
    link: z.string().nullable().optional(),
    status: z.string(),
    activeRunId: z.string().nullable().optional(),
    providerInstanceId: z.string().nullable().optional(),
    model: z.string().nullable().optional(),
    pendingRequestCount: z.number().optional(),
  }),
});

type Shown = z.infer<typeof shown>['thread'];

const json = <T>(schema: z.ZodType<T>, text: string, what: string): T => {
  try {
    return schema.parse(JSON.parse(text));
  } catch {
    throw new Error(
      `${what} : réponse de t3 illisible (${text.slice(0, 200)})`,
    );
  }
};

export const threadTitle = (reportId: string) =>
  `Rapport de scan ${reportId.slice(0, 8)}`;

/** Added once; afterwards t3 says it exists, which is as good. */
async function ensureProject(root: string, deps: ThreadDeps) {
  await mkdir(join(root, '.claude'), { recursive: true });
  const added = await deps.t3([
    'project',
    'add',
    '--title',
    PROJECT_TITLE,
    root,
  ]);
  const said = `${added.stderr}\n${added.stdout}`;
  if (added.code !== 0 && !said.includes('ProjectAlreadyExistsError')) {
    throw new Error(
      `projet T3 ${root} introuvable : ${said.trim().slice(0, 300)}`,
    );
  }
}

/**
 * The agent in a T3 thread of its own project, whose folder carries the
 * settings that shut it in. The thread runs at that folder: the worktree
 * sits under it, and the prompt sends every command there.
 */
export async function runThread(
  run: ThreadRun,
  deps: ThreadDeps,
): Promise<AgentOutcome> {
  const settingsFile = join(run.root, '.claude', 'settings.json');
  const marker = join(run.workDir, 'fil-isole');
  await ensureProject(run.root, deps);
  const settings = `${JSON.stringify(
    threadSettings(
      {
        root: run.root,
        worktree: run.cwd,
        work: run.workDir,
        gitDir: run.gitDir,
        marker,
        guard: run.guard,
      },
      run.identity,
      run.plugins,
    ),
    null,
    2,
  )}\n`;
  await writeFile(settingsFile, settings);
  await rm(marker, { force: true });

  const started = await deps.t3(
    [
      'thread',
      'start',
      '--provider',
      PROVIDER,
      '--model',
      MODEL,
      '--title',
      run.title,
      '--json',
      run.root,
      '-',
    ],
    run.prompt,
  );
  if (started.code !== 0) {
    throw new Error(
      `fil T3 non lancé : ${`${started.stderr}\n${started.stdout}`.trim().slice(0, 300)}`,
    );
  }
  const { threadId } = json(launched, started.stdout, 'fil T3');
  const outcome: AgentOutcome = {
    code: null,
    model: null,
    result: null,
    timedOut: false,
    wrongModel: false,
    thread: { id: threadId, link: null },
  };
  run.onThread?.(outcome.thread!);

  const begin = deps.now();
  const stop = async (reason: string) => {
    const killed = await deps.stopSession(run.root);
    outcome.stopped = `${reason} (fil arrêté${killed === 0 ? ' : aucune session trouvée, à arrêter dans T3' : ''})`;
    return outcome;
  };
  let checked = false;
  for (;;) {
    const shownRaw = await deps.t3([
      'thread',
      'show',
      threadId,
      '--json',
      '--messages',
      '1',
    ]);
    if (shownRaw.code !== 0) {
      throw new Error(
        `fil T3 ${threadId} illisible : ${`${shownRaw.stderr}\n${shownRaw.stdout}`.trim().slice(0, 300)}`,
      );
    }
    const thread: Shown = json(
      shown,
      shownRaw.stdout,
      `fil T3 ${threadId}`,
    ).thread;
    if (thread.link && !outcome.thread!.link) {
      outcome.thread!.link = thread.link;
      run.onThread?.(outcome.thread!);
    }
    if (!checked) {
      outcome.model = thread.model ?? null;
      if (thread.providerInstanceId !== PROVIDER || thread.model !== MODEL) {
        outcome.wrongModel = true;
        await stop(
          `fil sur ${thread.providerInstanceId ?? '?'}/${thread.model ?? '?'}`,
        );
        return outcome;
      }
      checked = true;
    }
    const running = thread.status === 'running' || Boolean(thread.activeRunId);
    const elapsed = deps.now() - begin;
    if (!existsSync(marker) && (!running || elapsed > MARKER_GRACE_MS)) {
      return stop('réglages d’isolement du projet T3 non lus par le fil');
    }
    if ((await readFile(settingsFile, 'utf8').catch(() => '')) !== settings) {
      return stop('réglages d’isolement modifiés pendant le fil');
    }
    if ((thread.pendingRequestCount ?? 0) > 0) {
      return stop('le fil attend une réponse');
    }
    if (!running) {
      outcome.result = thread.status;
      return outcome;
    }
    if (elapsed > run.timeoutMs) {
      outcome.timedOut = true;
      return stop('délai dépassé');
    }
    await deps.sleep(POLL_MS);
  }
}

const exec = promisify(execFile);

const cwdOf = async (pid: string) => {
  const { stdout } = await exec('lsof', [
    '-a',
    '-p',
    pid,
    '-d',
    'cwd',
    '-Fn',
  ]).catch(() => ({
    stdout: '',
  }));
  return stdout
    .split('\n')
    .find((line) => line.startsWith('n'))
    ?.slice(1);
};

const real = (path: string) => (existsSync(path) ? realpathSync(path) : path);

/** The t3 CLI of the desktop app, and the end of a session by its folder. */
export function t3Deps(
  env: NodeJS.ProcessEnv,
  cli = env.T3CODE_CLI_PATH ?? join(homedir(), '.t3', 'bin', 't3'),
): ThreadDeps {
  return {
    t3: (args, input) =>
      new Promise((done, fail) => {
        const child = spawn(cli, args, {
          env,
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stdout = '';
        let stderr = '';
        child.stdout.on(
          'data',
          (chunk: Buffer) => (stdout += chunk.toString()),
        );
        child.stderr.on(
          'data',
          (chunk: Buffer) => (stderr += chunk.toString()),
        );
        child.once('error', fail);
        child.once('close', (code) =>
          done({ code: code ?? 1, stdout, stderr }),
        );
        child.stdin.end(input ?? '');
      }),
    stopSession: async (root) => {
      const { stdout } = await exec('ps', ['-axo', 'pid=,comm=']);
      const target = real(root);
      let killed = 0;
      for (const line of stdout.split('\n')) {
        const [pid, comm] = line.trim().split(/\s+/, 2);
        if (!pid || !comm || !/(^|\/)claude$/.test(comm)) continue;
        const cwd = await cwdOf(pid);
        if (!cwd || real(cwd) !== target) continue;
        try {
          process.kill(Number(pid), 'SIGTERM');
          killed += 1;
        } catch {
          continue;
        }
      }
      return killed;
    },
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => Date.now(),
  };
}
