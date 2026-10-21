import { AlphabetIndex } from '#components/alphabet-index';
import { Banner } from '#components/banner';
import { ContactRow } from '#components/contact-row';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { SectionHeader } from '#components/section-header';
import type { Person } from '#fixtures/people';

export type AnnuaireScreenProps = {
  people: Person[];
  /** Letters of the whole directory, for the rail. */
  letters: string[];
  /** The last CSV import: "Import du 18 octobre : 312 personnes". */
  importTitle: string;
  importDetail: string;
};

/** Groups people under their initial, in the order they come. */
function byLetter(people: Person[]) {
  const groups = new Map<string, Person[]>();
  for (const person of people) {
    const letter = person.name[0]!.toUpperCase();
    groups.set(letter, [...(groups.get(letter) ?? []), person]);
  }
  return [...groups];
}

/**
 * The directory, imported from HR rather than typed in: the banner says from
 * which file and when, so a missing newcomer is explained before it is
 * searched for.
 */
export function AnnuaireScreen({
  people,
  letters,
  importTitle,
  importDetail,
}: AnnuaireScreenProps) {
  return (
    <Screen bottomInset={0} className="pb-[calc(var(--safe-bottom)+24px)]">
      <NavBar
        title="Annuaire"
        trailing={<NavBarAction>Importer</NavBarAction>}
      />
      <SearchField placeholder="Nom, service, e-mail" className="mt-3" />
      <Banner
        tone="blue"
        icon="upload"
        title={importTitle}
        description={importDetail}
        className="mt-4"
        classNames={{ root: 'pt-3 pb-[22px]', description: 'leading-4' }}
      />
      <div className="relative">
        {byLetter(people).map(([letter, group], s) => (
          <section key={letter} className={s ? 'mt-[29px]' : 'mt-6'}>
            <SectionHeader title={letter} />
            <div className="mt-[19px]">
              {group.map((person, i) => (
                <ContactRow
                  key={person.id}
                  name={person.name}
                  initials={person.initials}
                  detail={person.department}
                  separator={i < group.length - 1}
                  // The directory rows are 62 px: the text block is as tall
                  // as the avatar, 1 px lower.
                  textClassName="translate-y-px pt-0"
                />
              ))}
            </div>
          </section>
        ))}
        {/* The rail sits in the right gutter, over the list, like iOS. */}
        <AlphabetIndex
          letters={letters}
          className="absolute top-[46px] -right-[18px]"
        />
      </div>
    </Screen>
  );
}
