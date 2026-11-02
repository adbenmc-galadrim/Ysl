import { eventColumns, PARCEL_EVENT_ENTITY } from '@repo/contract/parcel-event';
import type { PickupCopyInput, PickupCopyStatus } from '@repo/contract/mail';
import { PICKUP_PIN_LENGTH, pickupPinHash } from '@repo/contract/pickup';
import type { AnyDb } from '@repo/db';
import {
  emailOutbox,
  event,
  parcel,
  pickupCode,
  pickupSecret,
  type PickupCopy,
} from '@repo/db/schema';
import { newId } from '@repo/shared/id';
import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import type { ParcelScope } from '#lib/access';
import { parcelInScope } from '#lib/access';
import { serverMailEnabled } from '#features/mail/config';
import { openPickupSecret } from '#features/mail/pickup-secret';
import { enqueueEmail } from '#features/mail/queue';
import {
  composeMail,
  copyKey,
  copyLead,
  isPlaced,
  isSuppressed,
  whoOf,
} from '#features/mail/server-send';

/** Four digits are 10 000 hashes: a code a phone drew still names its PIN (§8.7). */
async function pinOf(pinHash: string): Promise<string | null> {
  const space = 10 ** PICKUP_PIN_LENGTH;
  for (let value = 0; value < space; value += 1) {
    const pin = String(value).padStart(PICKUP_PIN_LENGTH, '0');
    if ((await pickupPinHash(pin)) === pinHash) return pin;
  }
  return null;
}

export type SendCopy = PickupCopyInput & {
  organizationId: string;
  agentId: string;
  scope: ParcelScope;
};

/**
 * Sends the recipient's open code to someone else. Nothing is drawn: a new code
 * would withdraw the one the recipient holds. Its own row of the queue, with no
 * notification: its fate moves neither the parcels nor the code.
 */
export async function sendPickupCopy(
  db: AnyDb,
  { organizationId, agentId, scope, parcelIds, address, name }: SendCopy,
  { now = new Date() }: { now?: Date } = {},
): Promise<{ status: PickupCopyStatus }> {
  if (!serverMailEnabled()) return { status: 'off' };
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(parcel)
      .where(
        and(
          eq(parcel.organizationId, organizationId),
          inArray(parcel.id, parcelIds),
          eq(parcel.status, 'notifie'),
          isNull(parcel.deletedAt),
          parcelInScope(scope),
        ),
      );
    const first = rows[0];
    const parcels = rows.filter(isPlaced);
    if (
      !first ||
      parcels.length !== rows.length ||
      rows.length !== new Set(parcelIds).size ||
      rows.some(
        (item) =>
          item.personId !== first.personId ||
          item.contactId !== first.contactId ||
          item.departmentId !== first.departmentId,
      ) ||
      (!first.personId && !first.contactId)
    ) {
      return { status: 'notFound' as const };
    }
    if (await isSuppressed(tx, organizationId, address)) {
      return { status: 'unsubscribed' as const };
    }
    const [code] = await tx
      .select({
        id: pickupCode.id,
        pinHash: pickupCode.pinHash,
        sealed: pickupSecret.sealed,
      })
      .from(pickupCode)
      .leftJoin(pickupSecret, eq(pickupSecret.codeId, pickupCode.id))
      .where(
        and(
          eq(pickupCode.organizationId, organizationId),
          first.personId
            ? eq(pickupCode.personId, first.personId)
            : eq(pickupCode.contactId, first.contactId!),
          eq(pickupCode.departmentId, first.departmentId!),
          isNull(pickupCode.deletedAt),
          isNull(pickupCode.usedAt),
          gt(pickupCode.expiresAt, now),
        ),
      )
      // Holds `drawCode` and another copy off the list of holders until this one commits.
      .for('update', { of: pickupCode });
    if (!code) return { status: 'noCode' as const };
    const clear = code.sealed ? openPickupSecret(code.id, code.sealed) : null;
    const pin = clear?.pin ?? (await pinOf(code.pinHash));
    if (!pin) return { status: 'noCode' as const };
    const who = await whoOf(tx, first, parcels);
    const mail = await composeMail(
      tx,
      { organizationId, preparedBy: agentId, templateId: null },
      parcels,
      who,
      { pin, token: clear?.token ?? null },
      'avis',
      now,
      copyLead(name, who.name),
    );
    // A copy that failed told nobody: it may be asked again.
    const key = copyKey(code.id, address);
    await tx
      .delete(emailOutbox)
      .where(
        and(
          eq(emailOutbox.idempotencyKey, key),
          eq(emailOutbox.status, 'failed'),
        ),
      );
    const { created } = await enqueueEmail(tx, {
      idempotencyKey: key,
      organizationId,
      to: address,
      toName: name,
      ...mail,
      pickupCodeId: code.id,
    });
    if (!created) return { status: 'already' as const };
    const [held] = await tx
      .select({ copiedTo: pickupSecret.copiedTo })
      .from(pickupSecret)
      .where(eq(pickupSecret.codeId, code.id));
    const copiedTo: PickupCopy[] = [
      ...(held?.copiedTo ?? []).filter(
        (copy) => copy.address.toLowerCase() !== address.toLowerCase(),
      ),
      { address, name },
    ];
    await tx
      .insert(pickupSecret)
      .values({ codeId: code.id, copiedTo })
      .onConflictDoUpdate({
        target: pickupSecret.codeId,
        set: { copiedTo },
      });
    await tx.insert(event).values(
      parcels.map((item) => ({
        id: newId(),
        organizationId,
        createdAt: now,
        updatedAt: now,
        entity: PARCEL_EVENT_ENTITY,
        entityId: item.id,
        actorId: agentId,
        at: now,
        ...eventColumns({ type: 'parcel.copied', to: name }),
      })),
    );
    return { status: clear ? ('qr' as const) : ('pin' as const) };
  });
}
