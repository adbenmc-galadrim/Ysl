import type { ReactNode } from 'react';

import { Banner, type BannerProps } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { DetailsList, type DetailsItem } from '#components/details-list';
import { EventHistory, type HistoryEntry } from '#components/event-history';
import { IconButton } from '#components/icon-button';
import { LabelPhoto } from '#components/label-photo';
import { LargeTitle } from '#components/large-title';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { StatusTimeline, type TimelineStep } from '#components/status-timeline';
import { Icon, type IconName } from '#icons';

/**
 * The label photo of the record: the real one, taken on this iPhone, or a
 * word saying it stayed on the iPhone that scanned (photos never leave the
 * device). Left out, the mockup's drawn label stands in.
 */
export type FicheColisPhoto =
  | { src: string; alt?: string; onOpen?: () => void }
  | { absent: string }
  /** Still being read from the iPhone: its room is kept. */
  | { loading: true };

export type FicheColisAction = { label: string; onClick?: () => void };

/**
 * The reserve on the parcel's state: the reason, the remark and when, the
 * photos of the damage — or a word saying they stayed on the iPhone that
 * reported it — and the way to lift it.
 */
export type FicheColisDamage = {
  title: string;
  description?: string;
  photos?: { src: string; alt: string; onOpen?: () => void }[];
  /** The photos were taken on another iPhone. */
  photosAbsent?: string;
  onLift?: () => void;
};

export type FicheColisScreenProps = {
  recipient: string;
  /** Where the recipient sits: "Studio, 2e étage". */
  place: string;
  tracking: string;
  carrier: string;
  /** The grey card that says where the parcel stands, in words. */
  state: {
    icon: IconName;
    title: string;
    description?: string;
    tone?: BannerProps['tone'];
  };
  /** A change of this parcel the server has not taken: not sent, refused. */
  notice?: {
    icon: IconName;
    title: string;
    description?: string;
    tone: 'orange' | 'red';
  };
  /** Reçu, Notifié, Remis; empty for a parcel off that line (returned). */
  steps: TimelineStep[];
  photo?: FicheColisPhoto;
  damage?: FicheColisDamage;
  /** Offered while the parcel carries no reserve. */
  onReportDamage?: () => void;
  details: DetailsItem[];
  history?: HistoryEntry[];
  /** The one black action, which depends on the state: complete, notify. */
  primaryAction?: string;
  onPrimaryAction?: () => void;
  /** A grey action in its place, e.g. taking a step back. */
  secondaryAction?: FicheColisAction;
  onDelete?: () => void;
  onBack?: () => void;
  onEdit?: () => void;
  /** A sheet or the photo viewer, drawn over the record. */
  overlay?: ReactNode;
};

function PhotoSlot({ photo }: { photo?: FicheColisPhoto }) {
  if (!photo) return <LabelPhoto className="mt-5" />;
  if ('loading' in photo) {
    return <div className="mt-5 h-[148px] rounded-control bg-fill" />;
  }
  if ('absent' in photo) {
    return (
      <p className="mt-5 flex items-center gap-2.5 rounded-control bg-fill px-4 py-3.5 text-15 text-muted">
        <Icon name="image" size={20} className="shrink-0" />
        <span className="min-w-0">{photo.absent}</span>
      </p>
    );
  }
  const alt = photo.alt ?? 'Photo de l’étiquette';
  return (
    <button
      type="button"
      onClick={photo.onOpen}
      aria-label={`${alt}, agrandir`}
      className="mt-5 block h-[148px] w-full cursor-zoom-in overflow-hidden rounded-control bg-fill outline-none focus-visible:ring-2 focus-visible:ring-blue"
    >
      <img
        src={photo.src}
        alt=""
        draggable={false}
        className="size-full object-cover"
      />
    </button>
  );
}

function DamageCard({ damage }: { damage: FicheColisDamage }) {
  return (
    <section
      aria-label="Réserve"
      className="mt-3 rounded-control bg-orange-soft pt-3 pr-3 pb-1.5 pl-[13px] text-orange-strong"
    >
      <div className="flex gap-[11px]">
        <Icon name="alert" size={22} className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="text-16 font-semibold">{damage.title}</h2>
          {damage.description && (
            <p className="mt-1 text-14">{damage.description}</p>
          )}
        </div>
      </div>
      {damage.photos && damage.photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 pl-[33px]">
          {damage.photos.map((photo) => (
            <button
              key={photo.src}
              type="button"
              onClick={photo.onOpen}
              aria-label={`${photo.alt}, agrandir`}
              className="size-16 cursor-zoom-in overflow-hidden rounded-[10px] bg-fill outline-none focus-visible:ring-2 focus-visible:ring-blue"
            >
              <img
                src={photo.src}
                alt=""
                draggable={false}
                className="size-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
      {damage.photosAbsent && (
        <p className="mt-2 flex items-center gap-2 pl-[33px] text-13">
          <Icon name="image" size={16} className="shrink-0" />
          <span className="min-w-0">{damage.photosAbsent}</span>
        </p>
      )}
      {damage.onLift && (
        <button
          type="button"
          onClick={damage.onLift}
          className="mt-1 ml-[33px] h-9 text-14 font-semibold outline-none focus-visible:underline"
        >
          Lever la réserve
        </button>
      )}
    </section>
  );
}

/**
 * A parcel's record: who, the tracking number as printed, where it stands,
 * the label photo to check what the scan read, then the details and what
 * happened to it.
 */
export function FicheColisScreen({
  recipient,
  place,
  tracking,
  carrier,
  state,
  notice,
  steps,
  photo,
  damage,
  onReportDamage,
  details,
  history,
  primaryAction,
  onPrimaryAction,
  secondaryAction,
  onDelete,
  onBack,
  onEdit,
  overlay,
}: FicheColisScreenProps) {
  return (
    <>
      <Screen
        bottom={
          // 15 px over the buttons: the hairline is the 16th, as drawn.
          <BottomBar surface="line" className="pt-[15px]">
            <Button
              variant="secondary"
              icon="trash"
              iconSize={20}
              onClick={onDelete}
              className="w-[134px] justify-start gap-2 pr-0 pl-5 text-16"
            >
              Supprimer
            </Button>
            {primaryAction ? (
              <Button className="min-w-0 flex-1" onClick={onPrimaryAction}>
                {primaryAction}
              </Button>
            ) : (
              secondaryAction && (
                <Button
                  variant="secondary"
                  className="min-w-0 flex-1 text-16"
                  onClick={secondaryAction.onClick}
                >
                  {secondaryAction.label}
                </Button>
              )
            )}
          </BottomBar>
        }
      >
        <NavBar
          onBack={onBack}
          trailing={
            <IconButton
              icon="edit"
              label="Modifier"
              size="lg"
              onClick={onEdit}
            />
          }
        />
        <LargeTitle
          size="record"
          title={recipient}
          subtitle={place}
          className="mt-3.5"
        />
        <div className="mt-4 flex items-center justify-between gap-4 border-b border-separator pb-[19px]">
          <span className="truncate font-mono text-16 font-medium">
            {tracking}
          </span>
          <span className="shrink-0 text-15 font-medium text-muted">
            {carrier}
          </span>
        </div>
        {notice && (
          <Banner
            tone={notice.tone}
            icon={notice.icon}
            title={notice.title}
            description={notice.description}
            className="mt-[15px] rounded-control"
          />
        )}
        <Banner
          size="lg"
          tone={state.tone ?? 'grey'}
          icon={state.icon}
          title={state.title}
          description={state.description}
          className={
            notice ? 'mt-3 rounded-control' : 'mt-[15px] rounded-control'
          }
        />
        {damage && <DamageCard damage={damage} />}
        {steps.length > 0 && <StatusTimeline steps={steps} className="mt-6" />}
        <PhotoSlot photo={photo} />
        <DetailsList title="Détails" items={details} className="mt-5" />
        {!damage && onReportDamage && (
          <Button
            variant="secondary"
            icon="alert"
            iconSize={20}
            block
            onClick={onReportDamage}
            className="mt-5 text-16"
          >
            Signaler un dommage
          </Button>
        )}
        {history && history.length > 0 && (
          <EventHistory entries={history} className="mt-7" />
        )}
      </Screen>
      {overlay}
    </>
  );
}
