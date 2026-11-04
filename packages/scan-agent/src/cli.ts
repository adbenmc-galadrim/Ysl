import { execFile, spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { parseArgs, promisify } from 'node:util';
import { agentEnv, MAX_TURNS, MODEL, runAgent, TIMEOUT_MIN } from '#agent';
import { type Deps, type Exec, handleReport } from '#run';

const REPO = resolve(import.meta.dirname, '../../..');
const GITHUB = 'adbenmc-galadrim/Ysl';

const USAGE = `Usage : pnpm reports:pull --watch --on-report 'pnpm -w reports:agent [options]'
        pnpm reports:agent [--no-pr] [--max-turns <n>] [--timeout-min <n>]
                          [--corpus <dossier>] [--private <dossier>] [--id <id>] [--dir <dossier>]
Accroche de pnpm reports:pull --on-report : un agent ${MODEL} par rapport, dans un
worktree depuis origin/main, puis une PR draft si rien ne fuit et rien ne recule.
Le rapport vient de SCAN_REPORT_ID et SCAN_REPORT_DIR (ou --id, --dir).
--no-pr      s'arrête avant le push : ni PR ni versement au corpus privé (démo)
--max-turns  tours de l'agent (défaut ${MAX_TURNS}) ; --timeout-min durée (défaut ${TIMEOUT_MIN} min)
--corpus     sortie du générateur (défaut ../tmp/corpus à côté du dépôt)
--private    corpus privé des vraies photos (défaut <corpus>/real)`;

const run = promisify(execFile);

/** The hook's own git and gh: with Adam's credentials, never handed to the agent. */
const hookEnv = () => {
  const env = { ...process.env };
  delete env.SCAN_REPORTS_KEY;
  return env;
};

const git: Deps['git'] = async (cwd, args) =>
  (
    await run('git', args, {
      cwd,
      env: hookEnv(),
      maxBuffer: 256 * 1024 * 1024,
    })
  ).stdout;

const quote = (path: string) =>
  `"${path.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;

/** macOS sandbox for the agent's code run by the hook (gates, bench). */
const profile = (writable: string[]) =>
  [
    '(version 1)',
    '(allow default)',
    '(deny network-outbound (remote ip))',
    `(deny file-write* (subpath ${quote(homedir())}))`,
    `(allow file-write* ${writable.map((dir) => `(subpath ${quote(dir)})`).join(' ')})`,
  ].join('\n');

const exec =
  (env: (workDir: string) => NodeJS.ProcessEnv): Exec =>
  async (command, args, { cwd, log, timeoutMs, sandbox }) => {
    let spawned: [string, string[]] = [command, args];
    if (sandbox) {
      const file = `${log}.sb`;
      await writeFile(file, `${profile(sandbox)}\n`);
      spawned = ['sandbox-exec', ['-f', file, command, ...args]];
    }
    return new Promise((done, fail) => {
      const out = createWriteStream(log);
      const child = spawn(...spawned, {
        cwd,
        env: env(dirname(log)),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.pipe(out);
      child.stderr.pipe(out);
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 10_000).unref();
      }, timeoutMs);
      child.once('error', fail);
      child.once('close', (code) => {
        clearTimeout(timer);
        done(code ?? 1);
      });
    });
  };

const forge: Deps['forge'] = {
  openPullRequest: async (branch) => {
    const { stdout } = await run(
      'gh',
      [
        'pr',
        'list',
        '--repo',
        GITHUB,
        '--head',
        branch,
        '--state',
        'open',
        '--json',
        'number',
        '--jq',
        '.[0].number // empty',
      ],
      { env: hookEnv() },
    );
    return stdout.trim() ? Number(stdout.trim()) : null;
  },
  branchExists: async (branch) => {
    const remote = await git(REPO, ['ls-remote', '--heads', 'origin', branch]);
    if (remote.trim()) return true;
    return git(REPO, [
      'rev-parse',
      '--verify',
      '--quiet',
      `refs/heads/${branch}`,
    ]).then(
      () => true,
      () => false,
    );
  },
  createDraft: async ({ cwd, branch, title, bodyFile }) => {
    const { stdout } = await run(
      'gh',
      [
        'pr',
        'create',
        '--repo',
        GITHUB,
        '--draft',
        '--base',
        'main',
        '--head',
        branch,
        '--title',
        title,
        '--body-file',
        bodyFile,
      ],
      { cwd, env: hookEnv() },
    );
    const number = /\/pull\/(\d+)/.exec(stdout)?.[1];
    if (!number)
      throw new Error(`PR créée sans numéro lisible : ${stdout.trim()}`);
    return Number(number);
  },
};

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      'no-pr': { type: 'boolean', default: false },
      'max-turns': { type: 'string' },
      'timeout-min': { type: 'string' },
      corpus: { type: 'string' },
      private: { type: 'string' },
      id: { type: 'string' },
      dir: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  const from = process.env.INIT_CWD ?? process.cwd();
  const id = values.id ?? process.env.SCAN_REPORT_ID;
  const dir = values.dir ?? process.env.SCAN_REPORT_DIR;
  if (!id || !dir) {
    console.error(
      `Rapport inconnu : SCAN_REPORT_ID et SCAN_REPORT_DIR absents.\n\n${USAGE}`,
    );
    return 1;
  }
  if (process.env.SCAN_REPORTS_KEY) {
    console.log(
      'SCAN_REPORTS_KEY présente : retirée de tout ce que lance l’accroche.',
    );
  }
  const number = (raw: string | undefined, fallback: number) => {
    const n = raw === undefined ? fallback : Number(raw);
    if (!Number.isInteger(n) || n <= 0)
      throw new Error(`Valeur invalide : ${raw}\n\n${USAGE}`);
    return n;
  };
  const corpus = resolve(
    from,
    values.corpus ?? join(dirname(REPO), 'tmp', 'corpus'),
  );

  const outcome = await handleReport(
    {
      repo: REPO,
      reportId: id,
      reportDir: resolve(from, dir),
      corpus,
      privateCorpus: resolve(from, values.private ?? join(corpus, 'real')),
      prompt: await readFile(
        join(import.meta.dirname, '..', 'prompt.md'),
        'utf8',
      ),
      base: 'origin/main',
      maxTurns: number(values['max-turns'], MAX_TURNS),
      timeoutMs: number(values['timeout-min'], TIMEOUT_MIN) * 60_000,
      openPr: !values['no-pr'],
    },
    {
      git,
      exec: exec((workDir) => agentEnv(process.env, workDir)),
      runAgent,
      agentEnv: (workDir) => agentEnv(process.env, workDir),
      forge,
      log: (line) => console.log(line),
      now: () => new Date(),
    },
  );
  return outcome.kind === 'failed' ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  },
);
