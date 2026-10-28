import type { ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { IconButton } from '#components/icon-button';
import { ListRow } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import { Icon } from '#icons';
import type { RecipientOption } from '#screens/reception/verifier-colis-screen';

/**
 * The directory search of the picker: 48 px, taller than the search screen's
 * box because it is the only control of the screen. It shows a static caret
 * in stories, where a focused `<input>` would blink and break the diff.
 */
function DirectorySearch({
  query,
  showCaret = false,
  onQueryChange,
}: {
  query: string;
  showCaret?: boolean;
  onQueryChange?: (query: string) => void;
}) {
  const controlled = onQueryChange !== undefined;
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
        {...(controlled
          ? {
              value: query,
              onChange: (event) => onQueryChange(event.target.value),
            }
          : { defaultValue: query })}
        aria-label="Rechercher une personne"
        placeholder="Nom, service, e-mail"
        autoComplete="off"
        autoCorrect="off"
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
          onClick={() => onQueryChange?.('')}
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
  /** The people the search finds, or the scanner's suggestions before any search. */
  results: RecipientOption[];
  /** Title of the first section: "Résultats" with a count while searching. */
  resultsTitle?: string;
  recents: RecipientOption[];
  /** Draws the caret of the focused field, for stories. */
  showCaret?: boolean;
  onQueryChange?: (query: string) => void;
  onClose?: () => void;
  onPick?: (id: string) => void;
  /** "Personne hors annuaire": a new card for someone not listed yet. */
  onOutside?: () => void;
  /** Under the list, e.g. taking away the recipient chosen so far. */
  footer?: ReactNode;
  /** The bar's title: « Destinataire », or who comes for the parcel. */
  title?: string;
  /** The dashed card's two lines, for a name typed rather than a card. */
  outsideTitle?: string;
  outsideDescription?: string;
};

const rows = (
  people: RecipientOption[],
  withEmail: boolean,
  onPick?: (id: string) => void,
) =>
  people.map((person, i) => (
    <ListRow
      key={person.id}
      align="center"
      leading={<Avatar initials={person.initials} tone="fill" />}
      title={person.name}
      lines={[
        ...(person.detail ? [{ text: person.detail }] : []),
        ...(withEmail && person.email ? [{ text: person.email }] : []),
      ]}
      separator={i < people.length - 1}
      onClick={() => onPick?.(person.id)}
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
  resultsTitle = 'Résultats',
  recents,
  showCaret,
  onQueryChange,
  onClose,
  onPick,
  onOutside,
  footer,
  title = 'Destinataire',
  outsideTitle = 'Personne hors annuaire',
  outsideDescription = 'Saisir un nom et, si possible, un e-mail',
}: ChoisirDestinataireScreenProps) {
  const searching = query.trim() !== '';
  return (
    <Screen>
      <NavBar
        title={title}
        leading={
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            onClick={onClose}
            // The bar pads a text action; the square bleeds like the back one.
            className="-ml-0.5"
          />
        }
      />
      <div className="mt-3">
        <DirectorySearch
          query={query}
          showCaret={showCaret}
          onQueryChange={onQueryChange}
        />
      </div>

      {results.length > 0 && (
        <section className="mt-6">
          <SectionHeader
            title={resultsTitle}
            count={searching ? results.length : undefined}
          />
          <div className="mt-[13px]">{rows(results, true, onPick)}</div>
        </section>
      )}
      {searching && results.length === 0 && (
        <p className="mt-6 text-15 text-muted">
          Personne dans l’annuaire pour « {query.trim()} ».
        </p>
      )}

      {recents.length > 0 && (
        <section className="mt-[22px]">
          <SectionHeader title="Récents" />
          <div className="mt-[13px]">{rows(recents, false, onPick)}</div>
        </section>
      )}

      <button
        type="button"
        onClick={onOutside}
        className="mt-5 flex h-16 cursor-pointer items-center gap-[15px] rounded-card border border-dashed border-border pb-0.5 pl-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-blue"
      >
        <Icon name="user" size={22} className="shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-16 font-semibold">{outsideTitle}</span>
          <span className="mt-[3px] truncate text-13 text-muted">
            {outsideDescription}
          </span>
        </span>
      </button>
      {footer}
    </Screen>
  );
}
