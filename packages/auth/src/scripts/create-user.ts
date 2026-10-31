import { parseArgs } from 'node:util';
import { password as passwordSchema } from '@repo/contract/auth';
import { closeDb } from '@repo/db';
import { auth } from '#auth';
import { PASSWORD_VARIABLE, readPassword } from '#scripts/read-password';

const ROLE = 'platform_admin';

const USAGE = `Usage: pnpm auth:create-user --email <email> --name <name> --role ${ROLE}
The way in for the app's first admin, who belongs to no company. Every other account
comes by invitation, from the app's admin or the company's (docs/comptes.md).
The password is read from standard input, or from ${PASSWORD_VARIABLE}.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      role: { type: 'string' },
    },
  });
  if (!values.email || !values.name || values.role !== ROLE) {
    throw new Error(USAGE);
  }
  const password = passwordSchema.safeParse(await readPassword());
  if (!password.success) {
    throw new Error(`Invalid or missing password.\n${USAGE}`);
  }
  const { user } = await auth.api.createUser({
    body: {
      email: values.email,
      name: values.name,
      password: password.data,
      role: ROLE,
    },
  });
  console.log(`Created ${ROLE} ${user.email} (${user.id})`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
