import { parseArgs } from 'node:util';
import { password as passwordSchema, userRole } from '@repo/contract/auth';
import { closeDb, db } from '@repo/db';
import { env } from '@repo/shared/env/server';
import { auth } from '#auth';
import { attachToOrganization, resolveOrganization } from '#organization';
import { PASSWORD_VARIABLE, readPassword } from '#scripts/read-password';

const USAGE = `Usage: pnpm auth:dev-account --email <email> --name <name> --role <company_admin|department|shuttle> [--organization <name>]
A company account for a local demo, without going through an invitation. Refused in production.
The password is read from standard input, or from ${PASSWORD_VARIABLE}.`;

async function main(): Promise<void> {
  if (env.NODE_ENV === 'production') {
    throw new Error('Refused in production: accounts come by invitation.');
  }
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      role: { type: 'string' },
      organization: { type: 'string' },
    },
  });
  const role = userRole.exclude(['platform_admin']).safeParse(values.role);
  if (!values.email || !values.name || !role.success) throw new Error(USAGE);
  const password = passwordSchema.safeParse(await readPassword());
  if (!password.success) {
    throw new Error(`Invalid or missing password.\n${USAGE}`);
  }
  const organization = await resolveOrganization(db, values.organization);
  const { user } = await auth.api.createUser({
    body: {
      email: values.email,
      name: values.name,
      password: password.data,
      role: role.data,
    },
  });
  await attachToOrganization(db, user.id, organization.id);
  console.log(`Created ${role.data} ${user.email} in ${organization.name}`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
