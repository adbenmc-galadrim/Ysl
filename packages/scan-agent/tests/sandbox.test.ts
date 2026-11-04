import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { profile } from '#sandbox';

const run = promisify(execFile);

describe.runIf(process.platform === 'darwin')(
  'profile under sandbox-exec',
  () => {
    it('lets the agent’s code write its folders, nothing else, and reach no network', async () => {
      const root = await mkdtemp(join(tmpdir(), 'scan-agent-sbx-'));
      const home = join(root, 'home');
      const inside = join(home, 'worktree');
      const tmp = await mkdtemp('/private/tmp/ysl-agent-test-');
      await mkdir(join(home, '.ssh'), { recursive: true });
      await mkdir(inside, { recursive: true });
      await writeFile(join(home, '.ssh', 'id'), 'clé');
      const file = join(root, 'profil.sb');
      await writeFile(file, profile([inside], tmp, home));
      const script = `
      const fs = require('node:fs');
      const tryIt = (f) => { try { f(); return 'ok'; } catch { return 'refusé'; } };
      const out = {
        inside: tryIt(() => fs.writeFileSync(${JSON.stringify(join(inside, 'a'))}, 'x')),
        outside: tryIt(() => fs.writeFileSync(${JSON.stringify(join(home, 'b'))}, 'x')),
        secret: tryIt(() => fs.readFileSync(${JSON.stringify(join(home, '.ssh', 'id'))})),
      };
      fetch('https://example.com').then(() => 'ok', () => 'refusé').then((net) =>
        console.log(JSON.stringify({ ...out, net })));
    `;
      const { stdout } = await run('sandbox-exec', [
        '-f',
        file,
        process.execPath,
        '-e',
        script,
      ]);
      expect(JSON.parse(stdout)).toEqual({
        inside: 'ok',
        outside: 'refusé',
        secret: 'refusé',
        net: 'refusé',
      });
      expect(existsSync(join(home, 'b'))).toBe(false);
    });
  },
);
