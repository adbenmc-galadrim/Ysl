import { EmptyState } from '#components/empty-state';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { ListRow, type ListRowLine } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { SectionHeader } from '#components/section-header';
import type { IconName } from '#icons';

/**
 * Where a handover stands: kept, still on the iPhone, refused by the
 * server, or cancelled (kept for the record).
 */
export type JournalRemiseState = 'done' | 'unsent' | 'rejected' | 'cancelled';

export type JournalRemise = {
  id: string;
  /** Who collected: "Nora Haddad". */
  recipient: string;
  /** How it was proved, drawn in the tile. */
  icon: IconName;
  /** "3 colis · Code vérifié". */
  summary: string;
  /** "11 h 20 · Karim Benali". */
  detail: string;
  state: JournalRemiseState;
  /** Said in colour when the state is not `done`: "Annulée à 11 h 25". */
  status?: string;
};

export type JournalRemisesSection = {
  /** "Aujourd’hui", "Hier", "Lundi 26 octobre". */
  title: string;
  entries: JournalRemise[];
};

export type JournalRemisesScreenProps = {
  query?: string;
  onQueryChange?: (query: string) => void;
  sections: JournalRemisesSection[];
  /** Said when no handover matches, or none was recorded yet. */
  empty?: { title: string; description?: string };
  onBack?: () => void;
  onOpen?: (entry: JournalRemise) => void;
};

const TILE: Record<JournalRemiseState, IconTileProps['tone']> = {
  done: 'green',
  unsent: 'orange',
  rejected: 'red',
  cancelled: 'grey',
};

const STATUS_TONE: Record<JournalRemiseState, ListRowLine['tone']> = {
  done: 'muted',
  unsent: 'orange',
  rejected: 'red',
  cancelled: 'muted',
};

function lines(entry: JournalRemise): ListRowLine[] {
  return [
    { text: entry.summary },
    { text: entry.detail },
    ...(entry.status
      ? [{ text: entry.status, tone: STATUS_TONE[entry.state] }]
      : []),
  ];
}

/**
 * The handover journal (F43): who collected, when, which agent, how it was
 * proved — the trace kept for a dispute. Every agent of the mailroom sees
 * every handover (§8.4); the newest day comes first.
 */
export function JournalRemisesScreen({
  query = '',
  onQueryChange,
  sections,
  empty,
  onBack,
  onOpen,
}: JournalRemisesScreenProps) {
  const shown = sections.filter((section) => section.entries.length > 0);
  return (
    <Screen>
      <NavBar title="Journal des remises" onBack={onBack} />
      <SearchField
        size="md"
        value={query}
        placeholder="Salarié, agent"
        aria-label="Chercher une remise"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        onChange={(e) => onQueryChange?.(e.target.value)}
        className="mt-3"
      />
      {shown.length === 0 && empty && (
        <EmptyState
          icon="inbox"
          title={empty.title}
          description={empty.description}
          className="mt-[129px]"
        />
      )}
      {shown.map((section, s) => (
        <section key={section.title} className={s ? 'mt-[29px]' : 'mt-6'}>
          <SectionHeader title={section.title} count={section.entries.length} />
          <div className="mt-6">
            {section.entries.map((entry, i) => (
              <ListRow
                key={entry.id}
                leading={
                  <IconTile icon={entry.icon} tone={TILE[entry.state]} />
                }
                title={entry.recipient}
                titleTone="ink"
                lines={lines(entry)}
                separator={i < section.entries.length - 1}
                onClick={onOpen && (() => onOpen(entry))}
              />
            ))}
          </div>
        </section>
      ))}
    </Screen>
  );
}
