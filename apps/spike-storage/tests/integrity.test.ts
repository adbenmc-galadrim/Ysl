import { describe, expect, it } from 'vitest';
import type { OutboxEntry, Parcel } from '#/storage/db';
import { checkIntegrity, type FileInfo } from '#/storage/integrity';

function parcel(id: number, seq = id): Parcel {
  return {
    id,
    seq,
    createdAt: id,
    photoName: `photo-${id}.jpg`,
    photoBytes: 100 + id,
    photoSha256: `sha-${id}`,
    sessionId: 's',
  };
}

function outboxFor(parcelId: number): OutboxEntry {
  return { id: parcelId, parcelId, createdAt: parcelId, op: 'create' };
}

function fileFor(id: number): FileInfo {
  return { name: `photo-${id}.jpg`, size: 100 + id, sha256: `sha-${id}` };
}

function nominal() {
  return {
    parcels: [parcel(1), parcel(2), parcel(3)],
    outbox: [outboxFor(1), outboxFor(2), outboxFor(3)],
    files: [fileFor(1), fileFor(2), fileFor(3)],
  };
}

function run(data: ReturnType<typeof nominal>) {
  return checkIntegrity(data.parcels, data.outbox, data.files);
}

describe('checkIntegrity', () => {
  it('reports no loss on consistent data', () => {
    const report = run(nominal());

    expect(report.noLoss).toBe(true);
    expect(report.parcels).toBe(3);
    expect(report.files).toBe(3);
  });

  it('reports a parcel whose photo is missing', () => {
    const data = nominal();
    data.files = data.files.filter((file) => file.name !== 'photo-2.jpg');

    const report = run(data);

    expect(report.parcelsWithoutPhoto).toEqual([2]);
    expect(report.noLoss).toBe(false);
  });

  it('counts an orphan photo without calling it a loss', () => {
    const data = nominal();
    data.files.push({ name: 'orphan.jpg', size: 5, sha256: 'x' });

    const report = run(data);

    expect(report.orphanPhotos).toEqual(['orphan.jpg']);
    expect(report.noLoss).toBe(true);
  });

  it('reports a photo with a different size', () => {
    const data = nominal();
    data.files[0] = { ...fileFor(1), size: 1 };

    const report = run(data);

    expect(report.sizeMismatches).toEqual([1]);
    expect(report.noLoss).toBe(false);
  });

  it('reports a photo with a different SHA-256', () => {
    const data = nominal();
    data.files[2] = { ...fileFor(3), sha256: 'other' };

    const report = run(data);

    expect(report.shaMismatches).toEqual([3]);
    expect(report.noLoss).toBe(false);
  });

  it('reports a gap in seq', () => {
    const data = nominal();
    data.parcels[2] = parcel(3, 5);

    const report = run(data);

    expect(report.seqGaps).toEqual([3, 4]);
    expect(report.noLoss).toBe(false);
  });

  it('reports an outbox entry without parcel and a parcel without outbox', () => {
    const data = nominal();
    data.outbox = [outboxFor(1), outboxFor(2), outboxFor(9)];

    const report = run(data);

    expect(report.outboxWithoutParcel).toEqual([9]);
    expect(report.parcelsWithoutOutbox).toEqual([3]);
    expect(report.noLoss).toBe(false);
  });
});
