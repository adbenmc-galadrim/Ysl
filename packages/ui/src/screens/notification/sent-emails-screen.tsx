import type { ReactNode } from 'react';

import { Button } from '#components/button';
import { FilterChip, FilterChips } from '#components/filter-chip';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { ListRow, type ListRowLine } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import type { SentEmail, SentEmailState } from '#fixtures/emails';

const TILE: Record<SentEmailState, Pick<IconTileProps, 'icon' | 'tone'>> = {
  failed: { icon: 'alert', tone: 'red' },
  queued: { icon: 'refresh', tone: 'grey' },
  sent: { icon: 'send', tone: 'blue' },
};

export type SentEmailsFilter = {
  label: string;
  count?: number;
  selected?: boolean;
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
  onBack?: () => void;
  onFix?: (email: SentEmail) => void;
  onOpen?: (email: SentEmail) => void;
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

function trailing(
  email: SentEmail,
  onFix?: (email: SentEmail) => void,
): ReactNode {
  if (email.state === 'failed')
    return (
      <Button
        variant="danger"
        size="xs"
        className="w-[89px]"
        onClick={() => onFix?.(email)}
      >
        Corriger
      </Button>
    );
  // A queued e-mail has nothing to open yet: no chevron.
  return email.state === 'sent' ? 'chevron' : null;
}

/**
 * The sending log. What failed comes first with its fix one tap away; what
 * waits for the network is said plainly so the agent does not resend it.
 */
export function SentEmailsScreen({
  filters = [],
  sections,
  onBack,
  onFix,
  onOpen,
}: SentEmailsScreenProps) {
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
      {sections.map((section, s) => (
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
                trailing={trailing(email, onFix)}
                separator={i < section.emails.length - 1}
                onClick={
                  email.state === 'sent' ? () => onOpen?.(email) : undefined
                }
              />
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
