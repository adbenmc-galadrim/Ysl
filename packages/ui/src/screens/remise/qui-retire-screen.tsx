import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { ContactRow } from '#components/contact-row';
import { IconButton } from '#components/icon-button';
import { NavBar } from '#components/nav-bar';
import { PageIntro } from '#components/page-intro';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { SectionHeader } from '#components/section-header';
import type { Person } from '#fixtures/people';

export type Collector = { person: Person; parcels: number };

export type QuiRetireScreenProps = {
  query: string;
  onQueryChange?: (query: string) => void;
  /** Matches with parcels waiting, with how many. */
  waiting: Collector[];
  /** Matches with nothing waiting: shown, so a typo is not mistaken for "no parcel". */
  others: Person[];
  onPick?: (person: Person) => void;
  onClose?: () => void;
};

/**
 * Handover without QR or code: the agent looks the person up by name.
 * People with parcels come first and carry the count, so the usual case is
 * one tap; the banner says up front that a signature will be asked.
 */
export function QuiRetireScreen({
  query,
  onQueryChange,
  waiting,
  others,
  onPick,
  onClose,
}: QuiRetireScreenProps) {
  return (
    <Screen>
      <NavBar
        title="Remise"
        leading={
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            onClick={onClose}
            className="-ml-0.5"
          />
        }
      />
      <PageIntro size="md" title="Qui retire ses colis ?" className="mt-3" />
      <SearchField
        size="form"
        value={query}
        onChange={(e) => onQueryChange?.(e.target.value)}
        placeholder="Nom ou service"
        className="mt-[13px]"
      />
      {waiting.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Avec des colis en attente" />
          <div className="mt-[23px]">
            {waiting.map(({ person, parcels }, i) => (
              <ContactRow
                key={person.id}
                name={person.name}
                initials={person.initials}
                detail={person.department}
                // Here the two lines sit 1 px under the avatar's top, on a
                // 40 px row: no top pad, a 1 px nudge.
                textClassName="translate-y-px pt-0"
                separator={i < waiting.length - 1}
                onClick={() => onPick?.(person)}
                trailing={
                  <Button
                    variant="secondary"
                    size="xs"
                    tabIndex={-1}
                    className="w-[81px]"
                  >
                    {parcels} colis
                  </Button>
                }
              />
            ))}
          </div>
        </section>
      )}
      {others.length > 0 && (
        <section className="mt-[33px]">
          <SectionHeader title="Sans colis en attente" />
          <div className="mt-[23px]">
            {others.map((person, i) => (
              <ContactRow
                key={person.id}
                name={person.name}
                initials={person.initials}
                detail={person.department}
                // Here the two lines sit 1 px under the avatar's top, on a
                // 40 px row: no top pad, a 1 px nudge.
                textClassName="translate-y-px pt-0"
                separator={i < others.length - 1}
                trailing={null}
              />
            ))}
          </div>
        </section>
      )}
      <Banner
        tone="blue"
        icon="info"
        title="Sans QR ni code, la signature sera demandée"
        // The mockup sets the box to 56 px and the two lines 14 px from its
        // top, so the icon is aligned on the box rather than centred.
        classNames={{ root: 'items-start pt-3.5 pb-1.5', icon: 'mt-1' }}
        className="mt-[103px]"
      />
    </Screen>
  );
}
