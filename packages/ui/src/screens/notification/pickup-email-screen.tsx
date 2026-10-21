import { Button } from '#components/button';
import { EmailPreview } from '#components/email-preview';
import { LabelThumb } from '#components/label-thumb';
import { PickupCode } from '#components/pickup-code';
import type { PickupEmail } from '#fixtures/emails';
import { Icon } from '#icons';

export type PickupEmailScreenProps = {
  email: PickupEmail;
  onNotMine?: () => void;
  onColleague?: () => void;
};

/**
 * The pickup e-mail in the employee's mailbox. Its order is the order of
 * the questions they have: is it for me, what do I show at the desk, which
 * parcels, where and when — then the two answers that spare a wasted trip.
 *
 * Drawn in an iOS Mail view, not inside the app: it is the template's
 * documentation, and the white status-bar-only chrome is Mail's.
 */
export function PickupEmailScreen({
  email,
  onNotMine,
  onColleague,
}: PickupEmailScreenProps) {
  return (
    <div className="h-full min-h-dvh w-full overflow-y-auto bg-white">
      <EmailPreview
        subject={email.subject}
        sender={email.sender}
        meta={`À : ${email.to}, ${email.sentAt}`}
        className="mx-auto max-w-[480px] px-5 pt-[calc(var(--safe-top)+8px)] pb-[calc(var(--safe-bottom)+32px)]"
      >
        <p className="text-15">{email.greeting}</p>
        <p className="mt-1.5 text-15 leading-[1.4]">{email.body}</p>
        <PickupCode
          code={email.code}
          qr={email.qr}
          validity="Valable jusqu’au retrait"
          className="mt-3.5"
        />
        <ul className="mt-4 flex flex-col gap-3">
          {email.parcels.map((parcel) => (
            <li key={parcel.id} className="flex items-start gap-3">
              <LabelThumb />
              <span className="flex min-w-0 flex-col gap-px">
                <span className="text-15 font-semibold">{parcel.label}</span>
                <span className="text-13 text-muted">{parcel.status}</span>
              </span>
            </li>
          ))}
        </ul>
        <hr className="mt-[18px] border-separator" />
        <ul className="mt-[15px] flex flex-col gap-[11px] text-14 text-ink-2">
          {(
            [
              ['pin', email.place],
              ['clock', email.hours],
            ] as const
          ).map(([icon, text]) => (
            <li key={icon} className="flex items-center gap-2.5 pl-0.5">
              <Icon name={icon} size={16} className="shrink-0" />
              {text}
            </li>
          ))}
        </ul>
        <div className="mt-[25px] flex gap-2">
          <Button
            variant="outline"
            size="xs"
            className="h-10 flex-1 basis-0"
            onClick={onNotMine}
          >
            Ce n’est pas à moi
          </Button>
          <Button
            variant="outline"
            size="xs"
            className="h-10 flex-1 basis-0"
            onClick={onColleague}
          >
            Un collègue passera
          </Button>
        </div>
        <p className="mt-[26px] text-center text-13 text-muted">
          {email.signature}
        </p>
      </EmailPreview>
    </div>
  );
}
