import { Avatar } from '#components/avatar';
import { EmailPreview } from '#components/email-preview';
import { QrCode } from '#components/qr-code';
import type { PickupEmail } from '#fixtures/emails';

export type PickupEmailScreenProps = {
  email: PickupEmail;
};

/**
 * The pickup e-mail in the employee's mailbox, as it really lands: plain
 * text from the agent's own address (D2, S5), the code first, one line per
 * parcel, where and when, then the agent's name. Shared with the QR, Mail
 * inserts the picture at the foot.
 *
 * Drawn in an iOS Mail view, not inside the app: it is the template's
 * documentation, and the white status-bar-only chrome is Mail's.
 */
export function PickupEmailScreen({ email }: PickupEmailScreenProps) {
  return (
    <div className="h-full min-h-dvh w-full overflow-y-auto bg-white">
      <EmailPreview
        subject={email.subject}
        sender={email.sender}
        avatar={<Avatar name={email.sender} />}
        meta={`À : ${email.to}, ${email.sentAt}`}
        className="mx-auto max-w-[480px] px-5 pt-[calc(var(--safe-top)+8px)] pb-[calc(var(--safe-bottom)+32px)]"
      >
        <p className="text-15 leading-[1.4] break-words whitespace-pre-wrap">
          {email.body}
        </p>
        {email.qr && (
          <QrCode
            matrix={email.qr}
            module={5}
            label="QR de retrait"
            className="mt-4 self-start border border-separator"
          />
        )}
      </EmailPreview>
    </div>
  );
}
