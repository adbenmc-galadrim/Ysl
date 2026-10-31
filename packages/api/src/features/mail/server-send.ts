import {
  damageNotice,
  DEFAULT_TEMPLATES,
  mailValues,
  parcelMailLine,
  parcelMailName,
  renderMail,
  replyReference,
} from '@repo/contract/mail';
import { damageForEmail } from '@repo/contract/parcel-damage';
import {
  newPickupToken,
  PICKUP_CODE_TTL_MS,
  PICKUP_PIN_LENGTH,
  pickupPinHash,
  pickupTokenHash,
} from '@repo/contract/pickup';
import { EMPTY_PICKUP, parsePickup } from '@repo/contract/settings';
import type { AnyDb } from '@repo/db';
import {
  contact,
  department,
  departmentMember,
  directoryPerson,
  emailOutbox,
  emailSuppression,
  emailTemplate,
  notification,
  parcel,
  pickupCode,
  setting,
  user,
} from '@repo/db/schema';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { newId } from '@repo/shared/id';
import { logger } from '@repo/shared/logger';
import { randomInt } from 'node:crypto';
import { and, asc, eq, gt, inArray, isNull } from 'drizzle-orm';
import { qrAttachment, qrModules, qrTable } from '#features/mail/qr';
import { enqueueEmail } from '#features/mail/queue';
import {
  parcelsToTell,
  REQUEST_MAX_AGE_MS,
  settleFailed,
} from '#features/mail/settle';

const t = createTranslator(DEFAULT_LOCALE);

const ZONE = 'Europe/Paris';
const BATCH = 20;

type Request = typeof notification.$inferSelect;
type Parcel = typeof parcel.$inferSelect;
type Placed = Parcel & { departmentId: string };

/** A person may still be filed under no department: a code opens one, so none is drawn. */
const isPlaced = (item: Parcel): item is Placed => item.departmentId !== null;

const DAY = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ZONE,
  day: 'numeric',
  month: 'short',
});
const DATE_KEY = new Intl.DateTimeFormat('en-CA', { timeZone: ZONE });
const CLOCK = new Intl.DateTimeFormat('fr-FR', {
  timeZone: ZONE,
  hour: 'numeric',
  minute: '2-digit',
});

function timeOf(date: Date): string {
  const parts = CLOCK.formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? '';
  return `${Number(part('hour'))} h ${part('minute')}`;
}

function parcelLine(item: Parcel, now: Date): string {
  return parcelMailLine(
    item,
    {
      today: DATE_KEY.format(item.receivedAt) === DATE_KEY.format(now),
      time: timeOf(item.receivedAt),
      date: DAY.format(item.receivedAt),
    },
    t,
  );
}

const escapeHtml = (text: string) =>
  text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** The text as it reads in the phone's mail, the reply links shortened, the QR above it. */
export function mailHtml(text: string, token: string): string {
  const lines = text
    .split('\n')
    .map((line) =>
      escapeHtml(line).replace(
        /mailto:[^\s<]+/g,
        (url) => `<a href="${url}">${escapeHtml(t('mail.server.reply'))}</a>`,
      ),
    );
  return [
    '<div style="font-family:-apple-system,Segoe UI,Arial,sans-serif;font-size:15px;line-height:22px;color:#1c1c1e">',
    `<p>${escapeHtml(t('mail.server.qr'))}</p>`,
    qrTable(qrModules(token)),
    `<p>${lines.join('<br>')}</p>`,
    '</div>',
  ].join('');
}

async function drawPin(
  tx: AnyDb,
  organizationId: string,
  now: Date,
): Promise<string> {
  const live = await tx
    .select({ pinHash: pickupCode.pinHash })
    .from(pickupCode)
    .where(
      and(
        eq(pickupCode.organizationId, organizationId),
        isNull(pickupCode.deletedAt),
        isNull(pickupCode.usedAt),
        gt(pickupCode.expiresAt, now),
      ),
    );
  const taken = new Set(live.map((row) => row.pinHash));
  const space = 10 ** PICKUP_PIN_LENGTH;
  let pin = '';
  for (let tries = 0; tries < space; tries += 1) {
    pin = String(randomInt(space)).padStart(PICKUP_PIN_LENGTH, '0');
    if (!taken.has(await pickupPinHash(pin))) break;
  }
  return pin;
}

/**
 * Makes this code the recipient's in the parcels' department, the only one it
 * opens (§3.7.9). Each mail draws a new one and takes the former one out: the
 * server holds only hashes, so "the same code" belongs to the phone's mail.
 */
async function drawCode(
  tx: AnyDb,
  row: Request,
  departmentId: string,
  now: Date,
) {
  const mine = await tx
    .select({ id: pickupCode.id })
    .from(pickupCode)
    .where(
      and(
        eq(pickupCode.organizationId, row.organizationId),
        row.personId
          ? eq(pickupCode.personId, row.personId)
          : eq(pickupCode.contactId, row.contactId!),
        eq(pickupCode.departmentId, departmentId),
        isNull(pickupCode.deletedAt),
        isNull(pickupCode.usedAt),
      ),
    );
  if (mine.length > 0) {
    await tx
      .update(pickupCode)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        inArray(
          pickupCode.id,
          mine.map((code) => code.id),
        ),
      );
  }
  const pin = await drawPin(tx, row.organizationId, now);
  const token = newPickupToken();
  const id = newId();
  await tx.insert(pickupCode).values({
    id,
    organizationId: row.organizationId,
    createdAt: now,
    updatedAt: now,
    personId: row.personId,
    contactId: row.personId ? null : row.contactId,
    departmentId,
    tokenHash: await pickupTokenHash(token),
    pinHash: await pickupPinHash(pin),
    expiresAt: new Date(now.getTime() + PICKUP_CODE_TTL_MS),
  });
  return { id, pin, token, replaced: mine[0]?.id ?? null };
}

async function templateOf(tx: AnyDb, row: Request, type: 'avis' | 'relance') {
  const [stored] = await tx
    .select({ subject: emailTemplate.subject, body: emailTemplate.body })
    .from(emailTemplate)
    .where(
      and(
        eq(emailTemplate.organizationId, row.organizationId),
        eq(emailTemplate.ownerId, row.preparedBy),
        eq(emailTemplate.type, type),
        isNull(emailTemplate.deletedAt),
        row.templateId
          ? eq(emailTemplate.id, row.templateId)
          : eq(emailTemplate.isDefault, true),
      ),
    );
  return stored ?? DEFAULT_TEMPLATES[type];
}

async function pickupOf(
  tx: AnyDb,
  organizationId: string,
  departmentId: string,
) {
  const [own] = await tx
    .select({ pickup: department.pickup })
    .from(department)
    .where(eq(department.id, departmentId));
  if (own?.pickup) return parsePickup(own.pickup);
  const [row] = await tx
    .select({ value: setting.value })
    .from(setting)
    .where(
      and(
        eq(setting.organizationId, organizationId),
        eq(setting.key, 'pickup'),
        isNull(setting.deletedAt),
      ),
    );
  return row ? parsePickup(row.value) : EMPTY_PICKUP;
}

/**
 * Where the answers go: to someone of the parcel's department (mockup 16), the
 * oldest account there; a department with no account yet: the agent who validated.
 */
async function replyToOf(
  tx: AnyDb,
  departmentId: string,
  agentEmail: string | null,
): Promise<string | null> {
  const [member] = await tx
    .select({ email: user.email })
    .from(departmentMember)
    .innerJoin(user, eq(user.id, departmentMember.userId))
    .where(eq(departmentMember.departmentId, departmentId))
    .orderBy(asc(user.createdAt))
    .limit(1);
  return member?.email ?? agentEmail;
}

async function isSuppressed(
  tx: AnyDb,
  organizationId: string,
  address: string,
): Promise<boolean> {
  const [row] = await tx
    .select({ email: emailSuppression.email })
    .from(emailSuppression)
    .where(
      and(
        eq(emailSuppression.organizationId, organizationId),
        eq(emailSuppression.email, address.toLowerCase()),
      ),
    );
  return row !== undefined;
}

type Who = {
  firstName: string | null;
  lastName: string | null;
  name: string;
  addressOf: (item: Parcel) => string | null;
};

async function whoOf(tx: AnyDb, row: Request, parcels: Parcel[]): Promise<Who> {
  const personIds = [
    ...new Set(
      [row.personId, ...parcels.map((item) => item.personId)].filter(
        (id): id is string => id !== null,
      ),
    ),
  ];
  const contactIds = [
    ...new Set(
      [row.contactId, ...parcels.map((item) => item.contactId)].filter(
        (id): id is string => id !== null,
      ),
    ),
  ];
  const people = personIds.length
    ? await tx
        .select()
        .from(directoryPerson)
        .where(inArray(directoryPerson.id, personIds))
    : [];
  const contacts = contactIds.length
    ? await tx.select().from(contact).where(inArray(contact.id, contactIds))
    : [];
  const person = people.find((item) => item.id === row.personId);
  const card = contacts.find((item) => item.id === row.contactId);
  return {
    firstName: person?.firstName ?? card?.name.trim().split(/\s+/)[0] ?? null,
    lastName: person?.lastName ?? card?.name ?? null,
    name: person
      ? `${person.firstName} ${person.lastName}`.trim()
      : (card?.name ?? ''),
    addressOf: (item) =>
      item.notificationEmail?.trim() ||
      people.find((one) => one.id === item.personId)?.email.trim() ||
      contacts.find((one) => one.id === item.contactId)?.email?.trim() ||
      null,
  };
}

async function queueMail(
  tx: AnyDb,
  row: Request,
  parcels: Placed[],
  address: string,
  who: Who,
  type: 'avis' | 'relance',
  now: Date,
): Promise<void> {
  const { departmentId } = parcels[0]!;
  const [agent] = await tx
    .select({ name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, row.preparedBy));
  const replyTo = await replyToOf(tx, departmentId, agent?.email ?? null);
  const code = await drawCode(tx, row, departmentId, now);
  const values = mailValues({
    firstName: who.firstName ?? '',
    lastName: who.lastName,
    code: code.pin,
    parcels: parcels.map((item) => parcelLine(item, now)),
    damages: parcels.flatMap((item) => {
      const damage = damageForEmail(item);
      return damage ? [damageNotice(parcelMailName(item, t), damage)] : [];
    }),
    pickup: await pickupOf(tx, row.organizationId, departmentId),
    agent: agent?.name,
    replyTo,
    replyReference: replyReference({
      trackings: parcels.map((item) =>
        item.type === 'sans_suivi' ? null : item.tracking,
      ),
      name: who.name,
    }),
  });
  let rendered = renderMail(await templateOf(tx, row, type), values);
  // Nobody reads this mail before it leaves: a hole in a template would reach the employee.
  if (rendered.unknown.length > 0 || rendered.missing.length > 0) {
    rendered = renderMail(DEFAULT_TEMPLATES[type], values);
  }
  await tx
    .update(notification)
    .set({ recipients: [address], type, updatedAt: now })
    .where(eq(notification.id, row.id));
  await enqueueEmail(tx, {
    idempotencyKey: `notification:${row.id}`,
    organizationId: row.organizationId,
    notificationId: row.id,
    to: address,
    toName: who.name || null,
    subject: rendered.subject,
    text: rendered.body,
    html: mailHtml(rendered.body, code.token),
    replyTo,
    attachments: [qrAttachment(code.token)],
    pickupCodeId: code.id,
    replacedCodeId: code.replaced,
  });
}

async function prepareOne(tx: AnyDb, id: string, now: Date): Promise<void> {
  const [row] = await tx
    .select()
    .from(notification)
    .where(
      and(
        eq(notification.id, id),
        eq(notification.channel, 'server'),
        eq(notification.status, 'prepared'),
      ),
    )
    .for('update', { skipLocked: true });
  if (!row) return;
  const [queued] = await tx
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(eq(emailOutbox.notificationId, id));
  if (queued) return;
  const fail = (rowId: string, reason: string) =>
    settleFailed(tx, rowId, reason, {}, now);

  if (now.getTime() - row.preparedAt.getTime() > REQUEST_MAX_AGE_MS) {
    return fail(id, t('mail.server.expired'));
  }
  const { parcels: told, firstRead } = await parcelsToTell(tx, row);
  if (told.length === 0 || (!row.personId && !row.contactId)) {
    return fail(id, t('mail.server.superseded'));
  }
  const who = await whoOf(tx, row, told);
  // Moved to someone else since the request, a twin card at the same address
  // included: their code and name are not this mail's. Only a contact sharing the
  // address is the same human, one mail (`groupByRecipient`).
  const asked = row.recipients[0]?.toLowerCase();
  const mine = told.filter(
    (item) =>
      (row.personId !== null && item.personId === row.personId) ||
      (row.contactId !== null && item.contactId === row.contactId) ||
      (item.personId === null && who.addressOf(item)?.toLowerCase() === asked),
  );
  if (mine.length === 0) return fail(id, t('mail.server.superseded'));
  const parcels = mine.filter(isPlaced);
  if (parcels.length === 0) return fail(id, t('mail.server.noDepartment'));
  const type =
    firstRead || row.type !== 'relance' ? 'avis' : ('relance' as const);

  // One mail per department: a code opens one, and a second mail there would withdraw it.
  const groups = new Map<string, Placed[]>();
  for (const item of parcels) {
    groups.set(item.departmentId, [
      ...(groups.get(item.departmentId) ?? []),
      item,
    ]);
  }
  let first = true;
  for (const group of groups.values()) {
    const parcelIds = group.map((item) => item.id);
    const current: Request = first ? row : { ...row, id: newId() };
    if (first) {
      await tx
        .update(notification)
        .set({ parcelIds, updatedAt: now })
        .where(eq(notification.id, id));
    } else {
      await tx.insert(notification).values({
        ...current,
        parcelIds,
        createdAt: now,
        updatedAt: now,
        serverXid: undefined,
      });
    }
    first = false;
    const addresses = group.flatMap((item) => who.addressOf(item) ?? []);
    const address =
      addresses.find((one) => one.toLowerCase() === asked) ?? addresses[0];
    if (!address) {
      await fail(current.id, t('mail.server.noAddress'));
    } else if (await isSuppressed(tx, row.organizationId, address)) {
      await fail(current.id, t('mail.server.unsubscribed'));
    } else {
      await queueMail(tx, current, group, address, who, type, now);
    }
  }
}

/**
 * Turns the requests the devices wrote into queued mails, one transaction each.
 * Only the job calls it: no job, no draw, no queue.
 */
export async function prepareServerMails(
  db: AnyDb,
  { now = new Date(), limit = BATCH }: { now?: Date; limit?: number } = {},
): Promise<number> {
  const pending = await db
    .select({ id: notification.id })
    .from(notification)
    .leftJoin(emailOutbox, eq(emailOutbox.notificationId, notification.id))
    .where(
      and(
        eq(notification.channel, 'server'),
        eq(notification.status, 'prepared'),
        isNull(notification.deletedAt),
        isNull(emailOutbox.id),
      ),
    )
    .orderBy(asc(notification.preparedAt))
    .limit(limit);
  for (const { id } of pending) {
    try {
      await db.transaction((tx) => prepareOne(tx, id, now));
    } catch (error) {
      logger.error({ err: error }, 'mail request failed');
      await settleFailed(db, id, t('mail.server.failed'), {}, now);
    }
  }
  return pending.length;
}
