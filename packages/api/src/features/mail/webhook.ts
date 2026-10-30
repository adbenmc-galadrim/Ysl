import { createHash, timingSafeEqual } from 'node:crypto';
import { DELIVERY_STATUSES, type DeliveryStatus } from '@repo/contract/mail';
import type { AnyDb } from '@repo/db';
import { emailOutbox, notification } from '@repo/db/schema';
import { logger } from '@repo/shared/logger';
import { and, eq, inArray, isNull, or } from 'drizzle-orm';

/**
 * Brevo gives up on an event at any 5xx and any 4xx but 429, and tries again
 * only after a 429: whatever may pass later answers 429.
 */
export const WEBHOOK_STATUS = {
  done: 200,
  badRequest: 400,
  unauthorized: 401,
  later: 429,
} as const;

export type WebhookStatus =
  (typeof WEBHOOK_STATUS)[keyof typeof WEBHOOK_STATUS];

/** The rest (`soft_bounce`, `deferred`, opens, clicks) says nothing final. */
const FINAL_EVENTS: Partial<Record<string, DeliveryStatus>> = {
  delivered: 'delivered',
  hard_bounce: 'bounced',
  invalid_email: 'bounced',
  blocked: 'bounced',
  spam: 'complained',
  unsubscribed: 'unsubscribed',
};

/** An event may outrun the write of the provider's id after the send. */
const UNKNOWN_RETRY_MS = 5 * 60_000;

type BrevoEvent = { event: string; messageId: string; seconds?: number };

// `email` and `reason` may quote the address: never read, never logged.
function readEvent(body: unknown): BrevoEvent | null {
  const fields = (body ?? {}) as Record<string, unknown>;
  const { event, 'message-id': messageId, ts_event: seconds } = fields;
  if (typeof event !== 'string') return null;
  if (typeof messageId !== 'string' || !messageId) return null;
  return {
    event,
    messageId,
    seconds: typeof seconds === 'number' && seconds > 0 ? seconds : undefined,
  };
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * Brevo signs nothing: it sends the token it was given when the webhook was
 * created. Hashed first, so the comparison does not depend on the length.
 */
export function isWebhookAuthorized(
  authorization: string | undefined,
  token: string,
): boolean {
  return timingSafeEqual(
    digest(authorization ?? ''),
    digest(`Bearer ${token}`),
  );
}

function weakerThan(status: DeliveryStatus): DeliveryStatus[] {
  return DELIVERY_STATUSES.slice(0, DELIVERY_STATUSES.indexOf(status));
}

/**
 * Records what became of a mail. A status only moves forward, so a replay or a
 * late `delivered` writes nothing, and no device is woken up by `server_xid`.
 */
export async function receiveMailEvent(
  db: AnyDb,
  body: unknown,
  { now = new Date() }: { now?: Date } = {},
): Promise<WebhookStatus> {
  const parsed = readEvent(body);
  if (!parsed) return WEBHOOK_STATUS.badRequest;
  const { event, messageId, seconds } = parsed;
  const status = FINAL_EVENTS[event];
  if (!status) return WEBHOOK_STATUS.done;
  const at = seconds ? new Date(seconds * 1_000) : now;

  try {
    const outcome = await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ id: emailOutbox.id })
        .from(emailOutbox)
        .where(eq(emailOutbox.providerMessageId, messageId))
        .limit(1);
      if (!row) return 'unknown';
      const weaker = weakerThan(status);
      const [moved] = await tx
        .update(emailOutbox)
        .set({ deliveryStatus: status, deliveryAt: at })
        .where(
          and(
            eq(emailOutbox.id, row.id),
            or(
              isNull(emailOutbox.deliveryStatus),
              inArray(emailOutbox.deliveryStatus, weaker),
            ),
          ),
        )
        .returning({ notificationId: emailOutbox.notificationId });
      if (moved?.notificationId) {
        await tx
          .update(notification)
          .set({ deliveryStatus: status, deliveryAt: at, updatedAt: now })
          .where(
            and(
              eq(notification.id, moved.notificationId),
              or(
                isNull(notification.deliveryStatus),
                inArray(notification.deliveryStatus, weaker),
              ),
            ),
          );
      }
      return 'known';
    });
    if (outcome === 'known') return WEBHOOK_STATUS.done;
    if (now.getTime() - at.getTime() < UNKNOWN_RETRY_MS) {
      return WEBHOOK_STATUS.later;
    }
    logger.warn({ event }, 'mail webhook: unknown message');
    return WEBHOOK_STATUS.done;
  } catch (error) {
    logger.error({ err: error, event }, 'mail webhook failed');
    return WEBHOOK_STATUS.later;
  }
}
