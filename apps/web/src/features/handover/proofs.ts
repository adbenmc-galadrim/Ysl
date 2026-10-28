import type { HandoverMethod } from '@repo/contract/handover';
import { newId } from '@repo/shared/id';
import { commitLocal } from '#/features/db/commit';
import type {
  CourrierDatabase,
  HandoverProofKind,
  LocalHandover,
  LocalHandoverProof,
} from '#/features/db/schema';
import type { PhotoFiles } from '#/features/photos/opfs';
import { PHOTOS_DIRECTORY } from '#/features/photos/protocol';

/** A signature drawn or a photo taken, ready to keep. */
export type ProofInput = {
  kind: HandoverProofKind;
  blob: Blob;
  width: number;
  height: number;
};

export function proofFileName(
  proof: Pick<LocalHandoverProof, 'id' | 'kind'>,
): string {
  return `${proof.id}.${proof.kind === 'signature' ? 'png' : 'jpg'}`;
}

/**
 * A handover picked by the name and then signed counts as signed; a QR or a
 * code stays the proof it was, the signature only adds to it.
 */
export function signedMethod(method: HandoverMethod): HandoverMethod {
  return method === 'manuel' ? 'signature' : method;
}

/** The handover as it reads once it carries this proof. */
export function withProof(
  handover: LocalHandover,
  kind: HandoverProofKind,
): LocalHandover {
  return kind === 'signature'
    ? {
        ...handover,
        hasSignature: true,
        method: signedMethod(handover.method),
      }
    : { ...handover, hasPhoto: true };
}

/**
 * The file first, the row second, as for the photos (S4). One proof of each
 * kind per handover: a new photo replaces the one before, whose row and
 * file go once the new one is kept. Nothing is queued for the server (D8).
 */
export async function saveProof(
  db: CourrierDatabase,
  files: PhotoFiles,
  handoverId: string,
  input: ProofInput,
  now = new Date(),
): Promise<LocalHandoverProof> {
  const row: LocalHandoverProof = {
    id: newId(),
    handoverId,
    kind: input.kind,
    path: '',
    width: input.width,
    height: input.height,
    bytes: input.blob.size,
    createdAt: now,
  };
  const name = proofFileName(row);
  row.path = `${PHOTOS_DIRECTORY}/${name}`;
  await files.save(name, input.blob);
  const before = await db.handoverProof
    .where('handoverId')
    .equals(handoverId)
    .filter((proof) => proof.kind === input.kind)
    .toArray();
  await db.handoverProof.put(row);
  for (const old of before) await deleteProof(db, files, old);
  return row;
}

export function readProof(
  files: PhotoFiles,
  proof: LocalHandoverProof,
): Promise<Blob> {
  return files.read(proofFileName(proof));
}

/** The row first, so a crash in between leaves an orphan file, swept later. */
export async function deleteProof(
  db: CourrierDatabase,
  files: PhotoFiles,
  proof: LocalHandoverProof,
): Promise<void> {
  await db.handoverProof.delete(proof.id);
  await files.remove(proofFileName(proof));
}

/** The proofs of a handover this iPhone holds, by kind. */
export async function proofsOf(
  db: CourrierDatabase,
  handoverId: string,
): Promise<Partial<Record<HandoverProofKind, LocalHandoverProof>>> {
  const rows = await db.handoverProof
    .where('handoverId')
    .equals(handoverId)
    .toArray();
  return Object.fromEntries(rows.map((row) => [row.kind, row]));
}

/** Why a proof was not added: the handover is not here, or was cancelled. */
export class HandoverProofRefusedError extends Error {
  constructor(readonly reason: 'gone' | 'cancelled') {
    super(`Handover proof refused: ${reason}`);
    this.name = 'HandoverProofRefusedError';
  }
}

/**
 * « Ajouter une signature » or « Ajouter une photo », once the handover is
 * written: the file is kept here, and the handover says it carries one —
 * the only part that goes to the server. A cancelled handover takes none.
 */
export async function addHandoverProof(
  db: CourrierDatabase,
  files: PhotoFiles,
  handoverId: string,
  input: ProofInput,
  { now = new Date() }: { now?: Date } = {},
): Promise<LocalHandoverProof> {
  const current = await db.handover.get(handoverId);
  if (!current || current.deletedAt) {
    throw new HandoverProofRefusedError('gone');
  }
  if (current.cancelledAt) throw new HandoverProofRefusedError('cancelled');
  const proof = await saveProof(db, files, handoverId, input, now);
  const handover = await db.handover.get(handoverId);
  if (!handover || handover.cancelledAt || handover.deletedAt) {
    await deleteProof(db, files, proof);
    throw new HandoverProofRefusedError(
      handover?.cancelledAt ? 'cancelled' : 'gone',
    );
  }
  const next = withProof(handover, input.kind);
  if (
    next.method !== handover.method ||
    !!next.hasSignature !== !!handover.hasSignature ||
    !!next.hasPhoto !== !!handover.hasPhoto
  ) {
    await commitLocal(
      db,
      { upserts: [{ entity: 'handover', row: next }] },
      { now },
    );
  }
  return proof;
}
