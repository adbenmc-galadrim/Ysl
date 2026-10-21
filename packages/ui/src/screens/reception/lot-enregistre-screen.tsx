import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { GroupedList, GroupedRow } from '#components/grouped-list';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { Screen } from '#components/screen';
import { Icon } from '#icons';

/**
 * The saved mark: a check in a rounded square on a pale green disc. The
 * square is filled black because the Penpot export renders it so; the
 * mockup is the reference, so the badge follows it.
 */
function SavedBadge() {
  return (
    <span
      aria-hidden="true"
      className="flex size-20 items-center justify-center self-center rounded-full bg-green/12"
    >
      <svg viewBox="0 0 44 44" width={44} height={44} className="text-green">
        <rect
          x={3.67}
          y={3.67}
          width={36.67}
          height={36.67}
          rx={6}
          strokeWidth={2}
          className="fill-black stroke-current"
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
};

export type LotEnregistreScreenProps = {
  count: number;
  /** "Lot de 10 h 31 à 10 h 52". */
  span: string;
  /** What happens next, one row per consequence. */
  outcomes: LotOutcome[];
  /** Number of e-mails the main button sends. */
  emails: number;
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
}: LotEnregistreScreenProps) {
  return (
    <Screen
      bottom={
        // The fade only shows on a short phone, where the note scrolls under.
        <BottomBar>
          <Button variant="secondary" className="w-[120px]">
            Plus tard
          </Button>
          <Button className="flex-1">Envoyer {emails} e-mails</Button>
        </BottomBar>
      }
    >
      <div className="mt-[82px] flex flex-col">
        <SavedBadge />
        <h1 className="mt-6 text-center text-28 font-bold">
          {count} colis enregistrés
        </h1>
        <p className="mt-2 text-center text-15 text-muted">{span}</p>
      </div>

      <GroupedList className="mt-8 ring-1 ring-separator ring-inset">
        {outcomes.map((outcome) => (
          <GroupedRow
            key={outcome.title}
            size="lg"
            className="pl-4"
            leading={<IconTile icon={outcome.icon} tone={outcome.tone} />}
            title={outcome.title}
            subtitle={outcome.detail}
          />
        ))}
      </GroupedList>

      <div className="mt-5">
        <InfoNote>
          Chaque personne reçoit un seul e-mail avec tous ses colis, son QR
          code et son code de retrait.
        </InfoNote>
      </div>
    </Screen>
  );
}
