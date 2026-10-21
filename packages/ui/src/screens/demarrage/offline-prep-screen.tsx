import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { PageIntro } from '#components/page-intro';
import { ProgressRow, type ProgressRowProps } from '#components/progress-row';
import { Screen } from '#components/screen';
import type { OfflinePack } from '#fixtures/offline';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

export type OfflineDownload = {
  pack: OfflinePack;
  state: 'done' | 'running' | 'paused';
  /** From 0 to 1. */
  progress: number;
  /** Replaces the pack's detail while it downloads: "18 Mo sur 42 Mo". */
  detail?: string;
};

/** One look per state: tile, bar, and what sits right of the title. */
const LOOK: Record<
  OfflineDownload['state'],
  {
    tone: IconTileProps['tone'];
    bar: ProgressRowProps['tone'];
    subtitle: ProgressRowProps['subtitleTone'];
  }
> = {
  done: { tone: 'green', bar: 'green', subtitle: 'muted' },
  running: { tone: 'neutral', bar: 'ink', subtitle: 'muted' },
  paused: { tone: 'orange', bar: 'orange', subtitle: 'orange' },
};

function trailing({ state, progress }: OfflineDownload) {
  if (state === 'done')
    return <Icon name="check" size={22} className="mr-px text-green" />;
  if (state === 'paused')
    return (
      <Icon name="wifiOff" size={20} aria-label="En pause" className="mr-0.5 text-orange" />
    );
  return (
    <span className="text-15 font-semibold">{`${Math.round(progress * 100)} %`}</span>
  );
}

export type OfflinePrepScreenProps = {
  description: ReactNode;
  downloads: OfflineDownload[];
  /** The banner under the list: what the agent can do meanwhile. */
  notice?: ReactNode;
  /** One action, or two stacked when the download is stuck. */
  actions: ReactNode[];
};

/**
 * First launch: the app pulls what it needs to work offline. Each pack has
 * its own bar so a stuck one is obvious, and the screen says what still
 * works without it rather than holding the agent on a spinner.
 */
export function OfflinePrepScreen({
  description,
  downloads,
  notice,
  actions,
}: OfflinePrepScreenProps) {
  // Two stacked actions take room: the list starts higher and the actions
  // sit 16 px further from the home indicator, as in the mockups.
  const stacked = actions.length > 1;
  return (
    <Screen
      // Two stacked 52 px actions, their gap and the extra 16 px.
      bottomInset={stacked ? 212 : undefined}
      bottom={
        <BottomBar
          className={cn(
            stacked && 'flex-col gap-4 pb-[calc(var(--safe-bottom)+22px)]',
          )}
        >
          {actions}
        </BottomBar>
      }
    >
      <PageIntro
        title="Préparation hors ligne"
        description={description}
        className="mt-[54px]"
      />
      <div className={cn('flex flex-col gap-[34px]', stacked ? 'mt-[50px]' : 'mt-[70px]')}>
        {downloads.map((download) => {
          const look = LOOK[download.state];
          return (
            <ProgressRow
              key={download.pack.id}
              leading={<IconTile icon={download.pack.icon} tone={look.tone} />}
              title={download.pack.title}
              subtitle={download.detail ?? download.pack.detail}
              subtitleTone={look.subtitle}
              trailing={trailing(download)}
              value={download.state === 'done' ? 1 : download.progress}
              tone={look.bar}
            />
          );
        })}
      </div>
      {notice && <div className="mt-[42px]">{notice}</div>}
    </Screen>
  );
}
