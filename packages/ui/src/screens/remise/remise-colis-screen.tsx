import { Avatar } from '#components/avatar';
import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { LinkCard } from '#components/link-card';
import { NavBar } from '#components/nav-bar';
import { ParcelCheckRow } from '#components/parcel-check-row';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import type { HandoverParcel } from '#fixtures/handover';
import type { Person } from '#fixtures/people';
import { Icon } from '#icons';

export type RemiseColisScreenProps = {
  recipient: Person;
  /** Where to find them, after the department: "3e étage". */
  location?: string;
  /** "QR code vérifié à 11 h 20". */
  verified: string;
  parcels: HandoverParcel[];
  /** Ids of the parcels unticked by the agent; all are handed over by default. */
  excluded?: string[];
  onToggle?: (id: string) => void;
  onScan?: () => void;
  onSomeoneElse?: () => void;
  onConfirm?: () => void;
};

/**
 * The recipient is identified; this lists everything waiting for them so
 * the agent fetches it in one trip. The count on the button is the count
 * ticked, so a parcel left on the shelf is never recorded as handed over.
 */
export function RemiseColisScreen({
  recipient,
  location,
  verified,
  parcels,
  excluded = [],
  onToggle,
  onScan,
  onSomeoneElse,
  onConfirm,
}: RemiseColisScreenProps) {
  const count = parcels.filter((p) => !excluded.includes(p.id)).length;
  const registered = parcels.some((p) => p.registered);
  return (
    <Screen
      bottom={
        <BottomBar surface="line">
          <Button block disabled={!count} onClick={onConfirm}>
            Remettre {count} colis
          </Button>
        </BottomBar>
      }
    >
      <NavBar />
      <header className="mt-3 flex items-start gap-3.5">
        <Avatar initials={recipient.initials} size="xl" />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-26 font-bold">{recipient.name}</h1>
          <p className="mt-[3px] truncate text-15 text-muted">
            {location
              ? `${recipient.department}, ${location}`
              : recipient.department}
          </p>
        </div>
      </header>
      <Banner
        tone="green"
        icon="check"
        title={verified}
        classNames={{ root: 'h-[52px] items-start rounded-control pt-4 pb-0' }}
        className="mt-5"
      />
      <SectionHeader title="Ses colis" count={parcels.length} className="mt-[26px]" />
      <div className="mt-[21px]">
        {parcels.map((parcel, i) => (
          <ParcelCheckRow
            key={parcel.id}
            title={`${parcel.carrier} ···${parcel.last4}`}
            detail={
              parcel.registered
                ? `${parcel.received}, recommandé`
                : parcel.received
            }
            detailTone={parcel.registered ? 'orange' : 'muted'}
            checked={!excluded.includes(parcel.id)}
            onToggle={() => onToggle?.(parcel.id)}
            separator={i < parcels.length - 1}
          />
        ))}
      </div>
      {/* Dashed: an optional check, not a step every handover goes through.
          An SVG stroke rather than `border-dashed`, whose dashes are too
          short next to Penpot's 10 px ones. */}
      <Button
        variant="outline"
        block
        onClick={onScan}
        // The mockup sets icon and label 15 px left of the middle.
        className="relative mt-[25px] gap-2.5 rounded-control border-0 pr-[30px] pl-0 text-15"
      >
        <svg aria-hidden="true" className="absolute inset-0 size-full overflow-visible">
          <rect
            x="0.5"
            y="0.5"
            rx="13.5"
            fill="none"
            strokeDasharray="10 10"
            className="h-[calc(100%-1px)] w-[calc(100%-1px)] stroke-border"
          />
        </svg>
        <Icon name="scan" size={20} />
        Scanner pour vérifier
      </Button>
      <LinkCard
        icon="user"
        label="Retiré par quelqu’un d’autre"
        onClick={onSomeoneElse}
        className="mt-6"
      />
      {registered && (
        <Banner
          tone="orange"
          icon="info"
          title="Un recommandé : la signature sera demandée."
          classNames={{
            root: 'h-[52px] items-start rounded-control pt-4 pb-0',
            title: 'text-14 font-normal',
          }}
          className="mt-4"
        />
      )}
    </Screen>
  );
}
