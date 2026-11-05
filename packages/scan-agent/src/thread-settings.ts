import { join } from 'node:path';
import { DENIED, gitEnv, type Identity, SECRET_PATHS } from '#agent';

export type ThreadPaths = {
  /** The dedicated T3 project's folder: the thread's working directory. */
  root: string;
  worktree: string;
  work: string;
  /** The checkout's git folder: commits write there. */
  gitDir: string;
  /** Written by the session's start hook: proof the settings were read. */
  marker: string;
  /** Runs `write-guard.ts` with node. */
  guard: string[];
};

/** Files at the root a thread would read at its start: never its to write. */
const ROOT_FILES = [
  '.claude',
  '.mcp.json',
  'CLAUDE.md',
  'CLAUDE.local.md',
  'AGENTS.md',
];

/** The MCP servers this PC declares, turned off by name. */
const MCP_SERVERS = [
  'penpot',
  'claude.ai Claude Docs',
  'claude.ai Figma',
  'plugin:ecc:chrome-devtools',
];

const shell = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

/**
 * `.claude/settings.json` of the dedicated project. T3 runs Claude Code in
 * `bypassPermissions` with the project's settings: the deny rules, the
 * sandbox and the hooks hold there, and the network is closed by
 * `deniedDomains` (in bypass, the sandbox's proxy would let any domain
 * through).
 */
export function threadSettings(
  paths: ThreadPaths,
  identity: Identity | null,
  plugins: string[],
  uid = process.getuid?.() ?? 0,
) {
  const rootFiles = ROOT_FILES.map((name) => join(paths.root, name));
  return {
    includeCoAuthoredBy: false,
    attribution: { commit: '', pr: '' },
    enabledPlugins: Object.fromEntries(plugins.map((name) => [name, false])),
    disabledMcpServers: MCP_SERVERS,
    permissions: {
      deny: [
        ...DENIED,
        ...['Edit', 'Write'].flatMap((tool) =>
          rootFiles.flatMap((file) => [
            `${tool}(/${file})`,
            `${tool}(/${file}/**)`,
          ]),
        ),
        'AskUserQuestion',
        'mcp__t3-code',
        'mcp__penpot',
        'mcp__claude_ai_Claude_Docs',
        'mcp__claude_ai_Figma',
      ],
    },
    sandbox: {
      enabled: true,
      allowUnsandboxedCommands: false,
      autoAllowBashIfSandboxed: false,
      filesystem: {
        denyRead: SECRET_PATHS,
        allowWrite: [paths.work, paths.gitDir],
        denyWrite: rootFiles,
      },
      network: {
        deniedDomains: ['*'],
        allowLocalBinding: true,
        allowUnixSockets: [`/tmp/claude-${uid}`, `/private/tmp/claude-${uid}`],
      },
    },
    hooks: {
      SessionStart: [
        {
          hooks: [
            {
              type: 'command',
              command: `/usr/bin/touch ${shell(paths.marker)}`,
            },
          ],
        },
      ],
      PreToolUse: [
        {
          matcher: 'Edit|Write|MultiEdit|NotebookEdit',
          hooks: [
            {
              type: 'command',
              command: [...paths.guard, paths.worktree, paths.work]
                .map(shell)
                .join(' '),
            },
          ],
        },
      ],
    },
    env: {
      ...gitEnv(paths.work, identity),
      ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
      SSH_AUTH_SOCK: '',
      SCAN_REPORTS_KEY: '',
      GH_TOKEN: '',
      GITHUB_TOKEN: '',
    },
  };
}
