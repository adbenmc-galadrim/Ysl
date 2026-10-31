import { parseArgs } from 'node:util';
import { password as passwordSchema } from '@repo/contract/auth';
import { closeDb, db } from '@repo/db';
import { session } from '@repo/db/schema';
import { eq } from 'drizzle-orm';
import { findUserByEmail } from '#organization';
import { setPassword } from '#password';
import { PASSWORD_VARIABLE, readPassword } from '#scripts/read-password';

const USAGE = `Usage: pnpm auth:reset-password --email <email> [--close-sessions]
The password is read from standard input, or from ${PASSWORD_VARIABLE}.
Open sessions are kept by default: --close-sessions signs every device out, and a
signed-out phone erases its local photos and proofs at its next request.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      'close-sessions': { type: 'boolean', default: false },
    },
  });
  if (!values.email) throw new Error(USAGE);

  const password = passwordSchema.safeParse(await readPassword());
  if (!password.success) {
    throw new Error(`Invalid or missing password.\n${USAGE}`);
  }
  const user = await findUserByEmail(db, values.email.toLowerCase());
  if (!user) throw new Error(`No account with email ${values.email}.`);

  await setPassword(db, user.id, password.data);
  if (values['close-sessions']) {
    const closed = await db
      .delete(session)
      .where(eq(session.userId, user.id))
      .returning({ id: session.id });
    console.log(
      `Password changed for ${user.email}; ${closed.length} session(s) closed.`,
    );
    return;
  }
  const open = await db
    .select({ id: session.id })
    .from(session)
    .where(eq(session.userId, user.id));
  console.log(
    `Password changed for ${user.email}; ${open.length} session(s) kept.`,
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
