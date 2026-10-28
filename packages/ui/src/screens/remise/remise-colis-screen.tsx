import { Avatar } from '#components/avatar';
import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { EmptyState } from '#components/empty-state';
import { LinkCard } from '#components/link-card';
import { NavBar } from '#components/nav-bar';
import { ParcelCheckRow } from '#components/parcel-check-row';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import type { HandoverParcel } from '#fixtures/handover';
import { Icon } from '#icons';

export type RemiseParcel = HandoverParcel;

/** Who collects: a card of the directory or a contact outside it. */
export type RemiseRecipient = {
  name: string;
  initials: string;
  department?: string;
};

export type RemiseColisScreenProps = {
  recipient: RemiseRecipient;
  /** Where to find them, after the department: "3e étage". */
  location?: string;
  /** "QR code vérifié à 11 h 20", or how the person was picked. */
  verified: string;
  /**
   * `proof`: a QR or a code was checked, the banner is green. `name`: the
   * agent picked the person, nothing was checked, the banner only informs.
   */
  verifiedBy?: 'proof' | 'name';
  parcels: RemiseParcel[];
  /** Under the empty list: « Rien n’attend Nora au comptoir. » */
  empty?: string;
  /**
   * The handover cannot be recorded yet: the button stays greyed out and
   * this says why, above it.
   */
  confirmNote?: string;
  /** « Scanner pour vérifier » and « Retiré par quelqu’un d’autre ». */
  extras?: boolean;
  /** Ids of the parcels unticked by the agent; all are handed over by default. */
  excluded?: string[];
  onToggle?: (id: string) => void;
  onScan?: () => void;
  onSomeoneElse?: () => void;
  onConfirm?: () => void;
  onBack?: () => void;
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
  verifiedBy = 'proof',
  parcels,
  empty,
  confirmNote,
  extras = true,
  excluded = [],
  onToggle,
  onScan,
  onSomeoneElse,
  onConfirm,
  onBack,
}: RemiseColisScreenProps) {
  const count = parcels.filter((p) => !excluded.includes(p.id)).length;
  const registered = parcels.some((p) => p.registered);
  return (
    <Screen
      bottom={
        <BottomBar
          surface="line"
          className={confirmNote ? 'flex-col gap-0' : undefined}
        >
          {confirmNote && (
            <p className="mb-3 text-center text-14 text-muted">{confirmNote}</p>
          )}
          <Button
            block
            disabled={!count || confirmNote !== undefined}
            onClick={onConfirm}
          >
            Remettre {count} colis
          </Button>
        </BottomBar>
      }
    >
      <NavBar onBack={onBack} />
      <header className="mt-3 flex items-start gap-3.5">
        <Avatar initials={recipient.initials} size="xl" />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate text-26 font-bold">{recipient.name}</h1>
          {recipient.department && (
            <p className="mt-[3px] truncate text-15 text-muted">
              {location
                ? `${recipient.department}, ${location}`
                : recipient.department}
            </p>
          )}
        </div>
      </header>
      <Banner
        tone={verifiedBy === 'proof' ? 'green' : 'blue'}
        icon={verifiedBy === 'proof' ? 'check' : 'info'}
        title={verified}
        classNames={{ root: 'h-[52px] items-start rounded-control pt-4 pb-0' }}
        className="mt-5"
      />
      {parcels.length === 0 ? (
        <EmptyState
          icon="inbox"
          title="Aucun colis en attente"
          description={empty}
          className="mt-12"
        />
      ) : (
        <>
          <SectionHeader
            title="Ses colis"
            count={parcels.length}
            className="mt-[26px]"
          />
          <div className="mt-[21px]">
            {parcels.map((parcel, i) => (
              <ParcelCheckRow
                key={parcel.id}
                title={
                  parcel.last4
                    ? `${parcel.carrier} ···${parcel.last4}`
                    : parcel.carrier
                }
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
        </>
      )}
      {extras && parcels.length > 0 && (
        <>
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
            <svg
              aria-hidden="true"
              className="absolute inset-0 size-full overflow-visible"
            >
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
        </>
      )}
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
