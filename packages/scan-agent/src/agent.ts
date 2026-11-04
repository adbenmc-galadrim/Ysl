import { spawn } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { z } from 'zod';

/** Never another: Adam's usage limit is counted on this one (and never Fable). */
export const MODEL = 'claude-opus-5-5';

export const MAX_TURNS = 150;
export const TIMEOUT_MIN = 60;

const TOOLS = ['Read', 'Edit', 'Write', 'Glob', 'Grep', 'Bash'];

const ALLOWED = [
  'Read',
  'Edit',
  'Write',
  'Glob',
  'Grep',
  'Bash(pnpm *)',
  'Bash(git status*)',
  'Bash(git diff*)',
  'Bash(git log*)',
  'Bash(git show*)',
  'Bash(git add *)',
  'Bash(git commit *)',
  'Bash(git restore *)',
  'Bash(git rev-parse*)',
  'Bash(ls*)',
];

/** Where the PC keeps its keys: never read, never written. */
export const SECRET_PATHS = [
  '~/.ssh',
  '~/.config',
  '~/.gnupg',
  '~/.aws',
  '~/.claude',
  '~/.netrc',
  '~/.gitconfig',
];

/** It commits; the hook alone pushes, after its checks. */
const DENIED = [
  ...['Read', 'Edit', 'Write'].flatMap((tool) =>
    SECRET_PATHS.flatMap((path) => [`${tool}(${path})`, `${tool}(${path}/**)`]),
  ),
  'Bash(git push*)',
  'Bash(git remote*)',
  'Bash(git config*)',
  'Bash(git checkout*)',
  'Bash(git switch*)',
  'Bash(git reset*)',
  'Bash(git rebase*)',
  'Bash(git merge*)',
  'Bash(git worktree*)',
  'Bash(gh *)',
  'Bash(curl *)',
  'Bash(wget *)',
  'Bash(pnpm add*)',
  'Bash(pnpm install*)',
  'Bash(pnpm dlx*)',
  'Bash(pnpm publish*)',
  'WebFetch',
  'WebSearch',
];

/**
 * `pnpm` runs any code: its commands go through Claude Code's sandbox, no
 * network and no write outside the worktree and the work folder. Only the
 * sandbox's own temporary folder takes sockets (tsx's IPC), not Docker's.
 */
export function agentSettings(uid = process.getuid?.() ?? 0) {
  return {
    includeCoAuthoredBy: false,
    attribution: { commit: '', pr: '' },
    sandbox: {
      enabled: true,
      allowUnsandboxedCommands: false,
      autoAllowBashIfSandboxed: false,
      filesystem: { denyRead: SECRET_PATHS },
      network: {
        allowLocalBinding: true,
        allowUnixSockets: [`/tmp/claude-${uid}`, `/private/tmp/claude-${uid}`],
      },
    },
  };
}

export function agentArgs({
  workDir,
  maxTurns,
}: {
  workDir: string;
  maxTurns: number;
}): string[] {
  return [
    '-p',
    '--model',
    MODEL,
    '--output-format',
    'stream-json',
    '--verbose',
    '--max-turns',
    String(maxTurns),
    '--permission-mode',
    'dontAsk',
    '--tools',
    TOOLS.join(','),
    '--allowedTools',
    ...ALLOWED,
    '--disallowedTools',
    ...DENIED,
    '--add-dir',
    workDir,
    '--strict-mcp-config',
    '--setting-sources',
    '',
    '--no-session-persistence',
    '--settings',
    JSON.stringify(agentSettings()),
  ];
}

const SECRET = /KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH_SOCK/i;

/**
 * No key of any kind but the agent's own, and no way to publish: the push URL
 * of `origin` is unusable, `gh` has no account, ssh has no agent.
 */
export type Identity = { name: string; email: string };

/**
 * The sandboxes refuse `~/.gitconfig`: git reads no global config, and the
 * commits carry Adam's name as the hook read it.
 */
export function agentEnv(
  env: NodeJS.ProcessEnv,
  workDir: string,
  identity: Identity | null = null,
): NodeJS.ProcessEnv {
  const clean: NodeJS.ProcessEnv = {};
  for (const [name, value] of Object.entries(env)) {
    if (SECRET.test(name) && !/^(ANTHROPIC|CLAUDE)_/.test(name)) continue;
    clean[name] = value;
  }
  delete clean.SCAN_REPORTS_KEY;
  return {
    ...clean,
    GH_CONFIG_DIR: join(workDir, '.gh-vide'),
    GIT_TERMINAL_PROMPT: '0',
    GIT_CONFIG_GLOBAL: '/dev/null',
    ...(identity
      ? {
          GIT_AUTHOR_NAME: identity.name,
          GIT_AUTHOR_EMAIL: identity.email,
          GIT_COMMITTER_NAME: identity.name,
          GIT_COMMITTER_EMAIL: identity.email,
        }
      : {}),
    GIT_CONFIG_COUNT: '2',
    GIT_CONFIG_KEY_0: 'remote.origin.pushurl',
    GIT_CONFIG_VALUE_0: 'interdit://agent-sans-push',
    GIT_CONFIG_KEY_1: 'credential.helper',
    GIT_CONFIG_VALUE_1: '',
  };
}

export type AgentRun = {
  prompt: string;
  cwd: string;
  workDir: string;
  env: NodeJS.ProcessEnv;
  maxTurns: number;
  timeoutMs: number;
};

export type AgentOutcome = {
  code: number | null;
  model: string | null;
  /** The `subtype` of the last `result` message: `success`, `error_max_turns`… */
  result: string | null;
  timedOut: boolean;
  /** Killed because the session did not run on `MODEL`. */
  wrongModel: boolean;
};

const streamLine = z.looseObject({
  type: z.string(),
  subtype: z.string().optional(),
  model: z.string().optional(),
});

/** The stream goes whole to `claude.jsonl` in the work folder, out of the repository. */
export function runAgent(run: AgentRun): Promise<AgentOutcome> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'claude',
      agentArgs({ workDir: run.workDir, maxTurns: run.maxTurns }),
      { cwd: run.cwd, env: run.env, stdio: ['pipe', 'pipe', 'pipe'] },
    );
    const out = createWriteStream(join(run.workDir, 'claude.jsonl'));
    child.stderr.pipe(createWriteStream(join(run.workDir, 'claude.err')));
    const outcome: AgentOutcome = {
      code: null,
      model: null,
      result: null,
      timedOut: false,
      wrongModel: false,
    };
    const stop = () => {
      child.kill('SIGTERM');
      setTimeout(() => child.kill('SIGKILL'), 10_000).unref();
    };
    const timer = setTimeout(() => {
      outcome.timedOut = true;
      stop();
    }, run.timeoutMs);
    createInterface({ input: child.stdout }).on('line', (line) => {
      out.write(`${line}\n`);
      let parsed: z.infer<typeof streamLine>;
      try {
        parsed = streamLine.parse(JSON.parse(line));
      } catch {
        return;
      }
      if (parsed.type === 'system' && parsed.subtype === 'init') {
        outcome.model = parsed.model ?? null;
        if (outcome.model !== MODEL) {
          outcome.wrongModel = true;
          stop();
        }
      }
      if (parsed.type === 'result') outcome.result = parsed.subtype ?? null;
    });
    child.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code) => {
      clearTimeout(timer);
      out.end();
      resolve({ ...outcome, code });
    });
    child.stdin.end(run.prompt);
  });
}

export const agentResultSchema = z.object({
  statut: z.enum(['corrige', 'echec']),
  nature: z.enum(['code-barres', 'ocr', 'autre']),
  titre: z.string().min(1).max(72),
  resume: z.string().min(1).max(4000),
  raison: z.string().max(4000).optional(),
});

export type AgentResult = z.infer<typeof agentResultSchema>;
