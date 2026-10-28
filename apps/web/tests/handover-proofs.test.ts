import 'fake-indexeddb/auto';
import { readParcelEvent } from '@repo/contract/parcel-event';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CourrierDatabase,
  LocalDirectoryPerson,
  LocalParcel,
} from '#/features/db/schema';
import {
  addHandoverProof,
  HandoverProofRefusedError,
  type ProofInput,
  proofsOf,
  readProof,
} from '#/features/handover/proofs';
import { recordHandover } from '#/features/handover/record-handover';
import type { RemiseColisSearch } from '#/features/handover/route';
import { sweepOrphanPhotos } from '#/features/photos/store';
import {
  handoverRow,
  NOW,
  openTestDatabase,
  parcelRow,
  personRow,
} from './helpers/local-rows';
import { MemoryFiles } from './helpers/memory-files';

const LATER = new Date(NOW.getTime() + 5 * 60 * 1000);
const AGENT = { agentId: 'agent-1', agentName: 'Karim Benali' };
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

const signature = (): ProofInput => ({
  kind: 'signature',
  blob: new Blob([PNG_BYTES], { type: 'image/png' }),
  width: 560,
  height: 220,
});
const photo = (text = 'photo'): ProofInput => ({
  kind: 'photo',
  blob: new Blob([text], { type: 'image/jpeg' }),
  width: 1600,
  height: 1200,
});

let db: CourrierDatabase;
let files: MemoryFiles;
let nora: LocalDirectoryPerson;
let parcels: LocalParcel[];

beforeEach(async () => {
  db = await openTestDatabase();
  files = new MemoryFiles();
  nora = personRow({ firstName: 'Nora', lastName: 'Haddad' });
  parcels = [
    parcelRow({ personId: nora.id, status: 'notifie', notifiedAt: NOW }),
    parcelRow({ personId: nora.id }),
  ];
  await db.directoryPerson.put(nora);
  await db.parcel.bulkPut(parcels);
});

const byName = (): RemiseColisSearch & { parcelIds: string[] } => ({
  kind: 'person',
  id: nora.id,
  via: 'manuel',
  at: NOW.getTime(),
  parcelIds: parcels.map((parcel) => parcel.id),
});

/** Every value an outbox op carries, flattened, to look for proof bytes. */
async function outboxText(): Promise<string> {
  const ops = await db.outbox.toArray();
  return JSON.stringify(ops, (_key, value: unknown) =>
    value instanceof Blob ? '[Blob]' : value,
  );
}

describe('recordHandover with a signature', () => {
  it('hands over without a signature, as before: no proof, no flag', async () => {
    const done = await recordHandover(db, byName(), { ...AGENT, now: LATER });

    const handover = await db.handover.get(done.handoverId);
    expect(handover).toMatchObject({
      method: 'manuel',
      hasSignature: false,
      hasPhoto: false,
    });
    expect(await db.handoverProof.count()).toBe(0);
    expect(done.signatureLost).toBeUndefined();
  });

  it('counts a handover picked by the name and signed as signed, the file kept here', async () => {
    const done = await recordHandover(db, byName(), {
      ...AGENT,
      now: LATER,
      signature: { proof: signature(), files },
    });

    expect(await db.handover.get(done.handoverId)).toMatchObject({
      method: 'signature',
      hasSignature: true,
    });
    const { signature: kept } = await proofsOf(db, done.handoverId);
    expect(kept).toMatchObject({ kind: 'signature', createdAt: LATER });
    expect(kept!.path).toBe(`photos/${kept!.id}.png`);
    const blob = await readProof(files, kept!);
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(PNG_BYTES);
    const events = await db.event.toArray();
    expect(
      events.map((event) => readParcelEvent(event.type, event.detail)),
    ).toEqual(
      parcels.map(() => ({
        type: 'parcel.delivered',
        handoverId: done.handoverId,
        method: 'signature',
      })),
    );
  });

  it('still hands over when the signature cannot be kept, and says so', async () => {
    files.failNextSave = true;
    const done = await recordHandover(db, byName(), {
      ...AGENT,
      now: LATER,
      signature: { proof: signature(), files },
    });

    expect(done.signatureLost).toBe(true);
    expect(await db.handover.get(done.handoverId)).toMatchObject({
      method: 'manuel',
      hasSignature: false,
    });
    expect(await db.handoverProof.count()).toBe(0);
    expect(
      (await db.parcel.bulkGet(parcels.map((p) => p.id))).map((p) => p?.status),
    ).toEqual(['remis', 'remis']);
  });

  it('keeps no proof when the handover is refused', async () => {
    await expect(
      recordHandover(
        db,
        { ...byName(), parcelIds: [] },
        { ...AGENT, signature: { proof: signature(), files } },
      ),
    ).rejects.toMatchObject({ reason: 'nothing' });
    expect(await db.handoverProof.count()).toBe(0);
    expect(files.files.size).toBe(0);
  });
});

describe('addHandoverProof', () => {
  it('signs a handover after the fact: flag, method, one upsert queued', async () => {
    const done = await recordHandover(db, byName(), { ...AGENT, now: NOW });
    const before = await db.outbox.count();

    await addHandoverProof(db, files, done.handoverId, signature(), {
      now: LATER,
    });

    expect(await db.handover.get(done.handoverId)).toMatchObject({
      method: 'signature',
      hasSignature: true,
      hasPhoto: false,
      updatedAt: LATER,
    });
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(before + 1);
    expect(ops.at(-1)).toMatchObject({
      entity: 'handover',
      entityId: done.handoverId,
      type: 'upsert',
      patch: { hasSignature: true, method: 'signature' },
    });
  });

  it('keeps the QR or the code as the method of a signed handover', async () => {
    const handover = handoverRow({ method: 'qr', parcelIds: [parcels[0]!.id] });
    await db.handover.put(handover);

    await addHandoverProof(db, files, handover.id, signature(), { now: LATER });

    expect(await db.handover.get(handover.id)).toMatchObject({
      method: 'qr',
      hasSignature: true,
    });
  });

  it('keeps one photo per handover: a new one replaces the one before', async () => {
    const handover = handoverRow({ parcelIds: [parcels[0]!.id] });
    await db.handover.put(handover);

    const first = await addHandoverProof(db, files, handover.id, photo('a'));
    const second = await addHandoverProof(db, files, handover.id, photo('b'));

    expect(await db.handoverProof.toArray()).toEqual([second]);
    expect([...files.files.keys()]).toEqual([`${second.id}.jpg`]);
    expect(first.id).not.toBe(second.id);
    expect(await db.handover.get(handover.id)).toMatchObject({
      hasPhoto: true,
      hasSignature: false,
    });
    expect(
      (await db.outbox.toArray()).filter((op) => op.entity === 'handover'),
    ).toHaveLength(1);
  });

  it('keeps both flags when a signature and a photo are added at the same moment', async () => {
    const handover = handoverRow({ method: 'manuel' });
    await db.handover.put(handover);

    await Promise.all([
      addHandoverProof(db, files, handover.id, signature()),
      addHandoverProof(db, files, handover.id, photo()),
    ]);

    expect(await db.handover.get(handover.id)).toMatchObject({
      method: 'signature',
      hasSignature: true,
      hasPhoto: true,
    });
    expect((await db.outbox.toArray()).at(-1)?.patch).toMatchObject({
      hasSignature: true,
      hasPhoto: true,
    });
  });

  it('refuses a cancelled handover, and one no longer here, keeping nothing', async () => {
    const cancelled = handoverRow({ cancelledAt: NOW });
    await db.handover.put(cancelled);

    await expect(
      addHandoverProof(db, files, cancelled.id, signature()),
    ).rejects.toEqual(new HandoverProofRefusedError('cancelled'));
    await expect(
      addHandoverProof(db, files, 'missing', signature()),
    ).rejects.toMatchObject({ reason: 'gone' });
    expect(await db.handoverProof.count()).toBe(0);
    expect(files.files.size).toBe(0);
    expect(await db.outbox.count()).toBe(0);
  });
});

describe('what leaves the iPhone (D8)', () => {
  it('pushes the flags of a signed and photographed handover, never a byte of the proofs', async () => {
    const done = await recordHandover(db, byName(), {
      ...AGENT,
      now: NOW,
      signature: { proof: signature(), files },
    });
    await addHandoverProof(db, files, done.handoverId, photo('JPEGBYTES'), {
      now: LATER,
    });

    const ops = await db.outbox.toArray();
    expect(ops.map((op) => op.entity)).not.toContain('handover_proof');
    const text = await outboxText();
    expect(text).not.toContain('[Blob]');
    expect(text).not.toContain('data:image');
    expect(text).not.toContain('JPEGBYTES');
    const proofIds = (await db.handoverProof.toArray()).map((row) => row.id);
    for (const id of proofIds) expect(text).not.toContain(id);
    expect(ops.at(-1)?.patch).toMatchObject({
      hasSignature: true,
      hasPhoto: true,
      method: 'signature',
    });
  });
});

describe('sweepOrphanPhotos', () => {
  it('keeps the files of the handover proofs, removes a proof file without its row', async () => {
    const handover = handoverRow();
    await db.handover.put(handover);
    const kept = await addHandoverProof(db, files, handover.id, signature());
    await files.save('lost.png', new Blob(['x']));

    const removed = await sweepOrphanPhotos(
      db,
      files,
      new Date(NOW.getTime() + 2 * 60 * 60 * 1000),
    );

    expect(removed).toEqual(['lost.png']);
    expect(files.files.has(`${kept.id}.png`)).toBe(true);
  });
});
