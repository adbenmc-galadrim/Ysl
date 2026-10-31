import type {
  DnsRecord,
  SaveSenderInput,
  SenderSettings,
} from '@repo/contract/mail';
import type { AnyDb } from '@repo/db';
import { mailSender } from '@repo/db/schema';
import { logger } from '@repo/shared/logger';
import { and, eq } from 'drizzle-orm';
import type { EmailMessage, MailDomains } from '#features/mail/mailer';
import { sqlState } from '#features/sync/errors';

type Problem = SenderSettings['problem'];

export type SenderContext = {
  provider: MailDomains | null;
  platformAddress: string | null;
};

const domainOf = (email: string) =>
  (email.split('@').at(-1) ?? '').toLowerCase();

async function rowOf(db: AnyDb, organizationId: string) {
  const [row] = await db
    .select()
    .from(mailSender)
    .where(eq(mailSender.organizationId, organizationId));
  return row;
}

function settings(
  row: typeof mailSender.$inferSelect | undefined,
  { provider, platformAddress }: SenderContext,
  problem: Problem = null,
): SenderSettings {
  return {
    platformAddress,
    providerConfigured: provider !== null,
    sender: row
      ? {
          name: row.name,
          email: row.email,
          domain: row.domain,
          status: row.status,
          records: row.dnsRecords,
          verifiedAt: row.verifiedAt,
        }
      : null,
    problem,
  };
}

export async function getSender(
  db: AnyDb,
  organizationId: string,
  context: SenderContext,
): Promise<SenderSettings> {
  return settings(await rowOf(db, organizationId), context);
}

export type SaveSenderOutcome =
  SenderSettings | 'taken' | 'invalid' | 'platform';

/**
 * All companies share one provider account, where `authenticated` says nothing
 * of who owns a domain. Hence: a domain is refused when another company holds
 * it, and when the provider already has it authenticated with no owner here.
 */
export async function saveSender(
  db: AnyDb,
  {
    organizationId,
    userId,
    input,
    now = new Date(),
  }: {
    organizationId: string;
    userId: string;
    input: SaveSenderInput;
    now?: Date;
  },
  context: SenderContext,
): Promise<SaveSenderOutcome> {
  const { provider, platformAddress } = context;
  const domain = domainOf(input.email);
  if (platformAddress && domainOf(platformAddress) === domain)
    return 'platform';

  const current = await rowOf(db, organizationId);
  if (current?.domain === domain) {
    const [row] = await db
      .update(mailSender)
      .set({
        name: input.name,
        email: input.email,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(mailSender.organizationId, organizationId))
      .returning();
    return settings(row, context);
  }

  const [holder] = await db
    .select({ organizationId: mailSender.organizationId })
    .from(mailSender)
    .where(eq(mailSender.domain, domain));
  if (holder) return 'taken';

  let records: DnsRecord[] = [];
  let problem: Problem = null;
  let declared = false;
  if (provider) {
    const result = await provider.register(domain);
    if (result.status === 'invalid') return 'invalid';
    if (result.status === 'found') {
      if (!result.created && result.authenticated) return 'taken';
      records = result.records;
      declared = result.created;
    } else {
      problem = 'unavailable';
    }
  }

  const values = {
    name: input.name,
    email: input.email,
    domain,
    status: 'pending' as const,
    dnsRecords: records,
    declared,
    checkedAt: null,
    verifiedAt: null,
    updatedBy: userId,
    updatedAt: now,
  };
  let row;
  try {
    [row] = await db
      .insert(mailSender)
      .values({ organizationId, ...values })
      .onConflictDoUpdate({ target: mailSender.organizationId, set: values })
      .returning();
  } catch (error) {
    if (sqlState(error) === '23505') return 'taken';
    throw error;
  }

  // Left authenticated, the old domain could not be claimed again by anyone. The
  // account is shared: only what this company declared or proved is its to remove.
  if (
    current &&
    provider &&
    (current.declared || current.status === 'verified')
  ) {
    await provider.remove(current.domain).catch((error: unknown) => {
      logger.warn({ err: error }, 'mail domain not removed at the provider');
    });
  }
  return settings(row, context, problem);
}

/** "Vérifier maintenant": also what declares the domain when the key came after the save. */
export async function checkSender(
  db: AnyDb,
  { organizationId, now = new Date() }: { organizationId: string; now?: Date },
  context: SenderContext,
): Promise<SenderSettings> {
  const { provider } = context;
  const row = await rowOf(db, organizationId);
  if (!row) return settings(row, context);
  if (!provider) return settings(row, context, 'unavailable');

  let declared = row.declared;
  let result = row.dnsRecords.length ? await provider.check(row.domain) : null;
  if (!result || result.status === 'notFound') {
    result = await provider.register(row.domain);
    if (result.status === 'found') {
      if (!result.created && result.authenticated) {
        return settings(row, context, 'taken');
      }
      declared ||= result.created;
      result = await provider.check(row.domain);
    }
  }
  if (result.status === 'invalid') return settings(row, context, 'invalid');
  if (result.status !== 'found') {
    return settings(row, context, 'unavailable');
  }
  const verified = result.authenticated;
  const [updated] = await db
    .update(mailSender)
    .set({
      status: verified ? 'verified' : 'pending',
      dnsRecords: result.records,
      declared,
      checkedAt: now,
      verifiedAt: verified ? (row.verifiedAt ?? now) : null,
    })
    .where(
      and(
        eq(mailSender.organizationId, organizationId),
        eq(mailSender.domain, row.domain),
      ),
    )
    .returning();
  // The domain changed during the check: this answer says nothing about the new one.
  if (!updated) return settings(await rowOf(db, organizationId), context);
  return settings(updated, context);
}

/**
 * Who a queued mail leaves as, read at send time so a domain verified after
 * the mail was queued counts. Until then: the platform's address, the company's name.
 */
export async function senderOf(
  db: AnyDb,
  organizationId: string | null,
): Promise<EmailMessage['from']> {
  if (!organizationId) return undefined;
  const row = await rowOf(db, organizationId);
  if (!row) return undefined;
  return row.status === 'verified'
    ? { email: row.email, name: row.name }
    : { name: row.name };
}
