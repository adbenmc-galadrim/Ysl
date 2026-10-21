import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { config } from 'dotenv';

function findWorkspaceRoot(start = process.cwd()): string | undefined {
  let dir = start;
  for (;;) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

const root = findWorkspaceRoot();
if (root) {
  config({ path: resolve(root, '.env'), quiet: true });
}
