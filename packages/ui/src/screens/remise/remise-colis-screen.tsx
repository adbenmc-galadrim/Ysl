import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { EmptyState } from '#components/empty-state';
import { NavBar } from '#components/nav-bar';
import {
  KraftThumb,
  PhoneBanner,
  PhoneRow,
  PhoneSection,
  TickMark,
} from '#components/phone-parts';
import { Screen } from '#components/screen';
import type { HandoverParcel } from '#fixtures/handover';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

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
  verified?: string;
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
  /** The shuttle stands in for a department: said at the top (profile « Petit site »). */
  standIn?: { title: string; description: string };
  /** Ids of the parcels unticked by the agent; all are handed over by default. */
  excluded?: string[];
  /**
   * Picked by the name, nothing proves who collects: the agent may have the
   * recipient sign (`onSignature`), unless the profile requires it. A note says something
   * beside « Faire signer »; without `onSignature` the line is greyed out.
   */
  signatureNote?: string;
  /** The recipient signed: the line says so and opens the signature again. */
  signed?: boolean;
  /** The profile requires a signature: the line shows whatever the proof. */
  signatureRequired?: boolean;
  /** The profile requires a photo before the handover. */
  photo?: { taken: boolean; onTake: () => void };
  /** Each parcel scanned against the list: « 1 sur 3 colis scannés ». */
  scan?: {
    label: string;
    done: boolean;
    /** The company asks for it: the main button scans until all are read. */
    required?: boolean;
    /** Over `label` on that button: « Scanner les 2 colis ». */
    action?: string;
    /** What the banner says of the rule. */
    banner?: { title: string; description: string };
    onScan: () => void;
  };
  /**
   * Who collects, when not the recipient: « Retiré par Paul Mercier ». With
   * `onCollector`, a line under the list opens the choice.
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
  onConfirm?: () => void;
  onBack?: () => void;
};

/** A line of the grey card under the list: an icon tile, what it does, how it stands. */
function OptionRow({
  icon,
  label,
  value,
  done = false,
  disabled = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  value?: string;
  done?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex h-[52px] w-full cursor-pointer items-center pl-3.5 text-left text-16 not-first:border-t-0 disabled:cursor-default disabled:opacity-60"
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-muted text-white">
        <Icon name={icon} size={16} />
      </span>
      <span className="ml-3.5 min-w-0 flex-1 truncate">{label}</span>
      {done && (
        <Icon
          name="tick"
          size={16}
          strokeWidth={2.6}
          aria-label="Fait"
          className="mr-1.5 text-green"
        />
      )}
      {value && <span className="mr-1.5 text-muted">{value}</span>}
      <Icon name="chevron" size={16} className="mr-3.5 text-faint" />
    </button>
  );
}

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
  standIn,
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
  // signature is optional unless the profile requires it (D6).
  registeredNote = 'Un recommandé : la signature sera demandée.',
  busy = false,
  onToggle,
  onToggleAll,
  onSignature,
  onConfirm,
  onBack,
}: RemiseColisScreenProps) {
  const count = parcels.filter((p) => !excluded.includes(p.id)).length;
  const registered = parcels.some((p) => p.registered);
  const allTicked = count === parcels.length;
  const scanFirst = scan?.required && !scan.done && parcels.length > 0;
  const signatureLine =
    (onSignature !== undefined || signatureNote !== undefined) &&
    parcels.length > 0;
  return (
    <Screen
      bottom={
        <BottomBar
          surface="plain"
          className={cn(
            'pt-6 pb-9',
            confirmNote && !scanFirst && 'flex-col gap-0',
          )}
        >
          {confirmNote && !scanFirst && (
            <p className="mb-3 text-center text-14 text-muted">{confirmNote}</p>
          )}
          {scanFirst ? (
            <Button
              block
              icon="scan"
              iconSize={20}
              onClick={scan.onScan}
              className="gap-2"
            >
              {scan.action ?? scan.label}
            </Button>
          ) : (
            <Button
              block
              disabled={!count || busy || confirmNote !== undefined}
              onClick={onConfirm}
            >
              Remettre {count} colis
            </Button>
          )}
        </BottomBar>
      }
    >
      <NavBar onBack={onBack} />
      <header className="mt-3 flex h-[52px] shrink-0 gap-3">
        <span className="flex size-[52px] shrink-0 items-center justify-center rounded-full bg-ink text-[19px] leading-[23px] font-semibold text-on-ink">
          {recipient.initials}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-26 font-bold">{recipient.name}</h1>
          {recipient.department && (
            <p className="relative -top-px mt-[3px] truncate text-14 text-muted">
              {location
                ? `${recipient.department} · ${location}`
                : recipient.department}
            </p>
          )}
        </div>
      </header>
      {standIn && (
        <PhoneBanner
          icon="truck"
          title={standIn.title}
          description={standIn.description}
          height={83}
          descriptionClassName="text-ink"
          className="mt-[26px]"
        />
      )}
      {verified && (
        <div
          className={cn(
            'mt-5 flex h-11 shrink-0 items-center gap-2.5 rounded-[12px] pl-3.5 text-15 font-semibold',
            verifiedBy === 'proof'
              ? 'bg-green-soft text-green'
              : 'bg-blue-soft text-blue-strong',
          )}
        >
          <Icon name={verifiedBy === 'proof' ? 'check' : 'info'} size={18} />
          {verified}
        </div>
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
          <div
            className={cn(
              'flex items-center justify-between',
              standIn ? 'mt-[27px]' : 'mt-5',
            )}
          >
            <PhoneSection title="Ses colis" count={parcels.length} />
            {onToggleAll && parcels.length > 1 && (
              <Button
                variant="link"
                onClick={onToggleAll}
                className="h-auto text-15 font-semibold"
              >
                {allTicked ? 'Tout décocher' : 'Tout cocher'}
              </Button>
            )}
          </div>
          <div className="mt-2.5">
            {parcels.map((parcel, i) => {
              const checked = !excluded.includes(parcel.id);
              return (
                <button
                  key={parcel.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => onToggle?.(parcel.id)}
                  className="block w-full cursor-pointer text-left"
                >
                  <PhoneRow
                    leading={<KraftThumb />}
                    title={
                      parcel.last4
                        ? `${parcel.carrier} ···${parcel.last4}`
                        : parcel.carrier
                    }
                    lines={[
                      parcel.registered || parcel.damaged ? (
                        <span className="text-orange">{detailOf(parcel)}</span>
                      ) : (
                        detailOf(parcel)
                      ),
                    ]}
                    mark={<TickMark checked={checked} />}
                    separator={i < parcels.length - 1}
                  />
                </button>
              );
            })}
          </div>
        </>
      )}
      {scan?.banner && parcels.length > 0 && (
        <PhoneBanner
          icon="scan"
          iconClassName="text-ink-2"
          title={scan.banner.title}
          description={scan.banner.description}
          height={83}
          className="mt-4"
        />
      )}
      {parcels.length > 0 && (
        <div className="mt-[11px] shrink-0 divide-y divide-separator overflow-hidden rounded-[14px] bg-fill">
          {onCollector && (
            <OptionRow
              icon={collector || announced ? 'users' : 'user'}
              label={
                collector
                  ? `Retiré par ${collector}`
                  : (announced ?? 'Retiré par quelqu’un d’autre')
              }
              onClick={onCollector}
            />
          )}
          {signatureLine && (
            <OptionRow
              icon="sign"
              label={signed ? 'Signature ajoutée' : 'Faire signer'}
              done={signed}
              value={
                signed
                  ? undefined
                  : (signatureNote ??
                    (signatureRequired ? 'Obligatoire' : 'Facultatif'))
              }
              disabled={!onSignature}
              onClick={onSignature}
            />
          )}
          {photo && (
            <OptionRow
              icon="camera"
              label={photo.taken ? 'Photo ajoutée' : 'Prendre la photo'}
              done={photo.taken}
              onClick={photo.onTake}
            />
          )}
          {scan && !scanFirst && (
            <OptionRow
              icon="scan"
              label={scan.label}
              done={scan.done}
              onClick={scan.onScan}
            />
          )}
        </div>
      )}
      {registered && (
        <p className="mt-4 shrink-0 rounded-[12px] bg-orange-soft px-3.5 py-3 text-14 text-orange">
          {registeredNote}
        </p>
      )}
    </Screen>
  );
}
