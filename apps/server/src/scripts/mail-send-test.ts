import { randomUUID } from 'node:crypto';
import { parseArgs } from 'node:util';
import { enqueueEmail } from '@repo/api';
import { closeDb, db } from '@repo/db';

const USAGE = `Usage: pnpm mail:send-test --to <email> [--key <key>]
Queues a test e-mail; the running server sends it. --key forces the idempotency
key, to check what the provider does with a repeat.`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: { to: { type: 'string' }, key: { type: 'string' } },
  });
  if (!values.to) throw new Error(USAGE);

  const key = values.key ?? `send-test:${randomUUID()}`;
  const { created } = await enqueueEmail(db, {
    idempotencyKey: key,
    to: values.to,
    subject: 'Essai d’envoi Courrier',
    text: `Cet e-mail d’essai confirme que le serveur sait envoyer.\n\n${key}`,
  });
  console.log(created ? `Queued ${key}` : `Already queued: ${key}`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
