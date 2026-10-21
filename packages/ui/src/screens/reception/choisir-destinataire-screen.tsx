import { Avatar } from '#components/avatar';
import { IconButton } from '#components/icon-button';
import { ListRow } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import { whereabouts, type DirectoryEntry } from '#fixtures/reception';
import { Icon } from '#icons';

/**
 * The directory search of the picker: 48 px, taller than the search screen's
 * box because it is the only control of the screen. It shows a static caret
 * in stories, where a focused `<input>` would blink and break the diff.
 */
function DirectorySearch({
  query,
  showCaret = false,
}: {
  query: string;
  showCaret?: boolean;
}) {
  return (
    <label className="flex h-12 items-center gap-2.5 rounded-control bg-fill pr-4 pl-3.5 text-17 focus-within:ring-2 focus-within:ring-blue">
      <Icon
        name="search"
        size={20}
        strokeWidth={2.2}
        className="shrink-0 text-muted"
      />
      <input
        type="search"
        defaultValue={query}
        aria-label="Rechercher une personne"
        placeholder="Nom, service, e-mail"
        className="h-full min-w-0 bg-transparent text-ink caret-blue outline-none [field-sizing:content] [&::-webkit-search-cancel-button]:hidden"
        style={showCaret ? { caretColor: 'transparent' } : undefined}
      />
      {showCaret && (
        <span aria-hidden="true" className="-ml-1 h-6 w-0.5 shrink-0 bg-blue" />
      )}
      <span className="flex-1" />
      {query && (
        <button
          type="button"
          aria-label="Effacer"
          className="flex shrink-0 cursor-pointer text-muted outline-none focus-visible:ring-2 focus-visible:ring-blue"
        >
          <Icon name="x" size={16} strokeWidth={2.4} />
        </button>
      )}
    </label>
  );
}

export type ChoisirDestinataireScreenProps = {
  query: string;
  results: DirectoryEntry[];
  recents: DirectoryEntry[];
  /** Draws the caret of the focused field, for stories. */
  showCaret?: boolean;
};

const rows = (people: DirectoryEntry[], withEmail: boolean) =>
  people.map((person, i) => (
    <ListRow
      key={person.id}
      align="center"
      leading={<Avatar initials={person.initials} tone="fill" />}
      title={person.name}
      lines={[
        { text: whereabouts(person) },
        ...(withEmail && person.email ? [{ text: person.email }] : []),
      ]}
      separator={i < people.length - 1}
      onClick={() => {}}
    />
  ));

/**
 * The full directory, when none of the scanner's guesses is the right one.
 * Results show the e-mail too: it is what tells two Fontaine apart. A person
 * outside the directory — a temp, a visitor — can still be typed by hand.
 */
export function ChoisirDestinataireScreen({
  query,
  results,
  recents,
  showCaret,
}: ChoisirDestinataireScreenProps) {
  return (
    <Screen>
      <NavBar
        title="Destinataire"
        leading={
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            // The bar pads a text action; the square bleeds like the back one.
            className="-ml-0.5"
          />
        }
      />
      <div className="mt-3">
        <DirectorySearch query={query} showCaret={showCaret} />
      </div>

      <section className="mt-6">
        <SectionHeader title="Résultats" count={results.length} />
        <div className="mt-[13px]">{rows(results, true)}</div>
      </section>

      <section className="mt-[22px]">
        <SectionHeader title="Récents" />
        <div className="mt-[13px]">{rows(recents, false)}</div>
      </section>

      <button
        type="button"
        className="mt-5 flex h-16 cursor-pointer items-center gap-[15px] rounded-card border border-dashed border-border pb-0.5 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <Icon name="user" size={22} className="shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-16 font-semibold">
            Personne hors annuaire
          </span>
          <span className="mt-[3px] truncate text-13 text-muted">
            Saisir un nom et, si possible, un e-mail
          </span>
        </span>
      </button>
    </Screen>
  );
}
