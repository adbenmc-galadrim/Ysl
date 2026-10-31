import type { AnyDb } from '@repo/db';
import { logger } from '@repo/shared/logger';
import { organization, organizationMember, user, verification } from '@repo/db/schema';
import { eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import type { MailDomains } from '#features/mail/mailer';

async function rowsOf<Row>(db: AnyDb, query: SQL): Promise<Row[]> {
  const result: unknown = await db.execute(query);
  return (result as { rows: Row[] }).rows;
}

/**
 * Every table holding a company's rows, read from the catalog so that a table
 * added later cannot be forgotten, ordered so that each goes before what it
 * references. A cycle has no such order: it fails, and the transaction with it.
 */
export async function companyTablesInOrder(db: AnyDb): Promise<string[]> {
  const tables = await rowsOf<{ name: string }>(
    db,
    sql`select c.table_name as name
          from information_schema.columns c
          join information_schema.tables t
            on t.table_schema = c.table_schema and t.table_name = c.table_name
         where c.table_schema = 'public'
           and c.column_name = 'organization_id'
           and t.table_type = 'BASE TABLE'`,
  );
  const edges = await rowsOf<{ child: string; parent: string }>(
    db,
    sql`select child.relname as child, parent.relname as parent
          from pg_constraint fk
          join pg_class child on child.oid = fk.conrelid
          join pg_class parent on parent.oid = fk.confrelid
          join pg_namespace n on n.oid = child.relnamespace
         where fk.contype = 'f' and n.nspname = 'public'`,
  );
  const remaining = new Set(tables.map((table) => table.name));
  const ordered: string[] = [];
  while (remaining.size > 0) {
    const free = [...remaining].filter(
      (table) =>
        !edges.some(
          (edge) =>
            edge.parent === table &&
            edge.child !== table &&
            remaining.has(edge.child),
        ),
    );
    if (free.length === 0) {
      throw new Error(`Company tables reference each other: ${[...remaining].join(', ')}`);
    }
    for (const table of free.sort()) {
      ordered.push(table);
      remaining.delete(table);
    }
  }
  return ordered;
}

export type CompanyDomain = { domain: string; ours: boolean };

/**
 * Everything of a company, in one transaction: its rows in every table, then
 * its accounts, whose sessions and credentials go with them. A row inserted
 * meanwhile blocks on the company's lock, then fails on its foreign key.
 * Returns its mail domain for the provider, which is no transaction's to undo.
 */
export async function purgeCompanyRows(
  db: AnyDb,
  id: string,
): Promise<{ domain: CompanyDomain | null } | null> {
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.id, id))
      .for('update');
    if (!found) return null;

    const [sender] = await rowsOf<{
      domain: string;
      declared: boolean;
      status: string;
    }>(
      tx,
      sql`select domain, declared, status from mail_sender where organization_id = ${id}`,
    );
    const members = await tx
      .select({ id: user.id, email: user.email })
      .from(organizationMember)
      .innerJoin(user, eq(user.id, organizationMember.userId))
      .where(eq(organizationMember.organizationId, id));

    // The switch the event log's guard asks for; it ends with the transaction.
    await tx.execute(sql`select set_config('app.purge', 'on', true)`);
    for (const table of await companyTablesInOrder(tx)) {
      await tx.execute(
        sql`delete from ${sql.identifier(table)} where organization_id = ${id}`,
      );
    }

    if (members.length > 0) {
      const ids = members.map((member) => member.id);
      await tx.delete(verification).where(
        or(
          inArray(verification.value, ids),
          inArray(
            verification.identifier,
            members.map((member) => member.email),
          ),
        ),
      );
      await tx.delete(user).where(inArray(user.id, ids));
    }
    await tx.delete(organization).where(eq(organization.id, id));

    return {
      domain: sender
        ? {
            domain: sender.domain,
            ours: sender.declared || sender.status === 'verified',
          }
        : null,
    };
  });
}

/**
 * The account is shared with every company: only a domain this one declared or
 * proved is removed. After the commit, and never a reason to fail: the company
 * is gone, and the log says what is left to do by hand.
 */
export async function releaseCompanyDomain(
  domain: CompanyDomain | null,
  provider: MailDomains | null,
): Promise<void> {
  if (!domain?.ours) return;
  if (!provider) {
    logger.info(
      { domain: domain.domain },
      'mail domain of a deleted company left at the provider: no key',
    );
    return;
  }
  await provider.remove(domain.domain).catch((error: unknown) => {
    logger.warn(
      { err: error, domain: domain.domain },
      'mail domain of a deleted company not removed at the provider',
    );
  });
}
