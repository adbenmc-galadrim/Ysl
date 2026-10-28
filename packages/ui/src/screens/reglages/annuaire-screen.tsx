import { useId } from 'react';

import { AlphabetIndex } from '#components/alphabet-index';
import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { ContactRow } from '#components/contact-row';
import { EmptyState } from '#components/empty-state';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { SectionHeader } from '#components/section-header';

/** A person as the directory lists them: the detail is the department, else the e-mail. */
export type DirectoryEntry = {
  id: string;
  name: string;
  initials: string;
  detail?: string;
};

export type AnnuaireScreenProps = {
  /** The people to show, already filtered and in order. */
  people: DirectoryEntry[];
  /** The contacts outside the directory (F27), already filtered, under the people. */
  contacts?: DirectoryEntry[];
  onSelectContact?: (id: string) => void;
  /** Letters of the rail; by default, the initials of `people`. */
  letters?: string[];
  /** "312 personnes, ajoutées à l’usage". */
  bannerTitle: string;
  bannerDetail: string;
  query?: string;
  onQueryChange?: (query: string) => void;
  onAdd?: () => void;
  onSelect?: (id: string) => void;
  onBack?: () => void;
};

/** The section letter of a name: its first letter, without accent. */
export function letterOf(name: string): string {
  const letter = name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .charAt(0)
    .toUpperCase();
  return /[A-Z]/.test(letter) ? letter : '#';
}

/** Groups people under their initial, in the order they come. */
function byLetter(people: DirectoryEntry[]) {
  const groups = new Map<string, DirectoryEntry[]>();
  for (const person of people) {
    const letter = letterOf(person.name);
    groups.set(letter, [...(groups.get(letter) ?? []), person]);
  }
  return [...groups];
}

/**
 * The directory, built as the desk goes (D15): nobody imports it, every
 * person comes from "Ajouter" here or from a handover. The banner says so,
 * so a missing newcomer reads as "not added yet", not as a fault.
 */
export function AnnuaireScreen({
  people,
  contacts = [],
  onSelectContact,
  letters,
  bannerTitle,
  bannerDetail,
  query = '',
  onQueryChange,
  onAdd,
  onSelect,
  onBack,
}: AnnuaireScreenProps) {
  const sectionId = useId();
  const groups = byLetter(people);
  const rail = letters ?? groups.map(([letter]) => letter);
  const searching = query.trim() !== '';
  const jumpTo = (letter: string) =>
    document
      .getElementById(`${sectionId}-${letter}`)
      ?.scrollIntoView({ block: 'start' });

  return (
    <Screen bottomInset={0} className="pb-[calc(var(--safe-bottom)+24px)]">
      <NavBar
        title="Annuaire"
        onBack={onBack}
        trailing={<NavBarAction onClick={onAdd}>Ajouter</NavBarAction>}
      />
      <SearchField
        placeholder="Nom, service, e-mail"
        className="mt-3"
        value={query}
        onChange={(event) => onQueryChange?.(event.target.value)}
        onClear={() => onQueryChange?.('')}
      />
      {!searching && people.length > 0 && (
        <Banner
          tone="blue"
          icon="users"
          title={bannerTitle}
          description={bannerDetail}
          className="mt-4"
          classNames={{
            root: 'rounded-control pt-3 pb-[22px]',
            description: 'leading-4',
          }}
        />
      )}
      {people.length === 0 && contacts.length === 0 ? (
        searching ? (
          <EmptyState
            icon="search"
            title={`Aucun résultat pour « ${query.trim()} »`}
            description="Cette personne n’est pas encore dans l’annuaire."
            className="mt-12"
          >
            <Button onClick={onAdd}>Ajouter une personne</Button>
          </EmptyState>
        ) : (
          <EmptyState
            icon="users"
            title="L’annuaire est vide"
            description="Ajoutez une personne ici, ou à la remise d’un colis : elle sera proposée sur tous les iPhone du service."
            className="mt-12"
          >
            <Button onClick={onAdd}>Ajouter une personne</Button>
          </EmptyState>
        )
      ) : (
        <div className="relative">
          {groups.map(([letter, group], s) => (
            <section
              key={letter}
              id={`${sectionId}-${letter}`}
              className={s ? 'mt-[29px] scroll-mt-4' : 'mt-6 scroll-mt-4'}
            >
              <SectionHeader title={letter} />
              <div className="mt-[19px]">
                {group.map((person, i) => (
                  <ContactRow
                    key={person.id}
                    name={person.name}
                    initials={person.initials}
                    detail={person.detail}
                    separator={i < group.length - 1}
                    onClick={onSelect ? () => onSelect(person.id) : undefined}
                    // The directory rows are 62 px: the text block is as tall
                    // as the avatar, 1 px lower.
                    textClassName="translate-y-px pt-0"
                  />
                ))}
              </div>
            </section>
          ))}
          {contacts.length > 0 && (
            <section
              aria-label="Contacts hors annuaire"
              className={people.length ? 'mt-[29px]' : 'mt-6'}
            >
              <SectionHeader title="Hors annuaire" count={contacts.length} />
              <p className="mt-1 text-13 text-muted">
                Intérimaires et visiteurs, gardés à la réception d’un colis.
              </p>
              <div className="mt-[13px]">
                {contacts.map((contact, i) => (
                  <ContactRow
                    key={contact.id}
                    name={contact.name}
                    initials={contact.initials}
                    detail={contact.detail}
                    separator={i < contacts.length - 1}
                    onClick={
                      onSelectContact
                        ? () => onSelectContact(contact.id)
                        : undefined
                    }
                    textClassName="translate-y-px pt-0"
                  />
                ))}
              </div>
            </section>
          )}
          {/* The rail sits in the right gutter, over the list, like iOS, and
              stays in view while the list scrolls under it. */}
          {!searching && people.length > 0 && (
            <div className="pointer-events-none absolute inset-y-0 -right-[18px] pt-[46px]">
              <AlphabetIndex
                letters={rail}
                onSelect={jumpTo}
                className="pointer-events-auto sticky top-[calc(var(--safe-top)+16px)]"
              />
            </div>
          )}
        </div>
      )}
    </Screen>
  );
}
