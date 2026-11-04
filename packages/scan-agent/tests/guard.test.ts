import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import { beforeEach, describe, expect, it } from 'vitest';
import { checkBeforePush, type Git, type Sensitive } from '#guard';

const run = promisify(execFile);

let dir: string;
let git: Git;

const write = async (path: string, content: string | Buffer) => {
  await mkdir(dirname(join(dir, path)), { recursive: true });
  await writeFile(join(dir, path), content);
};

const commit = async (
  message: string,
  files: Record<string, string | Buffer>,
) => {
  for (const [path, content] of Object.entries(files))
    await write(path, content);
  await git(['add', '.']);
  await git(['commit', '-q', '-m', message]);
};

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'scan-agent-guard-'));
  git = async (args) => (await run('git', args, { cwd: dir })).stdout;
  await git(['init', '-q', '-b', 'main']);
  await git(['config', 'user.email', 'test@example.invalid']);
  await git(['config', 'user.name', 'Test']);
  await commit('chore: base', {
    'packages/contract/src/sender.ts':
      "export const KEYWORDS = ['EXPEDITEUR', 'Paris'];\nconst sleep = 1;\n",
  });
  await git(['checkout', '-q', '-b', 'fix/scan-etiquette-0b5e1c3a']);
});

const SENSITIVE: Sensitive = {
  personal: ['Camille Fictive-Exemple', '1Z 999 AA1 01 2345 6784'],
  other: ['12 RUE DES INVENTIONS', '75011 Paris', 'SHIP TO:', 'EXPEDITEUR'],
};

const check = (overrides: { title?: string; body?: string } = {}) =>
  checkBeforePush({
    git,
    base: 'main',
    branch: 'fix/scan-etiquette-0b5e1c3a',
    title: overrides.title ?? 'fix: poids UPS en livres',
    body: overrides.body ?? 'Rapport 0b5e1c3a : 252 étiquettes, aucun recul.',
    sensitive: SENSITIVE,
  });

describe('checkBeforePush', () => {
  it('lets through a fix made of code and synthetic tests', async () => {
    await commit('fix: poids UPS en livres', {
      'packages/contract/src/weight.ts':
        "export const LB = 0.4536;\nexport const KEYWORDS = ['SHIP TO', 'EXPEDITEUR', 'Paris'];\n",
      'packages/contract/tests/weight.test.ts':
        "const recipient = 'Nom Synthétique';\n",
    });
    expect(await check()).toEqual([]);
  });

  it('blocks a name, a spaced tracking or an address line from the report', async () => {
    await commit('test: étiquette du rapport', {
      'packages/contract/tests/a.test.ts':
        "const name = 'CAMILLE FICTIVE EXEMPLE';\n",
      'packages/contract/tests/b.test.ts': "const t = '1Z999AA10123456784';\n",
      'packages/contract/tests/c.test.ts':
        "const line = '12 rue des Inventions';\n",
    });
    const details = (await check()).map((p) => p.detail).join('\n');
    for (const file of ['a', 'b', 'c']) {
      expect(details).toContain(`packages/contract/tests/${file}.test.ts`);
    }
    expect(details).not.toMatch(/camille|1Z999|inventions/i);
  });

  it('counts a word as public only when main has it whole', async () => {
    await commit('test: noms', {
      'packages/contract/tests/d.test.ts': "const name = 'Lee';\n",
    });
    const problems = await checkBeforePush({
      git,
      base: 'main',
      branch: 'fix/scan-etiquette-0b5e1c3a',
      title: 'fix: x',
      body: '',
      sensitive: { personal: ['Lee'], other: [] },
    });
    expect(problems.map((p) => p.kind)).toEqual(['leak']);
  });

  it('blocks a report value in the title, the body or a commit message', async () => {
    await commit('fix: tracking 1Z 999 AA1 01 2345 6784', {
      'packages/contract/src/x.ts': 'export const x = 1;\n',
    });
    const problems = await check({ body: 'Pour Camille Fictive-Exemple.' });
    const details = problems.map((p) => p.detail).join('\n');
    expect(details).toContain('dans : messages de commit');
    expect(details).toContain('dans : description de la PR');
  });

  it('blocks an image, a binary, the corpus annotations and the bench', async () => {
    await commit('test: corpus', {
      'packages/corpus/data/photo.jpg': 'pas vraiment une image',
      'packages/contract/tests/blob.bin': Buffer.from([0, 1, 2, 0, 255]),
      'corpus/annotations.json': '[]\n',
      'packages/bench/src/measure.ts': 'export {};\n',
      'packages/scan-agent/src/guard.ts': 'export {};\n',
    });
    const details = (await check()).map((p) => p.detail);
    expect(details).toEqual(
      expect.arrayContaining([
        expect.stringContaining('image : packages/corpus/data/photo.jpg'),
        expect.stringContaining(
          'fichier binaire : packages/contract/tests/blob.bin',
        ),
        expect.stringContaining('annotations du corpus'),
        expect.stringContaining('banc de mesure'),
        expect.stringContaining('outillage de l’agent'),
      ]),
    );
  });

  it('blocks any AI attribution and uncommitted changes', async () => {
    await commit('fix: x\n\nCo-Authored-By: Claude <noreply@anthropic.com>', {
      'packages/contract/src/x.ts': 'export const x = 1;\n',
    });
    await write('packages/contract/src/y.ts', 'export const y = 2;\n');
    const kinds = (await check({ body: '🤖 Generated with Claude Code' })).map(
      (p) => `${p.kind}:${p.detail}`,
    );
    expect(kinds).toEqual(
      expect.arrayContaining([
        'dirty:modifications non commitées',
        'attribution:attribution IA dans messages de commit',
        'attribution:attribution IA dans description de la PR',
      ]),
    );
  });
});
