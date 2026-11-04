import { describe, expect, it } from 'vitest';
import {
  attachReport,
  type Forge,
  freeBranch,
  neutralId,
  openPullRequestOf,
  type Registry,
} from '#groups';

const A = '0b5e1c3a-7d2f-4e8b-9a61-2f4c8d0e6b17';
const B = '9f00aa11-2b3c-4d5e-8f60-718293a4b5c6';
const C = '5d4c3b2a-1f0e-4d9c-8b7a-695847362514';

const forge = (
  open: Record<string, number> = {},
  taken: string[] = [],
): Forge => ({
  openPullRequest: (branch) => Promise.resolve(open[branch] ?? null),
  branchExists: (branch) => Promise.resolve(taken.includes(branch)),
});

describe('attachReport', () => {
  it('puts two reports on the same tracking or the same image in one group', () => {
    const registry: Registry = { groups: [] };
    const first = attachReport(registry, A, ['tracking:t1', 'image:i1']);
    const sameTracking = attachReport(registry, B, ['tracking:t1', 'image:i2']);
    const sameImage = attachReport(registry, C, ['image:i2']);
    expect(first.created).toBe(true);
    expect(sameTracking).toEqual({ group: first.group, created: false });
    expect(sameImage.group).toBe(first.group);
    expect(first.group).toMatchObject({
      id: neutralId(A),
      keys: ['tracking:t1', 'image:i1', 'image:i2'],
      reports: [A, B, C],
    });
  });

  it('opens a new group for another label', () => {
    const registry: Registry = { groups: [] };
    attachReport(registry, A, ['tracking:t1', 'image:i1']);
    expect(attachReport(registry, B, ['tracking:t2', 'image:i2']).created).toBe(
      true,
    );
    expect(registry.groups).toHaveLength(2);
  });
});

describe('one open PR per label', () => {
  const group = {
    id: neutralId(A),
    keys: [],
    reports: [A],
    attempts: [
      {
        report: A,
        branch: 'fix/scan-etiquette-0b5e1c3a',
        at: '',
        outcome: 'pr',
        pr: 7,
      },
    ],
  };

  it('finds the open PR of an earlier attempt', async () => {
    expect(
      await openPullRequestOf(
        group,
        forge({ 'fix/scan-etiquette-0b5e1c3a': 7 }),
      ),
    ).toEqual({ branch: 'fix/scan-etiquette-0b5e1c3a', pr: 7 });
    expect(await openPullRequestOf(group, forge())).toBeNull();
  });

  it('names the branch after the label, suffixed once the name is taken', async () => {
    expect(await freeBranch({ ...group, attempts: [] }, forge())).toBe(
      'fix/scan-etiquette-0b5e1c3a',
    );
    expect(
      await freeBranch(group, forge({}, ['fix/scan-etiquette-0b5e1c3a-2'])),
    ).toBe('fix/scan-etiquette-0b5e1c3a-3');
  });
});
