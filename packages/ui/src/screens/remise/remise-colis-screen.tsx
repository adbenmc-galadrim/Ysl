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
  /**
   * Picked by the name, nothing proves who collects: the agent may have the
   * recipient sign (`onSignature`), never required. A note says something
   * beside « Faire signer »; without `onSignature` the line is greyed out.
   */
  signatureNote?: string;
  /** The recipient signed: the line says so and opens the signature again. */
  signed?: boolean;
  /** The profile requires a signature: the line shows whatever the proof. */
  signatureRequired?: boolean;
  /** The profile requires a photo before the handover. */
  photo?: { taken: boolean; onTake: () => void };
  /** Each parcel scanned against the list: « 1 colis sur 3 scanné ». */
  scan?: { label: string; done: boolean; onScan: () => void };
  /**
   * Who collects, when not the recipient: « Retiré par Paul Mercier ». With
   * `onCollector`, a card under the banner opens the choice.
   */
  collector?: string;
  /** In place of « Retiré par quelqu’un d’autre »: « Paul Mercier, annoncé par e-mail ». */
  announced?: string;
  onCollector?: () => void;
  /** The banner of a registered parcel among those listed. */
  registeredNote?: string;
  /** The handover is being written: the button waits. */
  busy?: boolean;
  onToggle?: (id: string) => void;
  /** « Tout décocher » while all are ticked, « Tout cocher » otherwise. */
  onToggleAll?: () => void;
  onSignature?: () => void;
  onScan?: () => void;
  onSomeoneElse?: () => void;
  onConfirm?: () => void;
  onBack?: () => void;
};

const Done = ({ children }: { children: string }) => (
  <span className="flex items-center gap-2">
    {children}
    <Icon
      name="tick"
      size={16}
      strokeWidth={2.6}
      aria-label="Fait"
      className="text-green"
    />
  </span>
);

/** « Reçu hier · Zalando, recommandé, abîmé »: what to check on the shelf. */
function detailOf(parcel: RemiseParcel): string {
  const flags = [
    parcel.registered && 'recommandé',
    parcel.damaged && 'abîmé',
  ].filter(Boolean);
  const head = parcel.sender
    ? `${parcel.received} · ${parcel.sender}`
    : parcel.received;
  return [head, ...flags].join(', ');
}

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
  signatureNote,
  signed = false,
  signatureRequired = false,
  photo,
  scan,
  collector,
  announced,
  onCollector,
  // The mockup's wording, kept so its reference holds; the app says the
  // signature is optional (D6).
  registeredNote = 'Un recommandé : la signature sera demandée.',
  busy = false,
  onToggle,
  onToggleAll,
  onSignature,
  onScan,
  onSomeoneElse,
  onConfirm,
  onBack,
}: RemiseColisScreenProps) {
  const count = parcels.filter((p) => !excluded.includes(p.id)).length;
  const registered = parcels.some((p) => p.registered);
  const allTicked = count === parcels.length;
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
            disabled={!count || busy || confirmNote !== undefined}
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
      {onCollector && (
        <LinkCard
          icon={collector || announced ? 'users' : 'user'}
          label={
            collector
              ? `Retiré par ${collector}`
              : (announced ?? 'Retiré par quelqu’un d’autre')
          }
          onClick={onCollector}
          className="mt-3"
        />
      )}
      {(verifiedBy === 'name' || signatureRequired) &&
        (signatureNote !== undefined || onSignature) && (
          <LinkCard
            icon="sign"
            label={
              signed ? (
                <Done>Signature ajoutée</Done>
              ) : (
                <>
                  Faire signer
                  {signatureNote && (
                    <span className="ml-2 text-muted">{signatureNote}</span>
                  )}
                </>
              )
            }
            disabled={!onSignature}
            onClick={onSignature}
            className="mt-3 disabled:cursor-default disabled:opacity-60"
          />
        )}
      {photo && (
        <LinkCard
          icon="camera"
          label={photo.taken ? <Done>Photo ajoutée</Done> : 'Prendre la photo'}
          onClick={photo.onTake}
          className="mt-3"
        />
      )}
      {scan && parcels.length > 0 && (
        <LinkCard
          icon="scan"
          label={scan.done ? <Done>{scan.label}</Done> : scan.label}
          onClick={scan.onScan}
          className="mt-3"
        />
      )}
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
            action={
              onToggleAll &&
              parcels.length > 1 && (
                <Button
                  variant="link"
                  onClick={onToggleAll}
                  className="h-auto text-15 font-semibold"
                >
                  {allTicked ? 'Tout décocher' : 'Tout cocher'}
                </Button>
              )
            }
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
                detail={detailOf(parcel)}
                detailTone={
                  parcel.registered || parcel.damaged ? 'orange' : 'muted'
                }
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
          title={registeredNote}
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
