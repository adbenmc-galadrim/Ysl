import { readFile, rename, writeFile } from 'node:fs/promises';
import { z } from 'zod';

const attemptSchema = z.object({
  report: z.string(),
  branch: z.string(),
  at: z.string(),
  outcome: z.string(),
  pr: z.number().optional(),
});

const groupSchema = z.object({
  /** Neutral: the first 8 characters of the report that opened the group. */
  id: z.string(),
  keys: z.array(z.string()),
  reports: z.array(z.string()),
  attempts: z.array(attemptSchema),
});

const registrySchema = z.object({ groups: z.array(groupSchema) });

export type Attempt = z.infer<typeof attemptSchema>;
export type Group = z.infer<typeof groupSchema>;
export type Registry = z.infer<typeof registrySchema>;

export const BRANCH_PREFIX = 'fix/scan-etiquette-';

export const neutralId = (reportId: string) =>
  reportId.replaceAll('-', '').slice(0, 8);

export async function loadRegistry(file: string): Promise<Registry> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return { groups: [] };
  }
  return registrySchema.parse(JSON.parse(raw));
}

export async function saveRegistry(
  file: string,
  registry: Registry,
): Promise<void> {
  const partial = `${file}.${process.pid}`;
  await writeFile(partial, `${JSON.stringify(registry, null, 2)}\n`);
  await rename(partial, file);
}

/**
 * Two reports on the same label (same tracking, or the same image) share a
 * group; a report bringing a new key to a group adds it.
 */
export function attachReport(
  registry: Registry,
  reportId: string,
  keys: readonly string[],
): { group: Group; created: boolean } {
  const found = registry.groups.find((g) =>
    g.keys.some((k) => keys.includes(k)),
  );
  if (found) {
    for (const key of keys) if (!found.keys.includes(key)) found.keys.push(key);
    if (!found.reports.includes(reportId)) found.reports.push(reportId);
    return { group: found, created: false };
  }
  const group: Group = {
    id: neutralId(reportId),
    keys: [...keys],
    reports: [reportId],
    attempts: [],
  };
  registry.groups.push(group);
  return { group, created: true };
}

export type Forge = {
  /** The number of the open PR whose head is `branch`, or null. */
  openPullRequest: (branch: string) => Promise<number | null>;
  /** On the remote or here. */
  branchExists: (branch: string) => Promise<boolean>;
};

/** One open PR per label: a report on a label already in review waits for it. */
export async function openPullRequestOf(
  group: Group,
  forge: Forge,
): Promise<{ branch: string; pr: number } | null> {
  const branches = [
    ...new Set(group.attempts.map((a) => a.branch).filter(Boolean)),
  ];
  for (const branch of branches) {
    const pr = await forge.openPullRequest(branch);
    if (pr !== null) return { branch, pr };
  }
  return null;
}

/** Named after the label, suffixed when a closed attempt already took the name. */
export async function freeBranch(group: Group, forge: Forge): Promise<string> {
  const base = `${BRANCH_PREFIX}${group.id}`;
  for (let n = 1; n < 100; n += 1) {
    const branch = n === 1 ? base : `${base}-${n}`;
    const used = group.attempts.some((a) => a.branch === branch);
    if (!used && !(await forge.branchExists(branch))) return branch;
  }
  throw new Error(`Aucune branche libre pour l'étiquette ${group.id}.`);
}
