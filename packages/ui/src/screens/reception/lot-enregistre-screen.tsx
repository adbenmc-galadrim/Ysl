import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { GroupedList, GroupedRow } from '#components/grouped-list';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { Screen } from '#components/screen';
import { Icon } from '#icons';

/** The saved mark: a check in a circle on a pale green disc. */
function SavedBadge() {
  return (
    <span
      aria-hidden="true"
      className="flex size-20 items-center justify-center self-center rounded-full bg-green/12"
    >
      <svg viewBox="0 0 44 44" width={44} height={44} className="text-green">
        <circle
          cx={22}
          cy={22}
          r={18.33}
          strokeWidth={2}
          className="fill-none stroke-current"
        />
        <path
          d="M16.5 22l3.67 3.67 7.33-7.33"
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="stroke-current"
        />
      </svg>
    </span>
  );
}

/** A grey note with an info icon: a rule of the app worth knowing. */
function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-2.5 rounded-card bg-fill py-3 pr-3.5 pl-3.5 text-14 leading-[1.4] text-ink-2">
      <Icon name="info" size={20} className="shrink-0" />
      <span>{children}</span>
    </p>
  );
}

export type LotOutcome = Pick<IconTileProps, 'icon' | 'tone'> & {
  title: string;
  detail: string;
  /** The row opens what it counts: the mails, the parcel to complete. */
  onClick?: () => void;
};

export type LotEnregistreScreenProps = {
  count: number;
  /** "Lot de 10 h 31 à 10 h 52". */
  span: string;
  /** What happens next, one row per consequence. */
  outcomes: LotOutcome[];
  /** Number of e-mails the main button sends. */
  emails: number;
  /** "Envoyer 9 e-mails", worded by the app for one mail. */
  sendLabel?: string;
  /** The rule worth knowing under the card. */
  note?: ReactNode;
  onLater?: () => void;
  onSend?: () => void;
  /** With no mail to send, the main button starts the next batch. */
  onNewBatch?: () => void;
};

/**
 * The end of a reception batch. It says what was saved and, above all, what
 * was not settled — the parcel left to complete, the e-mails waiting for the
 * network — before offering to notify. Sending can wait: "Plus tard" keeps
 * the e-mails ready on the home screen.
 */
export function LotEnregistreScreen({
  count,
  span,
  outcomes,
  emails,
  sendLabel = `Envoyer ${emails} e-mails`,
  note = 'Chaque personne reçoit un seul e-mail avec tous ses colis, son QR code et son code de retrait.',
  onLater,
  onSend,
  onNewBatch,
}: LotEnregistreScreenProps) {
  return (
    <Screen
      bottom={
        // The fade only shows on a short phone, where the note scrolls under.
        <BottomBar>
          <Button variant="secondary" className="w-[120px]" onClick={onLater}>
            Plus tard
          </Button>
          {emails > 0 ? (
            <Button className="flex-1" onClick={onSend}>
              {sendLabel}
            </Button>
          ) : (
            <Button className="flex-1" onClick={onNewBatch}>
              Nouveau lot
            </Button>
          )}
        </BottomBar>
      }
    >
      <div className="mt-[82px] flex flex-col">
        <SavedBadge />
        <h1 className="mt-6 text-center text-28 font-bold">
          {count} colis {count === 1 ? 'enregistré' : 'enregistrés'}
        </h1>
        <p className="mt-2 text-center text-15 text-muted">{span}</p>
      </div>

      <GroupedList className="mt-8 rounded-panel ring-1 ring-separator ring-inset">
        {outcomes.map((outcome) => (
          <GroupedRow
            key={outcome.title}
            size="lg"
            className="pl-4"
            leading={<IconTile icon={outcome.icon} tone={outcome.tone} />}
            title={outcome.title}
            subtitle={outcome.detail}
            accessory={outcome.onClick ? 'chevron' : undefined}
            onClick={outcome.onClick}
          />
        ))}
      </GroupedList>

      <div className="mt-5">
        {note && <InfoNote>{note}</InfoNote>}
      </div>
    </Screen>
  );
}
