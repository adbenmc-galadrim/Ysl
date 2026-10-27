import 'fake-indexeddb/auto';
import { createTranslator } from '@repo/shared/i18n';
import { beforeEach, describe, expect, it } from 'vitest';
import { addDraft, openBatch, promotedStatus } from '#/features/batch/store';
import type { CourrierDatabase, DraftParcel } from '#/features/db/schema';
import { pickTracking } from '#/features/scan/confirm';
import { checkFields } from '#/features/scan/reading';
import { NOW, openTestDatabase } from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const t = createTranslator('fr');

const UPS = '1ZE6344W0499230622';
const DHL = '5413337112';

const draft = (overrides: Partial<DraftParcel>): DraftParcel => ({
  id: 'd',
  batchId: 'b',
  createdAt: NOW,
  photoId: null,
  reading: 'read',
  carrier: 'UPS',
  tracking: UPS,
  trackingNorm: UPS,
  readName: null,
  symbols: [{ format: 'Code128', text: UPS }],
  ocrState: 'done',
  ocrName: null,
  ocrLines: [],
  ...overrides,
});

describe('checkFields — « Vérifier un colis »', () => {
  it('ticks a keyed tracking', () => {
    expect(checkFields(draft({}), t)).toEqual([
      { label: 'Transporteur', value: 'UPS' },
      { label: 'Suivi', value: UPS, mono: true },
    ]);
  });

  it('asks to verify a number without a key', () => {
    const fields = checkFields(
      draft({
        carrier: 'DHL Express',
        tracking: DHL,
        trackingNorm: DHL,
        symbols: [{ format: 'Code128', text: DHL }],
      }),
      t,
    );
    expect(fields[1]).toEqual({
      label: 'Suivi',
      value: `${DHL} ?`,
      mono: true,
      status: 'warning',
    });
  });

  it('takes the carrier as sure once the agent confirmed the number', () => {
    const fields = checkFields(
      draft({
        carrier: 'DHL Express',
        tracking: DHL,
        trackingNorm: DHL,
        symbols: [{ format: 'Code128', text: DHL }],
        trackingConfirmed: true,
      }),
      t,
    );
    expect(fields[0]).toEqual({ label: 'Transporteur', value: 'DHL Express' });
  });

  it('keeps a carrier the codes did not vote for plain', () => {
    const fields = checkFields(
      draft({
        carrier: 'Chronopost',
        tracking: '5413337112',
        trackingNorm: '5413337112',
        symbols: [{ format: 'Code128', text: '5413337112' }],
      }),
      t,
    );
    expect(fields[0]).toEqual({ label: 'Transporteur', value: 'Chronopost' });
  });

  it('leaves a number of unknown shape empty, offered as a chip to pick', () => {
    const picked: string[] = [];
    const fields = checkFields(
      draft({
        carrier: null,
        tracking: 'AB1234567',
        trackingNorm: 'AB1234567',
        symbols: [{ format: 'Code128', text: 'AB1234567' }],
      }),
      t,
      (value) => picked.push(value),
    );
    expect(fields[1]).toMatchObject({
      label: 'Suivi',
      value: '',
      status: 'error',
      suggestions: [{ label: 'AB1234567', pickLabel: 'Choisir AB1234567' }],
    });
    fields[1]?.suggestions?.[0]?.onPick?.();
    expect(picked).toEqual(['AB1234567']);
  });
});

describe('pickTracking', () => {
  let db: CourrierDatabase;
  beforeEach(async () => {
    db = await openTestDatabase();
  });

  it('confirms the number the agent picked, so the parcel can be notified', async () => {
    const batch = await openBatch(db, NOW);
    const added = await addDraft(db, new MemoryFiles(), batch.id, null, NOW);
    await db.draftParcel.update(added.id, {
      reading: 'read',
      carrier: 'DHL Express',
      tracking: DHL,
      trackingNorm: DHL,
      readName: 'Camille Morel',
      recipient: {
        kind: 'person',
        id: 'p-camille',
        name: 'Camille Morel',
        source: 'agent',
      },
      symbols: [{ format: 'Code128', text: DHL }],
    });
    expect(promotedStatus((await db.draftParcel.get(added.id))!)).toBe(
      'a_completer',
    );

    expect(await pickTracking(added.id, DHL, db)).toBe(true);

    const confirmed = (await db.draftParcel.get(added.id))!;
    expect(confirmed).toMatchObject({
      trackingConfirmed: true,
      carrier: 'DHL Express',
    });
    expect(promotedStatus(confirmed)).toBe('recu');
  });
});
