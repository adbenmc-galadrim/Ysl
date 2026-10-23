import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

type Label = {
  id: string;
  file: string;
  carrier: string;
  recipient: string | null;
  sender: string | null;
  difficulties: string[];
};

const { values } = parseArgs({
  options: {
    force: { type: 'boolean', default: false },
    seed: { type: 'string', default: '20261022' },
  },
});

const root = resolve(import.meta.dirname, '..');
const target = join(root, 'public', 'corpus');
const manifestPath = join(target, 'manifest.json');
const seed = Number(values.seed);

function upToDate(): boolean {
  if (!existsSync(manifestPath)) return false;
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    seed: number;
  };
  return manifest.seed === seed;
}

if (!values.force && upToDate()) {
  console.log(`pack synthétique déjà présent dans ${target}`);
  process.exit(0);
}

const scratch = mkdtempSync(join(tmpdir(), 'spike-ocr-pack-'));
try {
  const run = spawnSync(
    'pnpm',
    [
      '--filter',
      '@repo/corpus',
      'generate',
      '--out',
      scratch,
      '--seed',
      String(seed),
    ],
    { stdio: 'inherit' },
  );
  if (run.status !== 0) {
    throw new Error('la génération du corpus synthétique a échoué');
  }
  const labels = JSON.parse(
    readFileSync(join(scratch, 'synthetic', 'labels.json'), 'utf8'),
  ) as Label[];
  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });
  for (const label of labels) {
    copyFileSync(
      join(scratch, 'synthetic', label.file),
      join(target, label.file),
    );
  }
  const items = labels.map((label) => ({
    id: label.id,
    file: label.file,
    carrier: label.carrier,
    recipient: label.recipient,
    sender: label.sender,
    difficulties: label.difficulties,
  }));
  writeFileSync(manifestPath, `${JSON.stringify({ seed, items }, null, 2)}\n`);
  console.log(`${items.length} photos dans ${target}`);
} finally {
  rmSync(scratch, { recursive: true, force: true });
}
