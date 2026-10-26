import 'fake-indexeddb/auto';
import { GS, RS } from '@repo/contract/codes';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addDraft,
  finishBatch,
  openBatch,
  promotedStatus,
  updateDraft,
} from '#/features/batch/store';
import type { CourrierDatabase, DraftParcel } from '#/features/db/schema';
import {
  nameLine,
  preselection,
  readsOf,
  settleRecipients,
} from '#/features/recipient/check';
import { recipientEntries } from '#/features/recipient/entries';
import { InlineMatcher } from '#/features/recipient/matcher';
import { recentOptions } from '#/features/recipient/options';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

const LEA = personRow({ id: 'lea', firstName: 'Léa', lastName: 'Fontaine' });
const LOUIS = personRow({
  id: 'louis',
  firstName: 'Louis',
  lastName: 'Fontaine',
});
const HUGO = personRow({ id: 'hugo', firstName: 'Hugo', lastName: 'Dupont' });

let db: CourrierDatabase;
let files: MemoryFiles;
let matcher: InlineMatcher;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
  matcher = new InlineMatcher();
  matcher.setEntries(recipientEntries([LEA, LOUIS, HUGO], []));
});

/** A GeoPost Aztec that prints the recipient, as the parsers read it. */
const aztecFor = (name: string) =>
  [
    `[)>${RS}01`,
    '02',
    '0075007',
    '250',
    '801',
    '118J0229907975',
    'GEOP',
    '123456',
    '',
    '',
    '001/001',
    '00.50KG',
    'N',
    '37 RUE DE BELLECHASSE',
    'PARIS',
    '',
    name,
  ].join(GS);

const draftWith = async (
  batchId: string,
  seconds: number,
  patch: Partial<Pick<DraftParcel, 'readName' | 'ocrName' | 'symbols'>>,
) => {
  const draft = await addDraft(db, files, batchId, null, later(seconds));
  await updateDraft(db, draft.id, patch);
  return draft.id;
};

describe('settleRecipients', () => {
  it('settles only a code name matching one card exactly, and queues the rest in order', async () => {
    const batch = await openBatch(db, NOW);
    const coded = await draftWith(batch.id, 1, {
      readName: 'DUPONT HUGO',
      symbols: [{ format: 'Aztec', text: aztecFor('DUPONT HUGO') }],
    });
    const read = await draftWith(batch.id, 2, { ocrName: 'LEA FONTAINE' });
    const homonym = await draftWith(batch.id, 3, { readName: 'FONTAINE' });
    const unknown = await draftWith(batch.id, 4, { readName: 'NORA HADDAD' });
    const copied = await draftWith(batch.id, 5, { readName: 'HUGO DUPONT' });

    const queue = await settleRecipients(db, batch.id, matcher);

    expect(queue).toEqual([read, homonym, unknown, copied]);
    expect((await db.draftParcel.get(coded))?.recipient).toEqual({
      kind: 'person',
      id: 'hugo',
      name: 'Hugo Dupont',
      source: 'code',
    });
    expect((await db.draftParcel.get(read))?.recipient).toBeUndefined();
  });

  it('leaves a draft the agent already settled', async () => {
    const batch = await openBatch(db, NOW);
    const chosen = await draftWith(batch.id, 1, { ocrName: 'L. FONTAINE' });
    await updateDraft(db, chosen, {
      recipient: {
        kind: 'person',
        id: 'louis',
        name: 'Louis Fontaine',
        source: 'agent',
      },
    });

    expect(await settleRecipients(db, batch.id, matcher)).toEqual([]);
  });
});

describe('preselection', () => {
  const match = (ocrName: string) =>
    matcher.match(readsOf({ readName: null, ocrName, symbols: [] }));

  it('selects an OCR name that stands out, for the agent to validate', async () => {
    expect(preselection({}, await match('LEA FONTAINE'))).toMatchObject({
      kind: 'person',
      id: 'lea',
    });
  });

  it('selects nobody for a partial homonym', async () => {
    expect(preselection({}, await match('L. FONTAINE'))).toBeNull();
    expect(preselection({}, await match('FONTAINE'))).toBeNull();
  });

  it('keeps the choice the agent made earlier', async () => {
    const recipient = {
      kind: 'person' as const,
      id: 'louis',
      name: 'Louis Fontaine',
      source: 'agent' as const,
    };
    expect(preselection({ recipient }, await match('LEA FONTAINE'))).toBe(
      recipient,
    );
  });
});

describe('promotion', () => {
  it('turns the recipient into the parcel’s person or contact, received', async () => {
    const batch = await openBatch(db, NOW);
    const draft = await addDraft(db, files, batch.id, null, later(1));
    await updateDraft(db, draft.id, {
      carrier: 'Colissimo',
      tracking: '8J02299079750',
      ocrName: 'L. FONTAIN',
    });
    const other = await addDraft(db, files, batch.id, null, later(2));
    await updateDraft(db, other.id, {
      carrier: 'UPS',
      tracking: '1ZE6344W0499230622',
      recipient: {
        kind: 'contact',
        id: 'nora',
        name: 'Nora Haddad',
        source: 'agent',
      },
    });
    const unsettled = await db.draftParcel.get(draft.id);
    expect(promotedStatus(unsettled!)).toBe('a_completer');

    await updateDraft(db, draft.id, {
      recipient: {
        kind: 'person',
        id: 'lea',
        name: 'Léa Fontaine',
        source: 'agent',
      },
    });
    await finishBatch(db, {
      batchId: batch.id,
      agentId: 'agent',
      now: later(5),
    });

    expect(await db.parcel.get(draft.id)).toMatchObject({
      status: 'recu',
      personId: 'lea',
      contactId: null,
    });
    expect(await db.parcel.get(other.id)).toMatchObject({
      status: 'recu',
      personId: null,
      contactId: 'nora',
    });
  });
});

describe('nameLine', () => {
  const box = { x: 0, y: 0, width: 10, height: 2 };
  it('finds the line that shares most words with the name', () => {
    const lines = [
      { text: 'DESTINATAIRE :', box, score: 1 },
      { text: 'L. FONTAIN', box: { ...box, y: 40 }, score: 1 },
      { text: 'SAINT LAURENT', box: { ...box, y: 80 }, score: 1 },
    ];
    expect(nameLine(lines, 'L. Fontain')?.box.y).toBe(40);
    expect(nameLine(lines, 'Hugo Dupont')).toBeNull();
    expect(nameLine(lines, null)).toBeNull();
  });
});

describe('recentOptions', () => {
  it('lists the last recipients once each, newest first, gone or inactive ones left out', () => {
    const nora = contactRow({ id: 'nora', name: 'Nora Haddad' });
    const parcels = [
      parcelRow({ personId: 'lea', receivedAt: later(1) }),
      parcelRow({ contactId: 'nora', receivedAt: later(3) }),
      parcelRow({ personId: 'lea', receivedAt: later(4) }),
      parcelRow({ personId: 'gone', receivedAt: later(5) }),
      parcelRow({ receivedAt: later(6) }),
      parcelRow({ personId: 'off', receivedAt: later(7) }),
    ];

    expect(
      recentOptions(
        parcels,
        [LEA, HUGO, personRow({ id: 'off', active: false })],
        [nora],
      ).map((o) => o.id),
    ).toEqual(['lea', 'nora']);
  });
});
