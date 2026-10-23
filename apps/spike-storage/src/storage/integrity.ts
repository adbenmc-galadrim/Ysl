import type { OutboxEntry, Parcel, SpikeDatabase } from '#/storage/db';
import { listPhotos, readPhoto } from '#/storage/opfs';
import { sha256Hex } from '#/storage/photo';

export type FileInfo = { name: string; size: number; sha256?: string };

export type IntegrityReport = {
  parcels: number;
  files: number;
  parcelsWithoutPhoto: number[];
  orphanPhotos: string[];
  sizeMismatches: number[];
  shaMismatches: number[];
  seqGaps: number[];
  outboxWithoutParcel: number[];
  parcelsWithoutOutbox: number[];
  noLoss: boolean;
};

export function checkIntegrity(
  parcels: readonly Parcel[],
  outbox: readonly OutboxEntry[],
  files: readonly FileInfo[],
): IntegrityReport {
  const filesByName = new Map(files.map((file) => [file.name, file]));
  const photoNames = new Set(parcels.map((parcel) => parcel.photoName));
  const parcelIds = new Set(parcels.map((parcel) => parcel.id));
  const outboxParcelIds = new Set(outbox.map((entry) => entry.parcelId));
  const seqs = new Set(parcels.map((parcel) => parcel.seq));

  const parcelsWithoutPhoto: number[] = [];
  const sizeMismatches: number[] = [];
  const shaMismatches: number[] = [];
  for (const parcel of parcels) {
    const file = filesByName.get(parcel.photoName);
    if (!file) {
      parcelsWithoutPhoto.push(parcel.id);
    } else if (file.size !== parcel.photoBytes) {
      sizeMismatches.push(parcel.id);
    } else if (file.sha256 !== undefined && file.sha256 !== parcel.photoSha256) {
      shaMismatches.push(parcel.id);
    }
  }

  const seqGaps: number[] = [];
  const maxSeq = Math.max(0, ...seqs);
  for (let seq = 1; seq <= maxSeq; seq += 1) {
    if (!seqs.has(seq)) seqGaps.push(seq);
  }

  const orphanPhotos = files
    .filter((file) => !photoNames.has(file.name))
    .map((file) => file.name);
  const outboxWithoutParcel = outbox
    .filter((entry) => !parcelIds.has(entry.parcelId))
    .map((entry) => entry.id);
  const parcelsWithoutOutbox = parcels
    .filter((parcel) => !outboxParcelIds.has(parcel.id))
    .map((parcel) => parcel.id);

  return {
    parcels: parcels.length,
    files: files.length,
    parcelsWithoutPhoto,
    orphanPhotos,
    sizeMismatches,
    shaMismatches,
    seqGaps,
    outboxWithoutParcel,
    parcelsWithoutOutbox,
    noLoss:
      parcelsWithoutPhoto.length === 0 &&
      sizeMismatches.length === 0 &&
      shaMismatches.length === 0 &&
      seqGaps.length === 0 &&
      outboxWithoutParcel.length === 0 &&
      parcelsWithoutOutbox.length === 0,
  };
}

export async function runIntegrityCheck(
  db: SpikeDatabase,
): Promise<IntegrityReport> {
  const { parcels, outbox } = await db.transaction(
    'r',
    db.parcels,
    db.outbox,
    async () => ({
      parcels: await db.parcels.toArray(),
      outbox: await db.outbox.toArray(),
    }),
  );
  const stored = await listPhotos();
  const expected = new Map(parcels.map((parcel) => [parcel.photoName, parcel]));
  const files: FileInfo[] = [];
  for (const { name, size } of stored) {
    const parcel = expected.get(name);
    if (parcel?.photoBytes !== size) {
      files.push({ name, size });
    } else {
      files.push({ name, size, sha256: await sha256Hex(await readPhoto(name)) });
    }
  }
  return checkIntegrity(parcels, outbox, files);
}
