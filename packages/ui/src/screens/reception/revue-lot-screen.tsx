import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { CheckCircle } from '#components/checkbox';
import { LabelThumb } from '#components/label-thumb';
import { ListRow } from '#components/list-row';
import { NavBar } from '#components/nav-bar';
import { PageIntro } from '#components/page-intro';
import { Screen } from '#components/screen';
import { SectionHeader } from '#components/section-header';
import type { Parcel } from '#fixtures/parcels';

export type BatchIssue = {
  parcel: Parcel;
  /** What the scanner could not settle: "Destinataire incertain". */
  issue: string;
  /** What it did read, in grey. */
  lines: string[];
};

export type RevueLotScreenProps = {
  /** Parcels read in the burst. */
  count: number;
  summary: string;
  toCheck: BatchIssue[];
  /** The ready parcels drawn; `readyCount` is the real total. */
  ready: Parcel[];
  readyCount?: number;
};

/** The 44 px photo thumbnail, drawn at its exact box. */
const thumb = <LabelThumb width={44} height={44} radius={8} barMargin={4} />;

/**
 * Batch review, between the burst and saving. What needs the agent comes
 * first and opens to a fix; the ready parcels follow with a tick, so a long
 * batch is checked by scrolling, not by reading.
 *
 * When the scanner doubts the recipient, the doubt *is* the row's title; a
 * doubtful number stays under the name, which is still worth reading.
 */
export function RevueLotScreen({
  count,
  summary,
  toCheck,
  ready,
  readyCount = ready.length,
}: RevueLotScreenProps) {
  return (
    <Screen
      bottomInset={132}
      bottom={
        <BottomBar surface="line">
          {/* Penpot sets the label 1 px above the middle. */}
          <Button block className="pb-0.5">
            Enregistrer {count} colis
          </Button>
        </BottomBar>
      }
    >
      <NavBar />
      <PageIntro
        title="Vérifier le lot"
        description={summary}
        // Penpot sets this title at 1.15 and the text 8 px under it.
        className="mt-3 [&>h1]:leading-[37px] [&>p]:mt-2"
      />

      <section className="mt-[23px]">
        <SectionHeader title="À vérifier" count={toCheck.length} />
        <div className="mt-[13px]">
          {toCheck.map(({ parcel, issue, lines }, i) => {
            const unknown = parcel.state === 'incomplete';
            return (
              <ListRow
                key={parcel.id}
                align="center"
                leading={thumb}
                title={unknown ? issue : parcel.recipient}
                titleTone={unknown ? 'orange' : 'ink'}
                lines={[
                  ...(unknown
                    ? []
                    : [
                        {
                          // Orange but regular: a note, not a heading.
                          text: <span className="font-normal">{issue}</span>,
                          tone: 'orange' as const,
                        },
                      ]),
                  ...lines.map((text) => ({ text })),
                ]}
                separator={i < toCheck.length - 1}
                separatorInset={56}
                onClick={() => {}}
              />
            );
          })}
        </div>
      </section>

      <section className="mt-[22px]">
        <SectionHeader title="Prêts" count={readyCount} />
        <div className="mt-[13px]">
          {ready.map((parcel, i) => (
            <ListRow
              key={parcel.id}
              align="center"
              leading={thumb}
              title={parcel.recipient}
              lines={[
                {
                  text:
                    parcel.detail ??
                    `${parcel.department}, ${parcel.carrier} ···${parcel.last4}`,
                },
              ]}
              trailing={<CheckCircle checked />}
              separator={i < ready.length - 1}
              separatorInset={56}
            />
          ))}
        </div>
      </section>
    </Screen>
  );
}
