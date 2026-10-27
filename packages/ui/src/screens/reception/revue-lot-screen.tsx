import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CheckCircle } from '#components/checkbox';
import { LabelThumb } from '#components/label-thumb';
import { ListRow, type ListRowLine } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { PageIntro } from '#components/page-intro';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';

/** One parcel of the batch as the review lists it. */
export type ReviewRow = {
  id: string;
  /** Who it is for; null when that is the doubt, which then titles the row. */
  name: string | null;
  /** What needs the agent: "Destinataire incertain"; none on a ready row. */
  issue?: string;
  /** What the scanner did read, in grey. */
  lines: string[];
  /** The photo; the drawn label when there is none. */
  thumbnail?: ReactNode;
};

export type RevueLotScreenProps = {
  /** Parcels read in the burst, all saved by the button. */
  count: number;
  summary: string;
  toCheck: ReviewRow[];
  /** Parcels the agent passed: saved « À compléter ». */
  toComplete?: ReviewRow[];
  /** The ready parcels drawn; `readyCount` is the real total. */
  ready: ReviewRow[];
  readyCount?: number;
  saving?: boolean;
  onBack?: () => void;
  /** Opens « Vérifier un colis » on that parcel. */
  onOpen?: (id: string) => void;
  onSave?: () => void;
};

/** The 44 px photo thumbnail, drawn at its exact box. */
const thumb = <LabelThumb width={44} height={44} radius={8} barMargin={4} />;

/**
 * A doubtful row: when the scanner doubts the recipient, the doubt *is* the
 * title; a doubtful number or weight stays under the name, still worth
 * reading.
 */
const doubtLines = ({ name, issue, lines }: ReviewRow): ListRowLine[] => [
  ...(name && issue
    ? [
        {
          // Orange but regular: a note, not a heading.
          text: <span className="font-normal">{issue}</span>,
          tone: 'orange' as const,
        },
      ]
    : []),
  ...lines.map((text) => ({ text })),
];

function DoubtSection({
  title,
  rows,
  onOpen,
  className,
}: {
  title: string;
  rows: ReviewRow[];
  onOpen?: (id: string) => void;
  className?: string;
}) {
  return (
    <section className={className}>
      <SectionHeader title={title} count={rows.length} />
      <div className="mt-[13px]">
        {rows.map((row, i) => (
          <ListRow
            key={row.id}
            align="center"
            leading={row.thumbnail ?? thumb}
            title={row.name ?? row.issue}
            titleTone={row.name ? 'ink' : 'orange'}
            lines={doubtLines(row)}
            separator={i < rows.length - 1}
            separatorInset={56}
            onClick={() => onOpen?.(row.id)}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Batch review, between the burst and saving. What needs the agent comes
 * first, least sure on top, and opens to a fix; the parcels passed wait
 * « À compléter »; the ready parcels follow with a tick and are saved with
 * the batch, so a long batch is checked by scrolling, not by reading.
 */
export function RevueLotScreen({
  count,
  summary,
  toCheck,
  toComplete = [],
  ready,
  readyCount = ready.length,
  saving = false,
  onBack,
  onOpen,
  onSave,
}: RevueLotScreenProps) {
  return (
    <Screen
      bottomInset={132}
      bottom={
        <BottomBar surface="line">
          {/* Penpot sets the label 1 px above the middle. */}
          <Button
            block
            className="pb-0.5"
            disabled={saving || count === 0}
            onClick={onSave}
          >
            Enregistrer {count} colis
          </Button>
        </BottomBar>
      }
    >
      <NavBar onBack={onBack} />
      <PageIntro
        title="Vérifier le lot"
        description={summary}
        // Penpot sets this title at 1.15 and the text 8 px under it.
        className="mt-3 [&>h1]:leading-[37px] [&>p]:mt-2"
      />

      {toCheck.length > 0 && (
        <DoubtSection
          title="À vérifier"
          rows={toCheck}
          onOpen={onOpen}
          className="mt-[23px]"
        />
      )}

      {toComplete.length > 0 && (
        <DoubtSection
          title="À compléter"
          rows={toComplete}
          onOpen={onOpen}
          className="mt-[22px]"
        />
      )}

      {readyCount > 0 && (
        <section className="mt-[22px]">
          <SectionHeader title="Prêts" count={readyCount} />
          <div className="mt-[13px]">
            {ready.map((row, i) => (
              <ListRow
                key={row.id}
                align="center"
                leading={row.thumbnail ?? thumb}
                title={row.name}
                lines={row.lines.map((text) => ({ text }))}
                trailing={<CheckCircle checked />}
                separator={i < ready.length - 1}
                separatorInset={56}
              />
            ))}
          </div>
        </section>
      )}
    </Screen>
  );
}
