import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addDraft,
  finishBatch,
  listDrafts,
  openBatch,
  updateDraft,
} from '#/features/batch/store';
import type {
  CourrierDatabase,
  DraftParcel,
  DraftRecipient,
} from '#/features/db/schema';
import { editOf, saveParcelEdit } from '#/features/parcels/edit';
import { preselection, settleRecipients } from '#/features/recipient/check';
import { recipientEntries } from '#/features/recipient/entries';
import { learnedRecipientOf } from '#/features/recipient/learning';
import { InlineMatcher } from '#/features/recipient/matcher';
import { reviewOf } from '#/features/review/model';
import { draftFields } from '#/features/scan/confidence';
import {
  contactRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const LEA = personRow({
  id: 'lea',
  firstName: 'Léa',
  lastName: 'Fontaine',
  nameNorm: 'lea fontaine',
});
const PRINTED = 'DJI EUROPE B.V.';

const photo = () => ({
  blob: new Blob(['etiquette'], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});

const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

const chosen = (
  card: Pick<DraftRecipient, 'kind' | 'id' | 'name'>,
): DraftRecipient => ({ ...card, source: 'agent' });

let db: CourrierDatabase;
let files: MemoryFiles;
let matcher: InlineMatcher;

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
  matcher = new InlineMatcher();
  await db.directoryPerson.add(LEA);
  matcher.setEntries(recipientEntries([LEA], []));
});

/** A batch of one label printing `ocrName`, reviewed by `review`, then finished. */
async function scanOnce(
  ocrName: string,
  review: (draft: DraftParcel) => unknown = () => undefined,
  at = NOW,
): Promise<string> {
  const batch = await openBatch(db, at);
  const draft = await addDraft(db, files, batch.id, photo(), at);
  await updateDraft(db, draft.id, { reading: 'read', ocrName });
  await settleRecipients(db, batch.id, matcher);
  const [opened] = await listDrafts(db, batch.id);
  await review(opened!);
  await finishBatch(db, { batchId: batch.id, agentId: 'agent-1', now: at });
  return draft.id;
}

const choose =
  (card: Pick<DraftRecipient, 'kind' | 'id' | 'name'>) =>
  (draft: DraftParcel) =>
    updateDraft(db, draft.id, { recipient: chosen(card) });

const lea = { kind: 'person' as const, id: LEA.id, name: 'Léa Fontaine' };

describe('a card the agent chooses for a printed name', () => {
  it('teaches the name, accents and punctuation aside, ahead of the parcel', async () => {
    await scanOnce(PRINTED, choose(lea));

    expect(await db.recipientAlias.toArray()).toEqual([
      expect.objectContaining({
        nameNorm: 'dji europe bv',
        personId: LEA.id,
        contactId: null,
        confirmations: 1,
      }),
    ]);
    const queued = await db.outbox.orderBy('seq').toArray();
    expect(queued.map((op) => op.entity)).toEqual([
      'recipient_alias',
      'batch',
      'parcel',
    ]);
  });

  it('puts it first on the next label, preselected but never settled alone', async () => {
    await scanOnce(PRINTED, choose(lea));

    const values: number[] = [];
    for (const n of [1, 2, 3, 4]) {
      await scanOnce(
        'Dji Europe B.V',
        async (draft) => {
          expect(draft.recipient ?? null).toBeNull();
          expect(draft.learnedRecipient).toMatchObject({
            kind: 'person',
            id: LEA.id,
            name: 'Léa Fontaine',
          });
          expect(preselection(draft, null)).toMatchObject({ id: LEA.id });
          expect(reviewOf(draft).steps).toContainEqual({ field: 'recipient' });
          const { recipient } = draftFields(draft);
          expect(recipient?.value).toBe('Léa Fontaine');
          values.push(recipient!.confidence);
          await choose(lea)(draft);
        },
        later(n * 60),
      );
    }

    expect(values).toEqual([0.3, 0.5, 0.7, 0.89]);
    expect(await db.recipientAlias.count()).toBe(1);
  });

  it('moves the name to the card chosen instead', async () => {
    const other = contactRow({ name: 'Studio DJI', nameNorm: 'studio dji' });
    await db.contact.add(other);
    await scanOnce(PRINTED, choose(lea));
    await scanOnce(
      PRINTED,
      choose({ kind: 'contact', id: other.id, name: other.name }),
      later(60),
    );

    expect(await db.recipientAlias.toArray()).toEqual([
      expect.objectContaining({
        personId: null,
        contactId: other.id,
        confirmations: 1,
      }),
    ]);
  });

  it('forgets a card that left the directory', async () => {
    await scanOnce(PRINTED, choose(lea));
    await db.directoryPerson.update(LEA.id, { active: false });

    expect(
      await learnedRecipientOf(db, { symbols: [], ocrName: PRINTED }),
    ).toBeNull();
  });
});

describe('a recipient nobody corrected', () => {
  it('teaches nothing from a name that already spells the card, nor from a silent match', async () => {
    await scanOnce('LEA FONTAINE', choose(lea));
    const batch = await openBatch(db, later(60));
    const draft = await addDraft(db, files, batch.id, photo(), later(60));
    await updateDraft(db, draft.id, {
      reading: 'read',
      ocrName: PRINTED,
      recipient: { ...lea, source: 'code' },
    });
    await finishBatch(db, { batchId: batch.id, agentId: 'agent-1' });

    expect(await db.recipientAlias.count()).toBe(0);
  });
});

describe('a contact addressed', () => {
  it('counts as used, which keeps it from the purge, and brings its department', async () => {
    const temp = contactRow({
      usageCount: 2,
      lastUsedAt: null,
      department: 'Intérim',
    });
    await db.contact.add(temp);

    const parcelId = await scanOnce(
      temp.name,
      choose({ kind: 'contact', id: temp.id, name: temp.name }),
    );

    expect(await db.contact.get(temp.id)).toMatchObject({
      usageCount: 3,
      lastUsedAt: NOW,
    });
    expect(await db.parcel.get(parcelId)).toMatchObject({
      contactId: temp.id,
      department: 'Intérim',
    });
  });
});

describe('a recipient set on the parcel’s sheet', () => {
  it('teaches the name the code printed for the card chosen', async () => {
    const parcel = parcelRow({ readName: 'ACME SRL', personId: null });
    await db.parcel.put(parcel);

    await saveParcelEdit(
      db,
      parcel.id,
      { ...editOf(parcel), recipient: { kind: 'person', id: LEA.id } },
      { agentId: 'agent-1', now: NOW },
    );

    expect(await db.recipientAlias.toArray()).toEqual([
      expect.objectContaining({ nameNorm: 'acme srl', personId: LEA.id }),
    ]);
    expect(
      await learnedRecipientOf(db, { symbols: [], ocrName: 'Acme S.R.L.' }),
    ).toMatchObject({ id: LEA.id, confirmations: 1 });
    expect(
      await learnedRecipientOf(db, { symbols: [], ocrName: 'ACME' }),
    ).toBeNull();
  });
});

describe('one name learned apart on two iPhones', () => {
  it('folds the rows into one, so a correction holds everywhere', async () => {
    const louis = personRow({
      id: 'louis',
      firstName: 'Louis',
      lastName: 'Fontaine',
      nameNorm: 'louis fontaine',
    });
    await db.directoryPerson.add(louis);
    const row = (personId: string, confirmations: number) => ({
      id: `${personId}-${confirmations}`,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      nameNorm: 'dji europe bv',
      personId,
      contactId: null,
      confirmations,
    });
    await db.recipientAlias.bulkAdd([row(LEA.id, 3), row(LEA.id, 2)]);

    await scanOnce(
      PRINTED,
      choose({ kind: 'person', id: louis.id, name: 'Louis Fontaine' }),
    );

    const live = (await db.recipientAlias.toArray()).filter(
      (alias) => alias.deletedAt === null,
    );
    expect(live).toEqual([
      expect.objectContaining({ personId: louis.id, confirmations: 1 }),
    ]);
    expect(
      await learnedRecipientOf(db, { symbols: [], ocrName: PRINTED }),
    ).toMatchObject({ id: louis.id });
  });

  it('adds up the confirmations of rows that agree', async () => {
    const row = (id: string, confirmations: number) => ({
      id,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null,
      nameNorm: 'dji europe bv',
      personId: LEA.id,
      contactId: null,
      confirmations,
    });
    await db.recipientAlias.bulkAdd([row('a', 1), row('b', 2)]);

    await scanOnce(PRINTED, choose(lea));

    const live = (await db.recipientAlias.toArray()).filter(
      (alias) => alias.deletedAt === null,
    );
    expect(live).toEqual([
      expect.objectContaining({ id: 'b', confirmations: 4 }),
    ]);
  });
});

describe('a contact chosen on the parcel’s sheet', () => {
  it('counts as used and brings its department', async () => {
    const temp = contactRow({
      usageCount: 1,
      lastUsedAt: null,
      department: 'Intérim',
    });
    await db.contact.add(temp);
    const parcel = parcelRow({ personId: null, contactId: null });
    await db.parcel.put(parcel);

    await saveParcelEdit(
      db,
      parcel.id,
      { ...editOf(parcel), recipient: { kind: 'contact', id: temp.id } },
      { agentId: 'agent-1', now: NOW },
    );

    expect(await db.contact.get(temp.id)).toMatchObject({
      usageCount: 2,
      lastUsedAt: NOW,
    });
    expect((await db.parcel.get(parcel.id))?.department).toBe('Intérim');
  });
});
