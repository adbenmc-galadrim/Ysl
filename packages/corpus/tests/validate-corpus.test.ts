import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateTracking } from '@repo/contract/tracking';
import { labelSchema } from '#schema';

const labels = labelSchema
  .array()
  .parse(
    JSON.parse(
      readFileSync(new URL('../data/web.json', import.meta.url), 'utf8'),
    ),
  );

const KNOWN_KEY_COLLISIONS = new Set(['393711491718', '962365144662']);

const withTracking = labels.flatMap((label) =>
  label.tracking === null ? [] : [[label.carrier, label.tracking] as const],
);

describe('web corpus against the contract rules', () => {
  it('has trackings to check', () => {
    expect(withTracking.length).toBeGreaterThan(50);
  });

  it.each(withTracking)(
    '%s %s is never rejected with its carrier as context',
    (carrier, tracking) => {
      const verdict = validateTracking(tracking, { context: carrier });
      expect(verdict.status, verdict.reason).not.toBe('rejected');
    },
  );

  const keyed: Partial<Record<(typeof labels)[number]['carrier'], RegExp>> = {
    ups: /^1Z/,
    fedex: /^\d{12}$/,
    colissimo: /^\d[A-Z]\d{11}$/,
    'dhl-express': /^\d{10}$/,
  };

  it.each(
    withTracking.filter(([carrier, tracking]) =>
      keyed[carrier]?.test(tracking),
    ),
  )('%s %s is sure with its carrier as context', (carrier, tracking) => {
    expect(validateTracking(tracking, { context: carrier }).status).toBe(
      'sure',
    );
  });

  it('never calls a real label sure under another carrier', () => {
    for (const [carrier, tracking] of withTracking) {
      const verdict = validateTracking(tracking);
      if (verdict.status !== 'sure' || verdict.carrier === null) continue;
      expect([carrier, tracking, verdict.carrier]).toSatisfy(
        () => verdict.carrier === carrier || KNOWN_KEY_COLLISIONS.has(tracking),
      );
    }
  });

  it('accepts the SSCC of the German labels on the GS1 key', () => {
    const sscc = withTracking
      .map(([, tracking]) => tracking)
      .filter((tracking) => /^00\d{18}$/.test(tracking));
    expect(sscc.length).toBeGreaterThan(3);
    for (const tracking of sscc) {
      expect(validateTracking(tracking).status, tracking).toBe('sure');
    }
  });
});
