import { useEffect, type ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { EmptyState } from '#components/empty-state';
import {
  GroupedFootnote,
  GroupedHeader,
  GroupedList,
  GroupedSection,
} from '#components/grouped-list';
import { NavBar } from '#components/nav-bar';
import {
  SCAN_FIELD_STATUS,
  type ScanFieldStatus,
} from '#components/scan-fields';
import { Screen } from '#components/screen';
import type { FicheColisPhoto } from '#screens/colis/fiche-colis-screen';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

/** One source behind a value: its §4.3 rank, what it is, what it read, how sure. */
export type LectureSource = {
  rank: string;
  label: string;
  value?: string;
  confidence: string;
};

/** A step between the best source and the score shown: "Concordance", "+0,04". */
export type LectureAdjustment = { label: string; delta: string };

/** A value the reader weighed and did not keep. */
export type LectureOther = { value: string; confidence: string };

export type LectureField = {
  /** Anchor of the field's card: the link « D'où vient cette valeur ? » lands on it. */
  id: string;
  label: string;
  /** The value kept, or what says none was. */
  value: string;
  status: ScanFieldStatus;
  /** « Lu », « À vérifier », « Non lu ». */
  statusLabel: string;
  confidence: string;
  mono?: boolean;
  sources: LectureSource[];
  adjustments: LectureAdjustment[];
  others?: LectureOther[];
  /** Grey line under the card: why it shows that way. */
  note?: string;
};

/** A code as the reader decoded it, and whether a parser understood it. */
export type LectureCode = {
  format: string;
  text: string;
  parser: string;
  recognized: boolean;
};

/** A line of the printed text; `mark` names the field it gave a value to. */
export type LectureLine = { text: string; mark?: string };

export type LectureFact = { label: string; value: string };

export type LectureScreenProps = {
  title?: string;
  /** "Lu le 20 oct. à 9 h 00 sur cet iPhone". */
  subtitle?: string;
  photo?: FicheColisPhoto;
  fields?: LectureField[];
  codes?: LectureCode[];
  lines?: LectureLine[];
  /** Times per step, rules version. */
  facts?: LectureFact[];
  /** Nothing to show: never read, purged, read on another iPhone. */
  empty?: { icon: IconName; title: string; description?: string };
  copy?: {
    label: string;
    onClick?: () => void;
    /** Said in place of the label once the text is on the clipboard. */
    done?: string;
    /** Said under the button when the copy failed. */
    failed?: string;
  };
  /** The field card to scroll to on open. */
  focus?: string;
  onBack?: () => void;
  /** The photo viewer, drawn over the screen. */
  overlay?: ReactNode;
};

const STATUS_ICON: Record<ScanFieldStatus, IconName> = {
  ok: 'check',
  warning: 'alert',
  error: 'alert',
};

function PhotoCard({ photo }: { photo: FicheColisPhoto }) {
  if ('loading' in photo) {
    return <div className="h-[148px] rounded-control bg-surface" />;
  }
  if ('absent' in photo) {
    return (
      <p className="flex items-center gap-2.5 rounded-control bg-surface px-4 py-3.5 text-15 text-muted">
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
      className="block h-[148px] w-full cursor-zoom-in overflow-hidden rounded-control bg-surface outline-none focus-visible:ring-2 focus-visible:ring-blue"
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

/** A row of a card that wraps instead of truncating: raw codes are long. */
function Row({
  children,
  trailing,
  className,
}: {
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex min-h-[44px] items-start gap-3 py-[11px] pr-4 pl-4',
        'not-first:before:absolute not-first:before:inset-x-0 not-first:before:top-0 not-first:before:ml-4 not-first:before:h-px not-first:before:bg-separator',
        className,
      )}
    >
      <div className="min-w-0 flex-1">{children}</div>
      {trailing && (
        <span className="shrink-0 text-15 text-muted tabular-nums">
          {trailing}
        </span>
      )}
    </div>
  );
}

function FieldCard({ field }: { field: LectureField }) {
  const hue = SCAN_FIELD_STATUS.light[field.status];
  return (
    <section id={field.id} className="flex scroll-mt-3 flex-col">
      <GroupedHeader className="mb-1.5">{field.label}</GroupedHeader>
      <GroupedList>
        <Row trailing={field.confidence}>
          <p
            className={cn(
              'text-16 font-semibold break-words',
              field.mono && 'font-mono',
            )}
          >
            {field.value}
          </p>
          <p className={cn('mt-1 flex items-center gap-1.5 text-14', hue)}>
            <Icon
              name={STATUS_ICON[field.status]}
              size={16}
              className="shrink-0"
            />
            {field.statusLabel}
          </p>
        </Row>
        {field.sources.map((source, i) => (
          <Row key={`s${i}`} trailing={source.confidence}>
            <p className="text-15">
              <span className="mr-2 inline-flex h-5 items-center rounded-chip bg-fill px-1.5 text-12 font-semibold tabular-nums">
                {source.rank}
              </span>
              {source.label}
            </p>
            {source.value && (
              <p className="mt-0.5 font-mono text-13 break-all text-muted">
                {source.value}
              </p>
            )}
          </Row>
        ))}
        {field.adjustments.map((adjustment, i) => (
          <Row key={`a${i}`} trailing={adjustment.delta}>
            <p className="text-15">{adjustment.label}</p>
          </Row>
        ))}
        {field.others?.map((other, i) => (
          <Row key={`o${i}`} trailing={other.confidence}>
            <p className="text-15 text-muted">
              Autre valeur lue :{' '}
              <span className="font-mono break-all text-ink">
                {other.value}
              </span>
            </p>
          </Row>
        ))}
      </GroupedList>
      {field.note && (
        <GroupedFootnote className="mt-3 mb-1.5">{field.note}</GroupedFootnote>
      )}
    </section>
  );
}

/**
 * What the reader made of one label (F22), to understand a wrong value
 * without a computer: the photo, then every field with the sources behind
 * its value, their rank and confidence, and how the score moved; the codes
 * as decoded, the printed text line by line, the time each step took.
 */
export function LectureScreen({
  title = 'Ce qui a été lu',
  subtitle,
  photo,
  fields = [],
  codes = [],
  lines = [],
  facts = [],
  empty,
  copy,
  focus,
  onBack,
  overlay,
}: LectureScreenProps) {
  useEffect(() => {
    if (focus) document.getElementById(focus)?.scrollIntoView();
  }, [focus]);

  return (
    <>
      <Screen
        tone="fill"
        bottomInset={copy ? 128 : 0}
        className={copy ? undefined : 'pb-[calc(var(--safe-bottom)+24px)]'}
        bottom={
          copy && (
            <BottomBar surface="line">
              <div className="flex w-full flex-col">
                <Button
                  block
                  variant="secondary"
                  icon={copy.done ? 'check' : 'copy'}
                  onClick={copy.onClick}
                  aria-live="polite"
                >
                  {copy.done ?? copy.label}
                </Button>
                {copy.failed && (
                  <p role="alert" className="mt-2 text-center text-13 text-red">
                    {copy.failed}
                  </p>
                )}
              </div>
            </BottomBar>
          )
        }
      >
        <NavBar title={title} onBack={onBack} />
        {subtitle && (
          <p className="mt-1 text-center text-13 text-muted">{subtitle}</p>
        )}
        {empty ? (
          <EmptyState
            icon={empty.icon}
            title={empty.title}
            description={empty.description}
            className="mt-[129px]"
          />
        ) : (
          <div className="mt-4 flex flex-col gap-5">
            {photo && (
              <section className="flex flex-col">
                <GroupedHeader className="mb-1.5">
                  Photo de l’étiquette
                </GroupedHeader>
                <PhotoCard photo={photo} />
              </section>
            )}
            {fields.map((field) => (
              <FieldCard key={field.id} field={field} />
            ))}
            <GroupedSection header={`Codes décodés (${codes.length})`}>
              {codes.length > 0 ? (
                codes.map((code, i) => (
                  <Row key={i}>
                    <p className="flex items-center justify-between gap-3 text-15">
                      <span className="font-semibold">{code.format}</span>
                      <span
                        className={cn(
                          'text-14',
                          code.recognized ? 'text-green' : 'text-muted',
                        )}
                      >
                        {code.parser}
                      </span>
                    </p>
                    <p className="mt-1 font-mono text-13 break-all text-muted">
                      {code.text}
                    </p>
                  </Row>
                ))
              ) : (
                <Row>
                  <p className="text-15 text-muted">Aucun code lu</p>
                </Row>
              )}
            </GroupedSection>
            <GroupedSection header={`Texte lu (${lines.length} lignes)`}>
              {lines.length > 0 ? (
                <ol className="flex flex-col py-2">
                  {lines.map((line, i) => (
                    <li
                      key={i}
                      className={cn(
                        'flex items-baseline gap-3 px-4 py-1 font-mono text-13',
                        line.mark && 'bg-blue-soft',
                      )}
                    >
                      <span className="min-w-0 flex-1 break-all">
                        {line.text}
                      </span>
                      {line.mark && (
                        <span className="shrink-0 font-sans text-12 font-semibold text-blue">
                          {line.mark}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <Row>
                  <p className="text-15 text-muted">Aucun texte lu</p>
                </Row>
              )}
            </GroupedSection>
            {facts.length > 0 && (
              <GroupedSection header="Lecture">
                {facts.map((fact) => (
                  <Row key={fact.label} trailing={fact.value}>
                    <p className="text-15">{fact.label}</p>
                  </Row>
                ))}
              </GroupedSection>
            )}
          </div>
        )}
      </Screen>
      {overlay}
    </>
  );
}
