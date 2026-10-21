import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { DetailsList, type DetailsItem } from '#components/details-list';
import { IconButton } from '#components/icon-button';
import { LabelPhoto } from '#components/label-photo';
import { LargeTitle } from '#components/large-title';
import { NavBar } from '#components/nav-bar';
import { Screen } from '#components/screen';
import {
  StatusTimeline,
  type TimelineStep,
} from '#components/status-timeline';
import type { IconName } from '#icons';

export type FicheColisScreenProps = {
  recipient: string;
  /** Where the recipient sits: "Studio, 2e étage". */
  place: string;
  tracking: string;
  carrier: string;
  /** The grey card that says where the parcel stands, in words. */
  state: { icon: IconName; title: string; description?: string };
  steps: TimelineStep[];
  details: DetailsItem[];
  /** The one black action, which depends on the state: notify, hand over. */
  primaryAction: string;
};

/**
 * A parcel's record: who, the tracking number as printed, where it stands,
 * the label photo to check what the scan read, then the details.
 */
export function FicheColisScreen({
  recipient,
  place,
  tracking,
  carrier,
  state,
  steps,
  details,
  primaryAction,
}: FicheColisScreenProps) {
  return (
    <Screen
      bottom={
        // 15 px over the buttons: the hairline is the 16th, as drawn.
        <BottomBar surface="line" className="pt-[15px]">
          <Button
            variant="secondary"
            icon="trash"
            iconSize={20}
            className="w-[134px] justify-start gap-2 pr-0 pl-5 text-16"
          >
            Supprimer
          </Button>
          <Button className="min-w-0 flex-1">{primaryAction}</Button>
        </BottomBar>
      }
    >
      <NavBar
        trailing={
          <IconButton icon="edit" label="Modifier" size="lg" />
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
      <Banner
        size="lg"
        tone="grey"
        icon={state.icon}
        title={state.title}
        description={state.description}
        className="mt-[15px]"
      />
      <StatusTimeline steps={steps} className="mt-6" />
      <LabelPhoto className="mt-5" />
      <DetailsList title="Détails" items={details} className="mt-5" />
    </Screen>
  );
}
