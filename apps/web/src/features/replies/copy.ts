import {
  DEFAULT_TEMPLATES,
  renderMail,
  type MailMessage,
} from '@repo/contract/mail';
import { createTranslator, DEFAULT_LOCALE } from '@repo/shared/i18n';
import { commitLocal } from '#/features/db/commit';
import type { CourrierDatabase, LocalParcel } from '#/features/db/schema';
import { recallSecrets } from '#/features/mail/pickup-code';
import { groupByRecipient, recipientValues } from '#/features/mail/recipients';
import { loadRecipientContext } from '#/features/parcels/api/use-parcels';
import { parcelEvent } from '#/features/parcels/events';
import { readDepartmentPickups, readPickup } from '#/features/settings/pickup';

const t = createTranslator(DEFAULT_LOCALE);

export type CopyTo = { name: string; address: string };

type Agent = { name: string; email: string };

/**
 * With the server's sending off: the mail for the agent's mail app. It quotes
 * the code the recipient holds, found again from its hash, and writes none; the
 * QR's token is nowhere (§8.7), a new one would withdraw the recipient's. Nothing
 * when no code is open: no mail to copy.
 */
export async function copyDraft(
  db: CourrierDatabase,
  parcels: readonly LocalParcel[],
  to: CopyTo,
  agent: Agent,
  now = new Date(),
): Promise<MailMessage | null> {
  const context = await loadRecipientContext(db, parcels);
  const mail = groupByRecipient(parcels, context, () => true)[0];
  if (!mail) return null;
  const [secret] = await recallSecrets(
    db,
    [
      {
        personId: mail.personId,
        contactId: mail.contactId,
        departmentId: mail.departmentId,
      },
    ],
    { now },
  );
  if (!secret?.codeId) return null;
  const [pickup, pickups] = await Promise.all([
    readPickup(db),
    readDepartmentPickups(db),
  ]);
  const rendered = renderMail(
    DEFAULT_TEMPLATES.avis,
    recipientValues(mail, {
      pickup: (mail.departmentId && pickups.get(mail.departmentId)) || pickup,
      agent: agent.name,
      replyTo: agent.email,
      code: secret.pin,
      now,
      t,
    }),
  );
  return {
    to: [to.address],
    subject: rendered.subject,
    body: `${t('mail.server.copy', {
      delegate: to.name,
      recipient: mail.name,
    })}\n\n${rendered.body}`,
  };
}

/** The copy left by the agent's mail app: in each parcel's history, as the server writes it. */
export async function recordPhoneCopy(
  db: CourrierDatabase,
  parcels: readonly LocalParcel[],
  name: string,
  { agentId, now = new Date() }: { agentId: string; now?: Date },
): Promise<void> {
  await commitLocal(
    db,
    {
      upserts: parcels.map((parcel) =>
        parcelEvent(
          parcel.id,
          { type: 'parcel.copied', to: name },
          { agentId, now },
        ),
      ),
    },
    { now },
  );
}
