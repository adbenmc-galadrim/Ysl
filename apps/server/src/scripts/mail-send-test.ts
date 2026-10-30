import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { enqueueEmail } from '@repo/api';
import { closeDb, db } from '@repo/db';

const USAGE = `Usage: pnpm mail:send-test --to <email>
Queues a test e-mail; the running server sends it.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { to: { type: 'string' } },
  });
  if (!values.to) throw new Error(USAGE);

  const key = `send-test:${randomUUID()}`;
  await enqueueEmail(db, {
    idempotencyKey: key,
    to: values.to,
    subject: 'Essai d’envoi Courrier',
    text: `Cet e-mail d’essai confirme que le serveur sait envoyer.\n\n${key}`,
  });
  console.log(`Queued ${key}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
