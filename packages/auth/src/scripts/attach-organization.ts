import { parseArgs } from 'node:util';
import { closeDb, db } from '@repo/db';
import {
  attachToOrganization,
  findUserByEmail,
  resolveOrganization,
} from '#organization';

const USAGE = `Usage: pnpm auth:attach-organization --email <email> [--organization <name>]
Attaches an existing account to an organization. Without --organization, the only
organization is used, or "Service courrier" is created.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      organization: { type: 'string' },
    },
  });
  if (!values.email) throw new Error(USAGE);

  const user = await findUserByEmail(db, values.email);
  if (!user) throw new Error(`No account with email ${values.email}.`);
  const organization = await resolveOrganization(db, values.organization);
  await attachToOrganization(db, user.id, organization.id);

  console.log(
    `Attached ${user.email} to ${organization.name}${organization.created ? ' (new)' : ''}`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
