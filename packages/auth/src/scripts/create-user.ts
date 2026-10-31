import { parseArgs } from 'node:util';
import {
  DEFAULT_USER_ROLE,
  password as passwordSchema,
  USER_ROLES,
  userRole,
} from '@repo/contract/auth';
import { closeDb, db } from '@repo/db';
import { auth } from '#auth';
import {
  attachToOrganization,
  chooseOrganization,
  ensureOrganization,
} from '#organization';

const PASSWORD_VARIABLE = 'AUTH_USER_PASSWORD';

const USAGE = `Usage: pnpm auth:create-user --email <email> --name <name> [--role ${USER_ROLES.join('|')}] [--organization <name>]
The password is read from standard input, or from ${PASSWORD_VARIABLE}.
Without --organization, the only organization is used, or "Service courrier" is created.`;

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

async function readPassword(): Promise<string> {
  const fromVariable = process.env[PASSWORD_VARIABLE];
  if (fromVariable) return fromVariable;
  if (process.stdin.isTTY) return '';
  return (await readStdin()).replace(/\r?\n$/, '');
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      role: { type: 'string', default: DEFAULT_USER_ROLE },
      organization: { type: 'string' },
    },
  });

  const role = userRole.safeParse(values.role);
  if (!values.email || !values.name || !role.success) {
    throw new Error(USAGE);
  }

  const password = passwordSchema.safeParse(await readPassword());
  if (!password.success) {
    throw new Error(`Invalid or missing password.\n${USAGE}`);
  }

  const platformAccount = role.data === 'platform_admin';
  if (platformAccount && values.organization) {
    throw new Error(`An app admin belongs to no organization.\n${USAGE}`);
  }
  const choice = platformAccount
    ? null
    : await chooseOrganization(db, values.organization);
  const { user } = await auth.api.createUser({
    body: {
      email: values.email,
      name: values.name,
      password: password.data,
      role: role.data,
    },
  });
  if (!choice) {
    console.log(`Created ${role.data} ${user.email} (${user.id})`);
    return;
  }
  const organization = await ensureOrganization(db, choice);
  await attachToOrganization(db, user.id, organization.id);

  console.log(
    `Created ${role.data} ${user.email} (${user.id}) in ${organization.name}${organization.created ? ' (new)' : ''}`,
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
