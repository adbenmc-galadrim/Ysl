import { missingHandoverSteps } from '@repo/contract/operating-profile';
import { statusPatch } from '@repo/contract/parcel-status';
import { newId } from '@repo/shared/id';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalHandover,
  LocalPickupCode,
  LocalParcel,
} from '#/features/db/schema';
import {
  findActivePickupCode,
  isActiveCode,
  type PickupRefusal,
} from '#/features/handover/pickup-lookup';
import { departmentOfParcel } from '#/features/mail/recipients';
import {
  deleteProof,
  type ProofInput,
  saveProof,
  signedMethod,
} from '#/features/handover/proofs';
import { collectorName } from '#/features/handover/collector';
import { loadHandoverPerson } from '#/features/handover/recipient';
import type { RemiseColisSearch } from '#/features/handover/route';
import {
  type HandoverRecipient,
  listWaitingParcels,
} from '#/features/handover/waiting';
import { parcelEvent } from '#/features/parcels/events';
import type { PhotoFiles } from '#/features/photos/opfs';
import { readOperatingProfile } from '#/features/settings/operating-profile';

/**
 * Why a handover was not written: the code no longer opens (a `PickupRefusal`,
 * or `missing` when the URL names none, `mismatch` when it names someone
 * else), the person is `gone` from this iPhone, a ticked parcel is no longer
 * waiting (`stale`), `nothing` was ticked, or a step the profile requires is
 * missing (`steps`), a signature or a photo that could not be kept included.
 */
export type HandoverRefusal =
  | PickupRefusal
  | 'missing'
  | 'mismatch'
  | 'gone'
  | 'stale'
  | 'nothing'
  | 'steps';

export class HandoverRefusedError extends Error {
  constructor(readonly reason: HandoverRefusal) {
    super(`Handover refused: ${reason}`);
    this.name = 'HandoverRefusedError';
  }
}

export type HandoverInput = RemiseColisSearch & {
  /** The parcels ticked on the screen. */
  parcelIds: readonly string[];
  /** Someone else collects for the recipient; their proof still stands for them. */
  delegateName?: string | null;
  /** Every parcel handed over was scanned against the list. */
  hasScan?: boolean;
};

export type HandoverOptions = {
  agentId: string;
  /** Kept on the handover: the journal names the agent on every iPhone; absent, the journal says « Vous » / « Un agent ». */
  agentName?: string | null;
  now?: Date;
  /**
   * The signature drawn before « Remettre », kept on this iPhone only. A
   * signature that cannot be kept (no OPFS, a full disk) stops the handover
   * only when the profile requires one; otherwise it goes without.
   */
  signature?: { proof: ProofInput; files: PhotoFiles };
  /** The photo a profile asks for before « Remettre », kept the same way. */
  photo?: { proof: ProofInput; files: PhotoFiles };
};

export type HandoverDone = {
  handoverId: string;
  count: number;
  firstName: string;
  /** The signature asked for could not be kept: the handover went without. */
  signatureLost?: boolean;
};

const holds = (code: LocalPickupCode, { kind, id }: HandoverRecipient) =>
  kind === 'person' ? code.personId === id : code.contactId === id;

/**
 * The QR or the code of the URL, checked again against this iPhone right
 * before the write: `via` and `code` are only what the URL says, and the
 * code may have expired or been replaced since the screen opened.
 */
export async function recheckCode(
  db: CourrierDatabase,
  search: RemiseColisSearch,
  now: Date,
): Promise<LocalPickupCode> {
  if (!search.code) throw new HandoverRefusedError('missing');
  const row = await db.pickupCode.get(search.code);
  if (!row) throw new HandoverRefusedError('unknown');
  const match = await findActivePickupCode(db, 'token', row.tokenHash, now);
  if (match.status !== 'active') throw new HandoverRefusedError(match.status);
  if (match.code.id !== row.id || !holds(row, search)) {
    throw new HandoverRefusedError('mismatch');
  }
  return row;
}

/**
 * What this QR or code opens at the counter: the recipient's waiting parcels
 * in its department only (§3.7.9). A code of before has none and opens all.
 */
export async function listParcelsOfCode(
  db: CourrierDatabase,
  recipient: HandoverRecipient,
  codeId: string | undefined,
): Promise<LocalParcel[]> {
  const parcels = await listWaitingParcels(db, recipient);
  const code = codeId ? await db.pickupCode.get(codeId) : undefined;
  if (!code?.departmentId) return parcels;
  const home =
    recipient.kind === 'person'
      ? await db.directoryPerson.get(recipient.id)
      : undefined;
  return parcels.filter((parcel) => {
    const department = departmentOfParcel(parcel, home);
    return !department || department === code.departmentId;
  });
}

async function openCodeOf(
  db: CourrierDatabase,
  recipient: HandoverRecipient,
  departmentId: string | null,
  now: Date,
): Promise<LocalPickupCode | undefined> {
  const field = recipient.kind === 'person' ? 'personId' : 'contactId';
  const codes = await db.pickupCode.where(field).equals(recipient.id).toArray();
  return codes.find(
    (code) =>
      isActiveCode(code, now) && (code.departmentId ?? null) === departmentId,
  );
}

/**
 * A handover by name: the open code of each department where these parcels
 * leave nothing on the shelf.
 */
async function closedCodes(
  db: CourrierDatabase,
  recipient: HandoverRecipient,
  departmentOf: (parcel: LocalParcel) => string | null,
  parcels: readonly LocalParcel[],
  waiting: readonly LocalParcel[],
  now: Date,
): Promise<LocalPickupCode[]> {
  const closed: LocalPickupCode[] = [];
  for (const department of new Set(parcels.map(departmentOf))) {
    const inIt = (parcel: LocalParcel) => departmentOf(parcel) === department;
    if (parcels.filter(inIt).length !== waiting.filter(inIt).length) continue;
    const code = await openCodeOf(db, recipient, department, now);
    if (code) closed.push(code);
  }
  return closed;
}

/**
 * P4 step 4, local first: the handover, each ticked parcel `remis` with its
 * event, and, once nothing is left on the shelf for them, their pickup code
 * closed — in one `commitLocal`, the handover queued before the parcels it
 * lists (the server's guard looks for it). A code with parcels left stays
 * open: the person comes back for them.
 */
export async function recordHandover(
  db: CourrierDatabase,
  input: HandoverInput,
  { agentId, agentName, now = new Date(), signature, photo }: HandoverOptions,
): Promise<HandoverDone> {
  const recipient: HandoverRecipient = { kind: input.kind, id: input.id };
  const person = await loadHandoverPerson(db, recipient);
  if (!person) throw new HandoverRefusedError('gone');
  const checked =
    input.via === 'manuel' ? undefined : await recheckCode(db, input, now);

  if (input.parcelIds.length === 0) throw new HandoverRefusedError('nothing');
  const waiting = await listWaitingParcels(db, recipient);
  const ticked = new Set(input.parcelIds);
  const parcels = waiting.filter((parcel) => ticked.has(parcel.id));
  if (parcels.length !== ticked.size) throw new HandoverRefusedError('stale');
  // A code opens its department only (§3.7.9); one of before has none.
  const home =
    recipient.kind === 'person'
      ? await db.directoryPerson.get(recipient.id)
      : undefined;
  const departmentOf = (parcel: LocalParcel) =>
    departmentOfParcel(parcel, home);
  const ofCode = (parcel: LocalParcel) =>
    !checked?.departmentId ||
    !departmentOf(parcel) ||
    departmentOf(parcel) === checked.departmentId;
  if (!parcels.every(ofCode)) throw new HandoverRefusedError('mismatch');

  const handoverId = newId();
  const signed = signature
    ? await saveProof(
        db,
        signature.files,
        handoverId,
        signature.proof,
        now,
      ).catch((error: unknown) => {
        console.warn('Signature not kept', error);
        return undefined;
      })
    : undefined;
  const pictured = photo
    ? await saveProof(db, photo.files, handoverId, photo.proof, now).catch(
        (error: unknown) => {
          console.warn('Handover photo not kept', error);
          return undefined;
        },
      )
    : undefined;
  const dropProofs = async () => {
    if (signed && signature) await deleteProof(db, signature.files, signed);
    if (pictured && photo) await deleteProof(db, photo.files, pictured);
  };

  const handover: LocalHandover = {
    id: handoverId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    parcelIds: parcels.map((parcel) => parcel.id),
    personId: recipient.kind === 'person' ? recipient.id : null,
    contactId: recipient.kind === 'contact' ? recipient.id : null,
    recipientName: person.name,
    delegateName: collectorName(input.delegateName, person.name),
    method: signed ? signedMethod(input.via) : input.via,
    agentId,
    agentName: agentName?.trim() || null,
    at: now,
    cancelledAt: null,
    cancelReason: null,
    cancelNote: null,
    cancelledByName: null,
    hasSignature: !!signed,
    hasPhoto: !!pictured,
    hasScan: !!input.hasScan,
  };
  const profile = await readOperatingProfile(db);
  if (missingHandoverSteps(profile, handover).length > 0) {
    await dropProofs();
    throw new HandoverRefusedError('steps');
  }
  const closed = checked
    ? parcels.length === waiting.filter(ofCode).length
      ? [checked]
      : []
    : await closedCodes(db, recipient, departmentOf, parcels, waiting, now);

  const upserts: Upsert[] = [
    { entity: 'handover', row: handover },
    ...parcels.map((parcel): Upsert => ({
      entity: 'parcel',
      row: { ...parcel, ...statusPatch(parcel, 'remis', { now, agentId }) },
    })),
    ...parcels.map((parcel) =>
      parcelEvent(
        parcel.id,
        {
          type: 'parcel.delivered',
          handoverId: handover.id,
          method: handover.method,
        },
        { agentId, now },
      ),
    ),
    ...closed.map((code): Upsert => ({
      entity: 'pickup_code',
      row: { ...code, usedAt: now },
    })),
  ];
  try {
    await commitLocal(db, { upserts }, { now });
  } catch (error) {
    await dropProofs();
    throw error;
  }
  return {
    handoverId: handover.id,
    count: parcels.length,
    firstName: person.firstName,
    ...(signature && !signed ? { signatureLost: true } : {}),
  };
}
