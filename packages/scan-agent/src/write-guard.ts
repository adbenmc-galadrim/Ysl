import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The real path, links resolved, of a file that may not exist yet: its
 * deepest existing parent resolved, the rest appended.
 */
export function realTarget(path: string): string {
  const absolute = resolve(path);
  if (existsSync(absolute)) return realpathSync(absolute);
  const parent = dirname(absolute);
  if (parent === absolute) return absolute;
  return join(realTarget(parent), basename(absolute));
}

const inside = (root: string, target: string) => {
  const rel = relative(root, target);
  return (
    rel === '' ||
    (!rel.startsWith(`..${sep}`) && rel !== '..' && !rel.startsWith(sep))
  );
};

/**
 * In bypass mode, Edit and Write skip the sandbox: they may write only in
 * the worktree and the work folder. A link of the work corpus to a real
 * photo resolves out of it, and is refused.
 */
export function writeAllowed(path: string, roots: string[]): boolean {
  const target = realTarget(path);
  return roots.some((root) => inside(realTarget(root), target));
}

type HookInput = {
  tool_name?: string;
  tool_input?: { file_path?: unknown; notebook_path?: unknown };
};

export function verdict(
  input: HookInput,
  roots: string[],
): { allowed: boolean; reason: string } {
  const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (typeof path !== 'string' || path === '') {
    return { allowed: false, reason: 'chemin d’écriture illisible' };
  }
  if (writeAllowed(path, roots)) return { allowed: true, reason: '' };
  return {
    allowed: false,
    reason: `écriture hors du worktree et du dossier de travail refusée : ${path}`,
  };
}

/** `PreToolUse` hook: exit 2 refuses the call and shows the reason to the agent. */
function main() {
  const roots = process.argv.slice(2);
  let input: HookInput;
  try {
    input = JSON.parse(readFileSync(0, 'utf8')) as HookInput;
  } catch {
    process.stderr.write('entrée du hook illisible\n');
    process.exit(2);
  }
  const { allowed, reason } = verdict(input, roots);
  if (!allowed) {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
}

if (
  process.argv[1] &&
  realTarget(process.argv[1]) === realTarget(fileURLToPath(import.meta.url))
) {
  main();
}
