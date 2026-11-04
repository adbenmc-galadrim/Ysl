import { describe, expect, it } from 'vitest';
import { agentArgs, agentEnv, MODEL } from '#agent';

describe('agentArgs', () => {
  const args = agentArgs({ workDir: '/travail', maxTurns: 40 });
  const after = (flag: string) => args[args.indexOf(flag) + 1];

  it('runs Opus 5.5, bounded, asking nobody', () => {
    expect(MODEL).toBe('claude-opus-5-5');
    expect(after('--model')).toBe('claude-opus-5-5');
    expect(after('--max-turns')).toBe('40');
    expect(after('--permission-mode')).toBe('dontAsk');
    expect(after('--add-dir')).toBe('/travail');
    expect(args).toContain('--strict-mcp-config');
    expect(args.join(' ')).not.toMatch(/fable|sonnet|haiku/i);
  });

  it('may commit, never push, call gh nor reach the web', () => {
    const allowed = args.slice(
      args.indexOf('--allowedTools') + 1,
      args.indexOf('--disallowedTools'),
    );
    const denied = args.slice(
      args.indexOf('--disallowedTools') + 1,
      args.indexOf('--add-dir'),
    );
    expect(allowed).toContain('Bash(git commit *)');
    expect(allowed.join()).not.toMatch(/push|gh |curl/);
    expect(denied).toEqual(
      expect.arrayContaining([
        'Bash(git push*)',
        'Bash(gh *)',
        'WebFetch',
        'WebSearch',
      ]),
    );
    expect(JSON.parse(after('--settings') ?? '{}')).toMatchObject({
      includeCoAuthoredBy: false,
    });
  });
});

describe('agentEnv', () => {
  const env = agentEnv(
    {
      PATH: '/usr/bin',
      HOME: '/home/test',
      SCAN_REPORTS_KEY: 'cle-de-test',
      GH_TOKEN: 'jeton',
      GITHUB_TOKEN: 'jeton',
      COOLIFY_API_TOKEN: 'jeton',
      SSH_AUTH_SOCK: '/tmp/agent.sock',
      ANTHROPIC_API_KEY: 'cle-agent',
    },
    '/travail',
  );

  it('hands the agent no key but its own', () => {
    expect(env.SCAN_REPORTS_KEY).toBeUndefined();
    expect(env.GH_TOKEN).toBeUndefined();
    expect(env.GITHUB_TOKEN).toBeUndefined();
    expect(env.COOLIFY_API_TOKEN).toBeUndefined();
    expect(env.SSH_AUTH_SOCK).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBe('cle-agent');
    expect(env.PATH).toBe('/usr/bin');
  });

  it('leaves git and gh unable to publish', () => {
    expect(env).toMatchObject({
      GH_CONFIG_DIR: '/travail/.gh-vide',
      GIT_CONFIG_KEY_0: 'remote.origin.pushurl',
      GIT_CONFIG_VALUE_0: 'interdit://agent-sans-push',
      GIT_CONFIG_KEY_1: 'credential.helper',
      GIT_CONFIG_VALUE_1: '',
    });
  });
});
