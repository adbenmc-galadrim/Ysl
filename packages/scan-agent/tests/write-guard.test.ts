import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { verdict, writeAllowed } from '#write-guard';

let root: string;
let worktree: string;
let work: string;
let photo: string;

beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'scan-agent-guard-'));
  worktree = join(root, 'fils', 'ysl-scan-etiquette-x');
  work = join(root, 'rapport', 'agent');
  photo = join(root, 'corpus', 'real', 'IMG_0001.jpg');
  await mkdir(join(worktree, 'packages'), { recursive: true });
  await mkdir(join(work, 'corpus-real'), { recursive: true });
  await mkdir(join(root, 'corpus', 'real'), { recursive: true });
  await writeFile(photo, 'photo');
  await symlink(photo, join(work, 'corpus-real', 'IMG_0001.jpg'));
});

describe('writeAllowed', () => {
  it('lets the agent write in the worktree and the work folder, new files too', () => {
    const roots = [worktree, work];
    expect(
      writeAllowed(join(worktree, 'packages', 'neuf', 'a.ts'), roots),
    ).toBe(true);
    expect(
      writeAllowed(join(work, 'corpus-real', 'annotations.json'), roots),
    ).toBe(true);
  });

  it('refuses a real photo behind a link of the work corpus', () => {
    expect(
      writeAllowed(join(work, 'corpus-real', 'IMG_0001.jpg'), [worktree, work]),
    ).toBe(false);
  });

  it('refuses a way out by `..` or a sibling sharing the prefix', () => {
    const roots = [worktree, work];
    expect(
      writeAllowed(join(worktree, '..', '.claude', 'settings.json'), roots),
    ).toBe(false);
    expect(writeAllowed(`${worktree}-autre/a.ts`, roots)).toBe(false);
  });
});

describe('verdict', () => {
  it('reads the path of Write and NotebookEdit, and refuses a call without one', () => {
    const roots = [worktree];
    expect(
      verdict({ tool_input: { file_path: join(worktree, 'a.ts') } }, roots)
        .allowed,
    ).toBe(true);
    expect(
      verdict({ tool_input: { notebook_path: join(root, 'n.ipynb') } }, roots)
        .allowed,
    ).toBe(false);
    expect(verdict({ tool_input: {} }, roots).allowed).toBe(false);
  });
});
