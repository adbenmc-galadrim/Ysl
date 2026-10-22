import { parseArgs } from 'node:util';
import {
  DEFAULT_USER_ROLE,
  password as passwordSchema,
  userRole,
} from '@repo/contract/auth';
import { closeDb } from '@repo/db';
import { auth } from '#auth';

const PASSWORD_VARIABLE = 'AUTH_USER_PASSWORD';

const USAGE = `Usage: pnpm auth:create-user --email <email> --name <name> [--role agent|admin]
The password is read from standard input, or from ${PASSWORD_VARIABLE}.`;

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

  const { user } = await auth.api.createUser({
    body: {
      email: values.email,
      name: values.name,
      password: password.data,
      role: role.data,
    },
  });

  console.log(`Created ${role.data} ${user.email} (${user.id})`);
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await closeDb();
}
