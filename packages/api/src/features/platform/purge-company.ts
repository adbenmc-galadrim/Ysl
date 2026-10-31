import type { AnyDb } from '@repo/db';
import { logger } from '@repo/shared/logger';
import {
  mailSender,
  organization,
  organizationMember,
  user,
  verification,
} from '@repo/db/schema';
import { eq, inArray, or, sql } from 'drizzle-orm';
import type { MailDomains } from '#features/mail/mailer';
import { releaseDomain } from '#features/mail/sender';
import { rowsOf } from '#features/maintenance/purge';

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
      throw new Error(
        `Company tables reference each other: ${[...remaining].join(', ')}`,
      );
    }
    for (const table of free.sort()) {
      ordered.push(table);
      remaining.delete(table);
    }
  }
  return ordered;
}

export type CompanyDomain = {
  domain: string;
  declared: boolean;
  status: string;
};

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

    const [sender] = await tx
      .select({
        domain: mailSender.domain,
        declared: mailSender.declared,
        status: mailSender.status,
      })
      .from(mailSender)
      .where(eq(mailSender.organizationId, id));
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
      // Better Auth's reset tokens name an account by its id or its address, with no foreign key.
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

    return { domain: sender ?? null };
  });
}

/** After the commit: the company is gone, whatever the provider answers. */
export async function releaseCompanyDomain(
  domain: CompanyDomain | null,
  provider: MailDomains | null,
): Promise<void> {
  if (!domain) return;
  if (provider) {
    await releaseDomain(domain, provider);
    return;
  }
  logger.info(
    { domain: domain.domain },
    'mail domain of a deleted company left at the provider: no key',
  );
}
