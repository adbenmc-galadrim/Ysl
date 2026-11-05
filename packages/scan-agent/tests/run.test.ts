import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { type AgentOutcome, MODEL } from '#agent';
import { type BenchResults } from '#compare';
import { neutralId, saveRegistry } from '#groups';
import { sha256 } from '#report';
import { type Config, type Deps, handleReport } from '#run';
import { v1Report } from './fixture';

const ID = '0b5e1c3a-7d2f-4e8b-9a61-2f4c8d0e6b17';
const LABEL = `rapport-${neutralId(ID)}`;
const BRANCH = `fix/scan-etiquette-${neutralId(ID)}`;
const IMAGE = Buffer.from('fausse image jpeg');
const BASE = 'b'.repeat(40);
const NAME = 'Camille Fictive-Exemple';

const existing = {
  id: 'real-img-0001',
  source: 'real',
  file: 'IMG_0001.jpg',
  carrier: 'ups',
  tracking: null,
  recipient: null,
  sender: null,
  pieces: null,
  weightKg: null,
  difficulties: [],
  reviewed: true,
};

const added = {
  ...existing,
  id: LABEL,
  file: `${LABEL}.jpg`,
  recipient: NAME,
  weightKg: 4.7,
  reviewed: false,
};

const bench = (weight: string): BenchResults => ({
  results: ['first', 'thorough'].flatMap((policy) => [
    {
      id: existing.id,
      policy,
      fields: [{ field: 'tracking', status: 'sure-ok' }],
    },
    { id: LABEL, policy, fields: [{ field: 'weightKg', status: weight }] },
  ]),
});

type World = {
  config: Config;
  deps: Deps;
  calls: string[];
  lines: string[];
  diff: { numstat: string; patch: string };
  after: BenchResults;
  agent: Partial<AgentOutcome>;
  result: Record<string, unknown>;
  openPr: number | null;
  duringAgent: () => Promise<void>;
  gitConfig: string;
  remoteHeads: string;
};

let world: World;

beforeEach(async () => {
  const root = await mkdtemp(join(tmpdir(), 'scan-agent-run-'));
  const reportDir = join(root, 'ysl', 'tmp', 'rapports-scan', ID);
  const privateCorpus = join(root, 'corpus', 'real');
  await mkdir(reportDir, { recursive: true });
  await mkdir(privateCorpus, { recursive: true });
  await writeFile(
    join(reportDir, 'rapport.json'),
    JSON.stringify({
      id: ID,
      imageType: 'image/jpeg',
      imageSha256: sha256(IMAGE),
      comment: 'poids faux',
      report: v1Report({ recipient: NAME, tracking: 'XY111222333FR' }),
    }),
  );
  await writeFile(join(reportDir, 'image.jpg'), IMAGE);
  await writeFile(
    join(privateCorpus, 'annotations.json'),
    JSON.stringify([existing]),
  );
  await writeFile(join(privateCorpus, 'IMG_0001.jpg'), 'photo');
  await mkdir(join(root, 'git', 'hooks'), { recursive: true });
  await writeFile(join(root, 'git', 'config'), '[core]\n');

  const calls: string[] = [];
  const lines: string[] = [];
  world = {
    calls,
    lines,
    diff: {
      numstat: '3\t1\tpackages/contract/src/codes/maxicode.ts\n',
      patch:
        '+++ b/packages/contract/src/codes/maxicode.ts\n+export const LB_TO_KG = 0.4536;\n',
    },
    after: bench('sure-ok'),
    agent: {},
    result: {
      statut: 'corrige',
      nature: 'code-barres',
      titre: 'fix: poids du MaxiCode en livres',
      resume: 'Le poids du MaxiCode est en livres : converti en kilogrammes.',
    },
    openPr: null,
    duringAgent: () => Promise.resolve(),
    remoteHeads: '',
    gitConfig:
      'file:.git/config\tremote.origin.url=git@github.com:adbenmc-galadrim/Ysl.git\n',
    config: {
      repo: join(root, 'ysl'),
      worktrees: join(root, 'fils'),
      reportId: ID,
      reportDir,
      corpus: join(root, 'corpus'),
      privateCorpus,
      prompt:
        'Rapport {{REPORT_ID}} dans {{WORK_DIR}}, étiquette {{LABEL_ID}}.',
      base: 'origin/main',
      maxTurns: 10,
      timeoutMs: 60_000,
      openPr: true,
    },
    deps: {
      git: async (_cwd, args) => {
        calls.push(`git ${args.join(' ')}`);
        const [command, sub] = args;
        if (args.includes('--git-common-dir')) return `${join(root, 'git')}\n`;
        if (command === 'config') return world.gitConfig;
        if (args.includes('--git-dir'))
          return `${join(root, 'git', 'worktrees', 'x')}\n`;
        if (command === 'rev-parse') return `${BASE}\n`;
        if (command === 'worktree' && sub === 'add') {
          await mkdir(args.at(-2)!, { recursive: true });
        }
        if (command === 'rev-list') return 'c0ffee\n';
        if (command === 'ls-remote') return world.remoteHeads;
        if (command === 'diff' && sub === '--numstat')
          return world.diff.numstat;
        if (command === 'diff') return world.diff.patch;
        if (command === 'log') return 'fix: poids du MaxiCode en livres\n';
        if (command === 'grep') throw new Error('absent de la base');
        return '';
      },
      exec: async (command, args, { sandbox }) => {
        if (args.includes('turbo'))
          calls.push(`turbo ${args.slice(5).join(' ')}`);
        calls.push(
          `${command} ${args.slice(0, 3).join(' ')}${sandbox ? ' [bac à sable]' : ''}`,
        );
        const out = args[args.indexOf('--out') + 1];
        if (args.includes('measure') && out) {
          await mkdir(out, { recursive: true });
          const results = out.endsWith('banc-avant')
            ? bench('sure-wrong')
            : world.after;
          await writeFile(join(out, 'results.json'), JSON.stringify(results));
        }
        return 0;
      },
      runAgent: async (run) => {
        calls.push(`agent ${run.prompt}`);
        run.onThread?.({ id: 'mcp:fil-1', link: null });
        await world.duringAgent();
        const corpus = join(run.workDir, 'corpus-real', 'annotations.json');
        const labels = JSON.parse(await readFile(corpus, 'utf8')) as unknown[];
        await writeFile(corpus, JSON.stringify([...labels, added]));
        await writeFile(
          join(run.workDir, 'resultat.json'),
          JSON.stringify(world.result),
        );
        return {
          code: 0,
          model: MODEL,
          result: 'success',
          timedOut: false,
          wrongModel: false,
          thread: { id: 'mcp:fil-1', link: '<t3-thread://v2/env/mcp:fil-1>' },
          ...world.agent,
        };
      },
      agentEnv: () => ({}),
      forge: {
        openPullRequest: (branch) =>
          Promise.resolve(branch === BRANCH ? world.openPr : null),
        branchExists: () => Promise.resolve(false),
        createDraft: (pr) => {
          calls.push(`pr ${pr.branch} ${pr.title}`);
          return Promise.resolve(42);
        },
      },
      log: (line) => lines.push(line),
      now: () => new Date('2026-11-04T12:00:00Z'),
    },
  };
});

const handle = () => handleReport(world.config, world.deps);
const work = () => join(world.config.reportDir, 'agent');
const privateLabels = async () =>
  JSON.parse(
    await readFile(
      join(world.config.privateCorpus, 'annotations.json'),
      'utf8',
    ),
  ) as {
    id: string;
  }[];

describe('handleReport', () => {
  it('opens a draft PR once nothing leaks nor regresses, then files the label', async () => {
    const outcome = await handle();
    expect(outcome).toEqual({ kind: 'pr', pr: 42, branch: BRANCH });
    expect(world.calls).toContain(
      `agent Rapport ${ID} dans ${work()}, étiquette ${LABEL}.`,
    );
    expect(world.calls).toContain(
      `git -c core.hooksPath=/dev/null push --no-verify --quiet origin refs/heads/${BRANCH}:refs/heads/${BRANCH}`,
    );
    expect(world.calls).toEqual(
      expect.arrayContaining([
        'pnpm turbo run lint [bac à sable]',
        `turbo --filter=...[${BASE}] --filter=!@repo/scan-agent`,
        'pnpm --filter @repo/bench measure [bac à sable]',
        'pnpm install --frozen-lockfile --prefer-offline',
      ]),
    );
    expect(world.calls).toContain(
      `pr ${BRANCH} fix: poids du MaxiCode en livres`,
    );
    expect(world.calls.some((c) => c.startsWith('git worktree remove'))).toBe(
      true,
    );
    expect((await privateLabels()).map((l) => l.id)).toEqual([
      'real-img-0001',
      LABEL,
    ]);
    expect(existsSync(join(world.config.privateCorpus, `${LABEL}.jpg`))).toBe(
      true,
    );
    const body = await readFile(join(work(), 'pr.md'), 'utf8');
    expect(body).toContain(
      '| weightKg | first | 0.0 % (0/1) | 100.0 % (1/1) | 1 → 0 |',
    );
    expect(body).not.toMatch(/camille|XY111/i);
    expect(body).toContain('Agent : fil T3 `mcp:fil-1`');
    const journal = await readFile(
      join(world.config.reportDir, '..', '.agent', 'journal.log'),
      'utf8',
    );
    expect(journal).toContain(
      `rapport=${ID} etiquette=${neutralId(ID)} fil=mcp:fil-1 PR draft #42`,
    );
    expect(world.calls).toContain(
      `git worktree add --quiet --no-track -b ${BRANCH} ${join(world.config.worktrees, `ysl-scan-etiquette-${neutralId(ID)}`)} ${BASE}`,
    );
  });

  it('opens nothing on a regression and keeps the worktree with the reason', async () => {
    world.after = {
      results: bench('sure-ok').results.map((r) =>
        r.id === existing.id
          ? { ...r, fields: [{ field: 'tracking', status: 'empty' }] }
          : r,
      ),
    };
    const outcome = await handle();
    expect(outcome).toMatchObject({
      kind: 'failed',
      reason: 'régression sur le corpus',
    });
    expect(world.calls.some((c) => c.includes(' push '))).toBe(false);
    expect(world.calls.some((c) => c.startsWith('pr '))).toBe(false);
    expect(world.calls.some((c) => c.startsWith('git worktree remove'))).toBe(
      false,
    );
    const failure = await readFile(join(work(), 'echec.md'), 'utf8');
    expect(failure).toContain('recul : tracking (first) sur real-img-0001');
    expect(failure).toContain('Worktree gardé : ');
    expect(failure).toContain(
      '- Fil T3 : mcp:fil-1 (<t3-thread://v2/env/mcp:fil-1>)',
    );
    expect((await privateLabels()).map((l) => l.id)).toEqual(['real-img-0001']);
  });

  it('blocks the push when a commit carries a name from the report', async () => {
    world.diff.patch += "+const recipient = 'CAMILLE FICTIVE EXEMPLE';\n";
    const outcome = await handle();
    expect(outcome).toMatchObject({
      kind: 'failed',
      reason: 'contrôle avant push refusé',
    });
    expect(world.calls.some((c) => c.includes(' push '))).toBe(false);
    expect(world.calls.some((c) => c.includes('measure'))).toBe(false);
    const failure = await readFile(join(work(), 'echec.md'), 'utf8');
    expect(failure).toContain('leak : donnée du rapport');
    expect(failure).not.toMatch(/camille/i);
  });

  it('stops before the push with --no-pr, the corpus untouched', async () => {
    world.config.openPr = false;
    const outcome = await handle();
    expect(outcome).toMatchObject({ kind: 'ready', branch: BRANCH });
    expect(world.calls.some((c) => c.includes(' push '))).toBe(false);
    expect(world.calls.some((c) => c.startsWith('pr '))).toBe(false);
    expect(world.lines.join('\n')).toContain(
      '--no-pr : contrôles passés, arrêt avant le push',
    );
    expect((await privateLabels()).map((l) => l.id)).toEqual(['real-img-0001']);
  });

  it('launches no agent for a label whose PR is open', async () => {
    const state = join(world.config.reportDir, '..', '.agent');
    await mkdir(state, { recursive: true });
    await saveRegistry(join(state, 'etiquettes.json'), {
      groups: [
        {
          id: neutralId(ID),
          keys: [`image:${sha256(IMAGE)}`],
          reports: ['autre'],
          attempts: [
            { report: 'autre', branch: BRANCH, at: '', outcome: 'pr', pr: 7 },
          ],
        },
      ],
    });
    world.openPr = 7;
    expect(await handle()).toEqual({ kind: 'attached', pr: 7 });
    expect(world.calls.some((c) => c.startsWith('agent'))).toBe(false);
  });

  it('releases the lock when the registry is unreadable', async () => {
    const state = join(world.config.reportDir, '..', '.agent');
    await mkdir(state, { recursive: true });
    await writeFile(join(state, 'etiquettes.json'), '{ pas du json');
    await expect(handle()).rejects.toThrow();
    expect(existsSync(join(state, 'verrou'))).toBe(false);
  });

  it('records no attempt for a failure before the branch is chosen', async () => {
    world.deps.forge.branchExists = () =>
      Promise.reject(new Error('gh hors ligne'));
    expect(await handle()).toMatchObject({
      kind: 'failed',
      reason: 'gh hors ligne',
    });
    const registry = JSON.parse(
      await readFile(
        join(world.config.reportDir, '..', '.agent', 'etiquettes.json'),
        'utf8',
      ),
    ) as { groups: { attempts: unknown[] }[] };
    expect(registry.groups[0]?.attempts).toEqual([]);
  });

  it('pushes nothing when the agent left a git hook behind', async () => {
    world.duringAgent = () =>
      writeFile(
        join(world.config.repo, '..', 'git', 'hooks', 'pre-push'),
        'curl …',
      );
    expect(await handle()).toMatchObject({
      kind: 'failed',
      reason: 'hooks ou configuration git modifiés pendant l’agent',
    });
    expect(world.calls.some((c) => c.includes(' push '))).toBe(false);
  });

  it('says the branch is public when the PR fails after the push', async () => {
    world.deps.forge.createDraft = () =>
      Promise.reject(new Error('gh en panne'));
    expect(await handle()).toMatchObject({
      kind: 'failed',
      reason: 'gh en panne',
    });
    const failure = await readFile(join(work(), 'echec.md'), 'utf8');
    expect(failure).toContain(`- Publié : branche ${BRANCH} poussée, sans PR`);
  });

  it('keeps the PR when filing the label fails afterwards', async () => {
    world.config.privateCorpus = join(
      world.config.reportDir,
      'image.jpg',
      'sous',
    );
    expect(await handle()).toEqual({ kind: 'pr', pr: 42, branch: BRANCH });
    expect(world.lines.join('\n')).toContain(
      'PR #42 ouverte, mais la suite a échoué',
    );
    expect(world.calls.some((c) => c.startsWith('git worktree remove'))).toBe(
      false,
    );
  });

  it('pushes nothing when the push URL changed during the agent', async () => {
    world.duringAgent = () => {
      world.gitConfig +=
        'file:.git/config\turl.https://ailleurs.invalid/.insteadof=git@github.com:\n';
      return Promise.resolve();
    };
    expect(await handle()).toMatchObject({ kind: 'failed' });
    expect(world.calls.some((c) => c.includes(' push '))).toBe(false);
  });

  it('lets another session track its branch meanwhile', async () => {
    world.duringAgent = () => {
      world.gitConfig += 'file:.git/config\tbranch.feat/autre.remote=origin\n';
      return Promise.resolve();
    };
    expect(await handle()).toMatchObject({ kind: 'pr', pr: 42 });
  });

  it('ignores a report of an unknown version, with its reason, without an agent', async () => {
    const file = join(world.config.reportDir, 'rapport.json');
    const detail = JSON.parse(await readFile(file, 'utf8')) as Record<
      string,
      unknown
    >;
    await writeFile(
      file,
      JSON.stringify({ ...detail, report: { version: 2 } }),
    );
    expect(await handle()).toEqual({
      kind: 'ignored',
      reason: 'version du rapport inconnue (2, attendue 1)',
    });
    expect(world.calls).toEqual([]);
    const journal = await readFile(
      join(world.config.reportDir, '..', '.agent', 'journal.log'),
      'utf8',
    );
    expect(journal).toContain(
      `rapport=${ID} ignoré : version du rapport inconnue`,
    );
  });

  it('fails when the session did not run on Opus 5.5', async () => {
    world.agent = { wrongModel: true, model: 'claude-fable-5-1' };
    expect(await handle()).toMatchObject({
      kind: 'failed',
      reason: 'agent sur claude-fable-5-1 au lieu de claude-opus-5-5, arrêté',
    });
  });

  it('publishes nothing when the agent pushed a branch itself', async () => {
    world.remoteHeads = `c0ffee\trefs/heads/essai\n${'a'.repeat(40)}\trefs/heads/main\n`;
    expect(await handle()).toMatchObject({
      kind: 'failed',
      reason: 'l’agent a publié pendant son travail',
    });
    expect(world.calls.some((c) => c.includes(' push '))).toBe(false);
    expect(world.calls.some((c) => c.includes('measure'))).toBe(false);
    const failure = await readFile(join(work(), 'echec.md'), 'utf8');
    expect(failure).toContain('- Publié : par l’agent : refs/heads/essai');
  });

  it('publishes nothing when the agent opened a PR on its branch', async () => {
    world.deps.forge.openPullRequest = (branch) =>
      Promise.resolve(
        branch === BRANCH && world.calls.some((c) => c.startsWith('agent'))
          ? 9
          : null,
      );
    expect(await handle()).toMatchObject({
      kind: 'failed',
      reason: 'l’agent a publié pendant son travail',
    });
    expect(world.calls.some((c) => c.startsWith('pr '))).toBe(false);
  });

  it('fails with the reason the thread was stopped for', async () => {
    world.agent = { stopped: 'le fil attend une réponse (fil arrêté)' };
    expect(await handle()).toMatchObject({
      kind: 'failed',
      reason: 'le fil attend une réponse (fil arrêté)',
    });
    const journal = await readFile(
      join(world.config.reportDir, '..', '.agent', 'journal.log'),
      'utf8',
    );
    expect(journal).toContain(
      'fil=mcp:fil-1 échec : le fil attend une réponse',
    );
  });

  it('fails without a PR when the agent found nothing to fix', async () => {
    world.result = {
      statut: 'echec',
      titre: 'échec',
      resume: 'lue juste',
      raison: 'bien lue',
    };
    expect(await handle()).toMatchObject({
      kind: 'failed',
      reason: 'l’agent n’a rien corrigé : bien lue',
    });
  });
});
