import {
  resolveRetention,
  type ResolvedRetention,
} from '@repo/contract/company-settings';
import { cutoff, RETENTION } from '@repo/contract/retention';
import type {
  CourrierDatabase,
  LocalHandover,
  LocalHandoverProof,
  LocalParcel,
  LocalPhoto,
} from '#/features/db/schema';
import { deleteProof } from '#/features/handover/proofs';
import type { PhotoFiles } from '#/features/photos/opfs';
import { deletePhoto, ORPHAN_GRACE_MS } from '#/features/photos/store';
import { readCompanySettings } from '#/features/settings/company-settings';

export type LocalPurgeReport = {
  at: Date;
  photos: number;
  extractions: number;
  /** Signatures and photos of handovers; absent on a report before YSL-75. */
  proofs?: number;
};

/** `sync_state` key of the last local purge (`LocalPurgeReport`). */
export const LOCAL_PURGE_KEY = 'lastLocalPurge';

/** When the parcel left the counter: handed over, or returned to its sender. */
function settledAt(parcel: LocalParcel): Date | null {
  if (parcel.status === 'remis') return parcel.deliveredAt;
  if (parcel.status === 'retourne') return parcel.updatedAt;
  return null;
}

type PhotoContext = {
  parcels: Map<string, LocalParcel>;
  drafts: Set<string>;
  pending: Set<string>;
  now: Date;
  /** The company's durations; without any, those of §9.2. */
  retention?: ResolvedRetention;
};

/**
 * Whether a photo is past its time (§9.2). A label or damage photo goes 7
 * days after its parcel left the counter, once the server holds the parcel
 * (no change of it still queued). A `signature` photo row goes after 12
 * months; none is written since the handover's signatures moved to
 * `handover_proof` (YSL-75, `proofExpired`), the rule stays for any row an
 * older build might hold. A photo whose parcel is gone from this iPhone, purged or deleted, goes once it is
 * older than the orphan grace; one still waiting in a batch is kept.
 */
export function photoExpired(
  photo: LocalPhoto,
  { parcels, drafts, pending, now, retention = RETENTION }: PhotoContext,
): boolean {
  if (photo.kind === 'signature') {
    return photo.createdAt < cutoff(now, retention.signature);
  }
  if (photo.parcelId === null) return false;
  const parcel = parcels.get(photo.parcelId);
  if (!parcel || parcel.deletedAt) {
    if (drafts.has(photo.parcelId)) return false;
    return now.getTime() - photo.createdAt.getTime() >= ORPHAN_GRACE_MS;
  }
  const settled = settledAt(parcel);
  return (
    settled !== null &&
    settled < cutoff(now, retention.photo) &&
    !pending.has(parcel.id)
  );
}

type ProofContext = {
  handovers: Map<string, LocalHandover>;
  pending: Set<string>;
  now: Date;
  retention?: ResolvedRetention;
};

/**
 * Whether a handover's proof is past its time (§9.2): a signature 12 months
 * after it was drawn, a photo 7 days after the handover once the server
 * holds it. A proof whose handover is gone from this iPhone, purged or
 * deleted, goes once older than the orphan grace (it may belong to a
 * handover being written).
 */
export function proofExpired(
  proof: LocalHandoverProof,
  { handovers, pending, now, retention = RETENTION }: ProofContext,
): boolean {
  const handover = handovers.get(proof.handoverId);
  if (!handover || handover.deletedAt) {
    return now.getTime() - proof.createdAt.getTime() >= ORPHAN_GRACE_MS;
  }
  if (proof.kind === 'signature') {
    return proof.createdAt < cutoff(now, retention.signature);
  }
  return (
    handover.at < cutoff(now, retention.photo) && !pending.has(handover.id)
  );
}

async function purgeProofs(
  db: CourrierDatabase,
  files: PhotoFiles,
  now: Date,
  retention: ResolvedRetention,
): Promise<number> {
  const proofs = await db.handoverProof.toArray();
  if (!proofs.length) return 0;
  const found = await db.handover.bulkGet([
    ...new Set(proofs.map((proof) => proof.handoverId)),
  ]);
  const handovers = new Map(
    found.flatMap((row) => (row ? [[row.id, row]] : [])),
  );
  const queued = await db.outbox
    .where('state')
    .equals('queued')
    .filter((op) => op.entity === 'handover')
    .toArray();
  const context = {
    handovers,
    pending: new Set(queued.map((op) => op.entityId)),
    now,
    retention,
  };
  let removed = 0;
  for (const proof of proofs) {
    if (!proofExpired(proof, context)) continue;
    await deleteProof(db, files, proof);
    removed += 1;
  }
  return removed;
}

/**
 * The purge of this iPhone (§9.2, with the company's durations): photos and
 * handover proofs past their time, and what the reader made of labels past
 * theirs or once their parcel is gone. Rows
 * the server purged leave with the pull; this covers what never goes to
 * the server. Photos go one by one, row then file: a crash in between
 * leaves an orphan file, which the launch sweep removes.
 */
export async function purgeLocal(
  db: CourrierDatabase,
  files: PhotoFiles | null,
  now = new Date(),
): Promise<LocalPurgeReport> {
  const retention = resolveRetention(
    (await readCompanySettings(db)).retention,
  );
  const extractionCut = cutoff(now, retention.extraction);
  // One transaction: a batch finished meanwhile writes its parcels and their
  // readings together, never a reading this purge would take for an orphan.
  const extractions = await db.transaction(
    'rw',
    db.parcel,
    db.extraction,
    async () => {
      const parcelIds = new Set(await db.parcel.toCollection().primaryKeys());
      const expired = await db.extraction
        .filter(
          (row) =>
            row.createdAt < extractionCut || !parcelIds.has(row.parcelId),
        )
        .primaryKeys();
      await db.extraction.bulkDelete(expired);
      return expired;
    },
  );

  let photos = 0;
  let proofs = 0;
  if (files) {
    proofs = await purgeProofs(db, files, now, retention);
    const stored = await db.photo
      .filter((row) => row.parcelId !== null)
      .toArray();
    const ids = [...new Set(stored.map((row) => row.parcelId!))];
    const found = await db.parcel.bulkGet(ids);
    const parcels = new Map(
      found.flatMap((parcel) => (parcel ? [[parcel.id, parcel]] : [])),
    );
    const drafts = new Set(await db.draftParcel.toCollection().primaryKeys());
    const queued = await db.outbox
      .where('state')
      .equals('queued')
      .filter((op) => op.entity === 'parcel')
      .toArray();
    const pending = new Set(queued.map((op) => op.entityId));
    const context = { parcels, drafts, pending, now, retention };
    for (const photo of await db.photo.toArray()) {
      if (!photoExpired(photo, context)) continue;
      await deletePhoto(db, files, photo.id);
      photos += 1;
    }
  }

  const report = {
    at: now,
    photos,
    extractions: extractions.length,
    proofs,
  };
  await db.syncState.put({ key: LOCAL_PURGE_KEY, value: report });
  return report;
}
