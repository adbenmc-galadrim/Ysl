import { describe, expect, it } from 'vitest';
import { markdown, verdict } from '../visual/report.mjs';

const under = {
  story: 'ecrans-colis--colis',
  ref: '05-colis/colis--colis',
  pct: 0.12,
};
const over = {
  story: 'ecrans-scan--lecture',
  ref: '04-reception/scan-lecture',
  pct: 0.61,
};
const results = [under, over];

describe('verdict', () => {
  it('fails on the screens above the maximum, strictly', () => {
    const { ok, failed } = verdict(results, 0.6);
    expect(ok).toBe(false);
    expect(failed.map((r) => r.ref)).toEqual(['04-reception/scan-lecture']);
    expect(verdict([{ ...over, pct: 0.6 }], 0.6).ok).toBe(true);
  });

  it('passes when every screen is under the maximum', () => {
    expect(verdict(results, 1)).toEqual({ ok: true, failed: [] });
  });

  it('fails when no screen was compared', () => {
    expect(verdict([], 0.6).ok).toBe(false);
  });
});

describe('markdown', () => {
  it('lists one row per screen with its mark', () => {
    const table = markdown(results, 0.6);
    expect(table.split('\n').filter(Boolean)).toHaveLength(4);
    expect(table).toContain('| `05-colis/colis--colis` | 0.12 % | ✅ |');
    expect(table).toContain('| `04-reception/scan-lecture` | 0.61 % | ❌ |');
  });

  it('says so when nothing was compared', () => {
    expect(markdown([], 0.6)).toContain('aucun écran comparé');
  });
});
