import type { OutboxEntry, Parcel, SpikeDatabase } from '#/storage/db';
import { listPhotos, readPhoto } from '#/storage/opfs';
import { seqFromPhotoName, sha256Hex } from '#/storage/photo';
import type { Registry } from '#/storage/registry';

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
  expectedParcels: number | undefined;
  expectedLastSeq: number | undefined;
  missingParcels: number;
  tailLost: boolean;
  lostOrphans: string[];
  registryInconsistent: boolean;
  emptyStorage: boolean;
  noLoss: boolean;
};

export function checkIntegrity(
  parcels: readonly Parcel[],
  outbox: readonly OutboxEntry[],
  files: readonly FileInfo[],
  registry: Registry | undefined,
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
    } else if (
      file.sha256 !== undefined &&
      file.sha256 !== parcel.photoSha256
    ) {
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

  const expectedParcels = registry?.count;
  const missingParcels = Math.max(0, (expectedParcels ?? 0) - parcels.length);
  const tailLost = registry !== undefined && maxSeq < registry.lastSeq;
  const lostOrphans = orphanPhotos.filter((name) => {
    const seq = seqFromPhotoName(name);
    return (
      registry !== undefined &&
      seq !== undefined &&
      seq <= registry.lastSeq &&
      !seqs.has(seq)
    );
  });
  const storageEmpty = parcels.length === 0 && files.length === 0;
  const registryInconsistent = registry
    ? registry.count > 0 && parcels.length === 0
    : !storageEmpty || outbox.length > 0;
  const emptyStorage = storageEmpty && (registry?.count ?? 0) === 0;

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
    expectedParcels,
    expectedLastSeq: registry?.lastSeq,
    missingParcels,
    tailLost,
    lostOrphans,
    registryInconsistent,
    emptyStorage,
    noLoss:
      parcelsWithoutPhoto.length === 0 &&
      sizeMismatches.length === 0 &&
      shaMismatches.length === 0 &&
      seqGaps.length === 0 &&
      outboxWithoutParcel.length === 0 &&
      parcelsWithoutOutbox.length === 0 &&
      missingParcels === 0 &&
      !tailLost &&
      lostOrphans.length === 0 &&
      !registryInconsistent,
  };
}

export async function runIntegrityCheck(
  db: SpikeDatabase,
  registry: Registry | undefined,
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
      files.push({
        name,
        size,
        sha256: await sha256Hex(await readPhoto(name)),
      });
    }
  }
  return checkIntegrity(parcels, outbox, files, registry);
}
