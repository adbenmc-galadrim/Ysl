import type { ReactNode } from 'react';

import { buttonVariants } from '#components/button';
import { EmptyState } from '#components/empty-state';
import { FilterChip, FilterChips } from '#components/filter-chip';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { ListRow, type ListRowLine } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import { Sheet } from '#components/sheet';

export type SentEmailState =
  /** The agent said it did not go: the address to check, the mail to send again. */
  | 'failed'
  /** Written while offline, sent as soon as the network is back. */
  | 'queued'
  /** The mail app opened, and nobody said whether the mail left. */
  | 'waiting'
  | 'sent'
  /** A failure another mail took over: kept for the record. */
  | 'closed';

export type SentEmail = {
  id: string;
  recipient: string;
  state: SentEmailState;
  /** What the e-mail is about: "1 colis DPD", "Relance, 1 colis FedEx". */
  summary: string;
  /** Where it stands: why it failed, "Partira au retour du réseau", the times. */
  status: string;
};

const TILE: Record<SentEmailState, Pick<IconTileProps, 'icon' | 'tone'>> = {
  failed: { icon: 'alert', tone: 'red' },
  queued: { icon: 'refresh', tone: 'grey' },
  waiting: { icon: 'clock', tone: 'orange' },
  sent: { icon: 'send', tone: 'blue' },
  closed: { icon: 'alert', tone: 'grey' },
};

export type SentEmailsFilter = {
  label: string;
  count?: number;
  selected?: boolean;
  onClick?: () => void;
};

export type SentEmailsSection = {
  title: string;
  emails: SentEmail[];
  /** The real total when only the latest rows are drawn. */
  count?: number;
};

export type SentEmailsScreenProps = {
  filters?: SentEmailsFilter[];
  sections: SentEmailsSection[];
  /** Over the list: the parcel the log is narrowed to. */
  notice?: ReactNode;
  /** Said when no section has a row. */
  empty?: { title: string; description?: string };
  onBack?: () => void;
  /** A failed row: fix the address, send again. */
  onFix?: (email: SentEmail) => void;
  /** A row left without an answer: did it leave? */
  onConfirm?: (email: SentEmail) => void;
  /** A sent or closed row: its parcels. */
  onOpen?: (email: SentEmail) => void;
  sheet?: ReactNode;
};

function lines(email: SentEmail): ListRowLine[] {
  // A refusal is the news, so it comes first, in red; otherwise the state
  // line closes the row as on the parcel list. The red stays regular
  // weight: it is a sentence to read, not a label.
  if (email.state === 'failed')
    return [
      {
        text: <span className="font-normal">{email.status}</span>,
        tone: 'red',
      },
      { text: email.summary },
    ];
  return [{ text: email.summary }, { text: email.status }];
}

/**
 * The row's own action, drawn as a button: the whole row is the button,
 * one target for the thumb, and a button cannot hold another.
 */
function pill(label: string, variant: 'danger' | 'warning') {
  return (
    <span
      aria-hidden="true"
      className={buttonVariants({ variant, size: 'xs', class: 'w-[89px]' })}
    >
      {label}
    </span>
  );
}

function rowOf(
  email: SentEmail,
  { onFix, onConfirm, onOpen }: SentEmailsScreenProps,
): { trailing: ReactNode; onClick?: () => void } {
  switch (email.state) {
    case 'failed':
      return {
        trailing: pill('Corriger', 'danger'),
        onClick: onFix && (() => onFix(email)),
      };
    case 'waiting':
      return {
        trailing: pill('Confirmer', 'warning'),
        onClick: onConfirm && (() => onConfirm(email)),
      };
    case 'queued':
      // A queued e-mail has nothing to open yet: no chevron.
      return { trailing: null };
    case 'sent':
    case 'closed':
      return { trailing: 'chevron', onClick: onOpen && (() => onOpen(email)) };
  }
}

/**
 * The sending log. What failed comes first with its fix one tap away, then
 * what waits for the agent's word (D2: the app knows it opened the mail
 * app, never that the mail left), then what left.
 */
export function SentEmailsScreen(props: SentEmailsScreenProps) {
  const { filters = [], sections, notice, empty, onBack, sheet } = props;
  const shown = sections.filter((section) => section.emails.length > 0);
  return (
    <Screen>
      <NavBar title="E-mails envoyés" onBack={onBack} />
      {filters.length > 0 && (
        <FilterChips aria-label="Filtrer les e-mails" className="mt-3">
          {filters.map((filter) => (
            <FilterChip key={filter.label} {...filter} />
          ))}
        </FilterChips>
      )}
      {notice}
      {shown.length === 0 && empty && (
        <EmptyState
          icon="mail"
          title={empty.title}
          description={empty.description}
          className="mt-[129px]"
        />
      )}
      {shown.map((section, s) => (
        <section key={section.title} className={s ? 'mt-[29px]' : 'mt-6'}>
          <SectionHeader
            title={section.title}
            count={section.count ?? section.emails.length}
          />
          <div className="mt-6">
            {section.emails.map((email, i) => (
              <ListRow
                key={email.id}
                leading={<IconTile {...TILE[email.state]} />}
                title={email.recipient}
                lines={lines(email)}
                separator={i < section.emails.length - 1}
                {...rowOf(email, props)}
              />
            ))}
          </div>
        </section>
      ))}
      {sheet}
    </Screen>
  );
}

export type MailParcel = {
  id: string;
  /** "Amazon ···4471". */
  title: string;
  /** Where it stands: "À notifier", "Notifié il y a 2 h". */
  detail: string;
};

export type MailParcelsSheetProps = {
  recipient: string;
  /** The mail's state line: "Envoyé à 10 h 58". */
  status: string;
  parcels: MailParcel[];
  onParcel?: (parcel: MailParcel) => void;
  onDismiss?: () => void;
  /** Under the list: confirm, fix, send again. */
  children?: ReactNode;
};

/** The parcels a mail was about, each a tap from its record. */
export function MailParcelsSheet({
  recipient,
  status,
  parcels,
  onParcel,
  onDismiss,
  children,
}: MailParcelsSheetProps) {
  return (
    <Sheet
      fixed
      title={`E-mail à ${recipient}`}
      description={status}
      className="pb-[calc(var(--safe-bottom)+16px)]"
      onDismiss={onDismiss}
    >
      <div className="mt-5">
        {parcels.map((parcel, i) => (
          <ListRow
            key={parcel.id}
            align="center"
            leading={<IconTile icon="package" tone="fill" />}
            title={parcel.title}
            lines={[{ text: parcel.detail }]}
            separator={i < parcels.length - 1}
            onClick={onParcel && (() => onParcel(parcel))}
          />
        ))}
      </div>
      {children}
    </Sheet>
  );
}
