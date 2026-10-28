import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { ChoiceCard } from '#components/choice-card';
import { ChoiceTileGrid } from '#components/choice-tile';
import { NavBar } from '#components/nav-bar';
import { PageIntro } from '#components/page-intro';
import { PersonOption, PersonOptionGroup } from '#components/person-option';
import { Screen } from '#components/screen';
import type { Person } from '#fixtures/people';

export type RetireParProof = 'signature' | 'badge';

/** Who the screen offers: the colleague, or the recipient after all. */
export type RetireParChoice = 'collector' | 'recipient';

export type RetireParScreenProps = {
  /** Whose parcels these are. */
  recipient: Pick<Person, 'name' | 'initials'> & { department?: string };
  /** Who is at the desk. */
  collector: Pick<Person, 'name' | 'initials'> & { department?: string };
  /** How the recipient named the colleague: "Réponse à l’e-mail, ce matin à 11 h 02". */
  announcement?: string;
  /** The proof to choose; without it, the QR or the code already stands for the recipient. */
  proof?: RetireParProof;
  onProofChange?: (proof: RetireParProof) => void;
  /** Offers the recipient too, under the colleague: they may come after all. */
  recipientOption?: string;
  selected?: RetireParChoice;
  onSelect?: (choice: RetireParChoice) => void;
  /** In place of the e-mail the recipient gets: a reminder for the agent. */
  note?: string;
  continueLabel?: string;
  onOtherPerson?: () => void;
  onContinue?: () => void;
  onBack?: () => void;
};

const firstName = (person: Pick<Person, 'name'>) => person.name.split(' ')[0];

/**
 * A colleague collects for someone. When the recipient announced them by
 * replying to the notification, that colleague is already picked; the agent
 * only chooses the proof, and the recipient is told by e-mail who took the
 * parcels.
 */
export function RetireParScreen({
  recipient,
  collector,
  announcement,
  proof,
  onProofChange,
  recipientOption,
  selected = 'collector',
  onSelect,
  note,
  continueLabel,
  onOtherPerson,
  onContinue,
  onBack,
}: RetireParScreenProps) {
  return (
    <Screen
      bottom={
        <BottomBar surface="line">
          <Button block onClick={onContinue}>
            {continueLabel ??
              (proof === 'badge'
                ? 'Continuer vers la photo'
                : 'Continuer vers la signature')}
          </Button>
        </BottomBar>
      }
    >
      <NavBar title="Retiré par" onBack={onBack} />
      <PageIntro
        size="sm"
        title={`Qui retire pour ${recipient.name} ?`}
        className="mt-3"
      />
      {announcement && (
        <Banner
          tone="blue"
          icon="users"
          title={`${firstName(recipient)} a annoncé ${collector.name}`}
          description={announcement}
          // The recipient's own words, in the link blue rather than the
          // darker notice blue; fixed 64 px box with the text from the top.
          classNames={{
            root: 'h-16 items-start pb-0 text-blue',
            icon: 'mt-2',
            description: 'leading-[18px]',
          }}
          className="mt-[18px]"
        />
      )}
      {recipientOption ? (
        <PersonOptionGroup label="Qui retire" className="mt-4">
          <PersonOption
            selected={selected === 'collector'}
            initials={collector.initials}
            name={collector.name}
            detail={collector.department}
            onClick={() => onSelect?.('collector')}
            className="h-[72px]"
          />
          <PersonOption
            selected={selected === 'recipient'}
            initials={recipient.initials}
            name={recipient.name}
            detail={recipientOption}
            onClick={() => onSelect?.('recipient')}
            className="h-[72px]"
          />
        </PersonOptionGroup>
      ) : (
        <PersonOption
          selected
          initials={collector.initials}
          name={collector.name}
          detail={collector.department}
          className="mt-4 h-[72px]"
        />
      )}
      <Button
        variant="link"
        size="sm"
        onClick={onOtherPerson}
        className="mt-6 self-start text-15 font-semibold"
      >
        Autre personne
      </Button>
      {proof ? (
        <>
          <p className="mt-8 text-13 font-medium text-muted">Preuve</p>
          <ChoiceTileGrid label="Preuve" className="mt-2">
            <ChoiceCard
              icon="sign"
              label={`Signature de ${firstName(collector)}`}
              selected={proof === 'signature'}
              onClick={() => onProofChange?.('signature')}
            />
            <ChoiceCard
              icon="camera"
              label="Photo du badge"
              selected={proof === 'badge'}
              onClick={() => onProofChange?.('badge')}
            />
          </ChoiceTileGrid>
          <Banner
            tone="grey"
            icon="mail"
            title={`${recipient.name} sera prévenue`}
            description={`Un e-mail lui confirme que ${collector.name} a retiré ses colis.`}
            classNames={{
              root: 'h-[72px] items-start pb-0 text-ink-2',
              icon: 'mt-3',
              description: 'leading-[18px] text-ink-2',
            }}
            className="mt-5"
          />
        </>
      ) : (
        note && (
          <Banner
            tone="grey"
            icon="info"
            title={note}
            classNames={{
              root: 'items-start pt-3.5 pb-3',
              icon: 'mt-0.5',
              title: 'text-14 font-normal',
            }}
            className="mt-8"
          />
        )
      )}
    </Screen>
  );
}
