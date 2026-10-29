import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { ContactRow } from '#components/contact-row';
import { IconButton } from '#components/icon-button';
import { LinkCard } from '#components/link-card';
import { NavBar } from '#components/nav-bar';
import { PageIntro } from '#components/page-intro';
import { Screen } from '#components/screen';
import { SearchField } from '#components/search-field';
import { SectionHeader } from '#components/section-header';

/** A card of the directory or a contact outside it, as the list shows them. */
export type Collectee = {
  id: string;
  name: string;
  initials: string;
  department: string;
};

export type Collector = { person: Collectee; parcels: number };

export type QuiRetireScreenProps = {
  query: string;
  onQueryChange?: (query: string) => void;
  /** Matches with parcels waiting, with how many. */
  waiting: Collector[];
  /** Matches with nothing waiting: shown, so a typo is not mistaken for "no parcel". */
  others: Collectee[];
  onPick?: (person: Collectee) => void;
  onClose?: () => void;
  /** The question, « Qui retire ses colis ? » by default. */
  title?: string;
  /** The bar's title, « Remise » by default. */
  navTitle?: string;
  /** Over the matches with nothing waiting: « Sans colis en attente » by default. */
  othersTitle?: string;
  /** Makes the matches with nothing waiting pickable too: a colleague who collects. */
  onPickOther?: (person: Collectee) => void;
  /** The name as typed, offered as it is: « Utiliser « Paul M. » ». */
  typed?: string;
  onUseTyped?: () => void;
  /** The banner at the bottom; the mockup's by default. */
  note?: string;
};

/**
 * Handover without QR or code: the agent looks the person up by name.
 * People with parcels come first and carry the count, so the usual case is
 * one tap; the banner says up front that a signature will be asked. The
 * same sheet names a colleague who collects (`onPickOther`, `typed`), with
 * its own question and reminder.
 */
export function QuiRetireScreen({
  query,
  onQueryChange,
  waiting,
  others,
  onPick,
  onClose,
  title = 'Qui retire ses colis ?',
  navTitle = 'Remise',
  othersTitle = 'Sans colis en attente',
  onPickOther,
  typed,
  onUseTyped,
  note = 'Sans QR ni code, la signature sera demandée',
}: QuiRetireScreenProps) {
  const offerTyped = !!typed && !!onUseTyped;
  return (
    <Screen>
      <NavBar
        title={navTitle}
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
      <PageIntro size="md" title={title} className="mt-3" />
      <SearchField
        size="form"
        value={query}
        onChange={(e) => onQueryChange?.(e.target.value)}
        placeholder="Nom ou service"
        className="mt-[13px]"
      />
      {offerTyped && (
        <LinkCard
          icon="user"
          label={`Utiliser « ${typed} »`}
          onClick={onUseTyped}
          className="mt-4"
        />
      )}
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
      {!offerTyped &&
        query.trim() !== '' &&
        waiting.length + others.length === 0 && (
          <p role="status" className="mt-8 text-center text-15 text-muted">
            Personne ne correspond à « {query.trim()} ».
          </p>
        )}
      {others.length > 0 && (
        <section className="mt-[33px]">
          <SectionHeader title={othersTitle} />
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
                onClick={onPickOther && (() => onPickOther(person))}
              />
            ))}
          </div>
        </section>
      )}
      <Banner
        tone="blue"
        icon="info"
        title={note}
        // The mockup sets the box to 56 px and the two lines 14 px from its
        // top, so the icon is aligned on the box rather than centred.
        classNames={{ root: 'items-start pt-3.5 pb-1.5', icon: 'mt-1' }}
        className="mt-[103px]"
      />
    </Screen>
  );
}
