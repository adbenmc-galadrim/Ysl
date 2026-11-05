import { describe, expect, it } from 'vitest';
import { threadSettings } from '#thread-settings';

const paths = {
  root: '/fils',
  worktree: '/fils/ysl-scan-etiquette-x',
  work: '/rapports/r/agent',
  gitDir: '/ysl/.git',
  marker: '/rapports/r/agent/fil-isole',
  guard: ['/bin/node', "/ysl/garde d'écriture.ts"],
};
const settings = threadSettings(
  paths,
  { name: 'Adam', email: 'adam@example.invalid' },
  ['ecc@ecc'],
  501,
);

describe('threadSettings', () => {
  it('keeps the PC’s keys out of every tool and of the sandbox', () => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([
        'Read(~/.ssh/**)',
        'Read(~/.config/**)',
        'Read(~/.claude/**)',
      ]),
    );
    expect(settings.sandbox.filesystem.denyRead).toEqual(
      expect.arrayContaining(['~/.ssh', '~/.config', '~/.claude']),
    );
    expect(settings.env).toMatchObject({
      SCAN_REPORTS_KEY: '',
      SSH_AUTH_SOCK: '',
      GH_TOKEN: '',
    });
  });

  it('publishes nothing: no push, no gh, no domain, no MCP, no question', () => {
    expect(settings.permissions.deny).toEqual(
      expect.arrayContaining([
        'Bash(git push*)',
        'Bash(gh *)',
        'WebFetch',
        'AskUserQuestion',
        'mcp__t3-code',
      ]),
    );
    expect(settings.sandbox).toMatchObject({
      enabled: true,
      allowUnsandboxedCommands: false,
    });
    expect(settings.sandbox.network.deniedDomains).toEqual(['*']);
    expect(settings.env).toMatchObject({
      GIT_CONFIG_VALUE_0: 'interdit://agent-sans-push',
      ENABLE_CLAUDEAI_MCP_SERVERS: 'false',
    });
    expect(settings.enabledPlugins).toEqual({ 'ecc@ecc': false });
  });

  it('leaves its own settings out of the agent’s reach', () => {
    expect(settings.permissions.deny).toContain('Edit(//fils/.claude/**)');
    expect(settings.sandbox.filesystem.denyWrite).toEqual(
      expect.arrayContaining([
        '/fils/.claude',
        '/fils/.mcp.json',
        '/fils/CLAUDE.md',
      ]),
    );
  });

  it('guards Edit and Write to the worktree and the work folder, and marks the start', () => {
    const [guard] = settings.hooks.PreToolUse;
    expect(guard?.matcher).toBe('Edit|Write|MultiEdit|NotebookEdit');
    expect(guard?.hooks[0]?.command).toBe(
      "'/bin/node' '/ysl/garde d'\\''écriture.ts' '/fils/ysl-scan-etiquette-x' '/rapports/r/agent'",
    );
    expect(settings.hooks.SessionStart[0]?.hooks[0]?.command).toBe(
      "/usr/bin/touch '/rapports/r/agent/fil-isole'",
    );
    expect(settings.sandbox.filesystem.allowWrite).toEqual([
      '/rapports/r/agent',
      '/ysl/.git',
    ]);
  });
});
