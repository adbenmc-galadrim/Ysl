import { statusPatch } from '@repo/contract/parcel-status';
import { newId } from '@repo/shared/id';
import { commitLocal, type Upsert } from '#/features/db/commit';
import type {
  CourrierDatabase,
  LocalHandover,
  LocalPickupCode,
} from '#/features/db/schema';
import {
  findActivePickupCode,
  isActiveCode,
  type PickupRefusal,
} from '#/features/handover/pickup-lookup';
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

/**
 * Why a handover was not written: the code no longer opens (a `PickupRefusal`,
 * or `missing` when the URL names none, `mismatch` when it names someone
 * else), the person is `gone` from this iPhone, a ticked parcel is no longer
 * waiting (`stale`), or `nothing` was ticked.
 */
export type HandoverRefusal =
  PickupRefusal | 'missing' | 'mismatch' | 'gone' | 'stale' | 'nothing';

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
};

export type HandoverOptions = {
  agentId: string;
  /** Kept on the handover: the journal names the agent on every iPhone; absent, the journal says « Vous » / « Un agent ». */
  agentName?: string | null;
  now?: Date;
  /**
   * The signature drawn before « Remettre », kept on this iPhone only. A
   * signature that cannot be kept (no OPFS, a full disk) never stops the
   * handover: it goes without one.
   */
  signature?: { proof: ProofInput; files: PhotoFiles };
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

async function openCodeOf(
  db: CourrierDatabase,
  recipient: HandoverRecipient,
  now: Date,
): Promise<LocalPickupCode | undefined> {
  const field = recipient.kind === 'person' ? 'personId' : 'contactId';
  const codes = await db.pickupCode.where(field).equals(recipient.id).toArray();
  return codes.find((code) => isActiveCode(code, now));
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
  { agentId, agentName, now = new Date(), signature }: HandoverOptions,
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
    hasSignature: !!signed,
    hasPhoto: false,
  };
  const closed =
    parcels.length === waiting.length
      ? (checked ?? (await openCodeOf(db, recipient, now)))
      : undefined;

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
    ...(closed
      ? [{ entity: 'pickup_code', row: { ...closed, usedAt: now } } as const]
      : []),
  ];
  try {
    await commitLocal(db, { upserts }, { now });
  } catch (error) {
    if (signed && signature) await deleteProof(db, signature.files, signed);
    throw error;
  }
  return {
    handoverId: handover.id,
    count: parcels.length,
    firstName: person.firstName,
    ...(signature && !signed ? { signatureLost: true } : {}),
  };
}
