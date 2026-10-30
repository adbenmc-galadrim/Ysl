import type { ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { LargeTitle } from '#components/large-title';
import { ListRow, type ListRowLine } from '#components/list-row';
import { SearchTrigger } from '#components/search-field';
import { Skeleton } from '#components/skeleton';
import { StatusPill, SYNC_PILL } from '#components/status-pill';
import { Toast } from '#components/toast';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export const ERROR_TITLE = 'Impossible de charger';
export const ERROR_TEXT =
  'Le serveur ne répond pas. Vérifiez la connexion puis réessayez. Rien n’a été modifié.';

type PillState = 'synced' | 'offline' | 'unsent';

const PILL: Record<PillState, { icon: IconName; label: string; tone: 'green' | 'grey' }> = {
  synced: SYNC_PILL.synced,
  offline: { icon: 'wifiOff', label: 'Hors ligne', tone: 'grey' },
  unsent: { icon: 'wifiOff', label: 'Non envoyé', tone: 'grey' },
};

/** The top of a root screen: the sync pill, the menu, the large title. */
export function RootHeader({
  pill,
  title,
  subtitle,
  menuClass,
}: {
  pill?: PillState;
  title: string;
  subtitle?: string;
  menuClass?: string;
}) {
  return (
    <>
      <div className={cn('flex h-11 items-center', pill ? 'justify-between' : 'justify-end')}>
        {pill && <StatusPill {...PILL[pill]} size="sm" />}
        <IconButton
          icon="menu"
          label="Menu"
          size="lg"
          iconSize={22}
          className={cn('-mr-0.5', menuClass)}
        />
      </div>
      <LargeTitle
        title={<span className="tracking-[-0.4px]">{title}</span>}
        subtitle={subtitle}
        className="mt-[7px] gap-1.5"
      />
    </>
  );
}

/** A disc, a title, a sentence and a way out: an empty or a failed screen. */
export function StateHero({
  top,
  icon,
  tone = 'fill',
  title,
  text,
  textWidth = 300,
  textHeight = 40,
  action,
  className,
}: {
  top: number;
  icon: IconName;
  tone?: 'fill' | 'red' | 'green';
  title: string;
  text: string;
  textWidth?: number;
  textHeight?: number;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('absolute right-px left-0 flex flex-col items-center text-center', className)}
      style={{ top }}
    >
      <span
        className={cn(
          'flex size-[88px] items-center justify-center rounded-full',
          tone === 'fill' && 'bg-fill text-ink',
          tone === 'red' && 'bg-red-soft text-red',
          tone === 'green' && 'bg-green-soft text-green',
        )}
      >
        <Icon name={icon} size={40} />
      </span>
      <h2 className="relative top-[-0.5px] mt-5 h-[26px] text-22 font-bold">{title}</h2>
      <p
        className="relative top-[0.1px] mt-[9px] text-15 leading-[1.35] text-muted"
        style={{ width: textWidth, height: textHeight }}
      >
        {text}
      </p>
      {action && <div className="mt-[25px]">{action}</div>}
    </div>
  );
}

/** The 48 px pill that follows a hero. */
export function HeroButton({
  icon,
  width,
  children,
}: {
  icon: IconName;
  width: number;
  children: ReactNode;
}) {
  return (
    <Button icon={icon} iconSize={20} className="h-12 gap-2 rounded-[24px] px-0 text-16" style={{ width }}>
      {children}
    </Button>
  );
}

export function RetryHero({ top, className }: { top: number; className?: string }) {
  return (
    <StateHero
      top={top}
      icon="wifiOff"
      tone="red"
      title={ERROR_TITLE}
      text={ERROR_TEXT}
      textWidth={320}
      className={className}
      action={
        <HeroButton icon="refresh" width={180}>
          Réessayer
        </HeroButton>
      }
    />
  );
}

/** The grey notice of a screen that has lost its server. */
export function OfflineBanner({
  title,
  text,
  action,
  className,
}: {
  title: string;
  text: string;
  action?: string;
  className?: string;
}) {
  return (
    <Banner
      tone="grey"
      icon="wifiOff"
      title={title}
      description={
        <>
          {text}
          {action && (
            <span className="mt-[9px] block text-15 font-semibold text-ink">{action}</span>
          )}
        </>
      }
      className={cn('shrink-0 items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4', action ? 'h-[93px]' : 'h-[83px]', className)}
      classNames={{
        icon: 'mt-4 text-ink-2',
        title: 'mt-[15px] text-15',
        description: 'mt-0.5 text-13 leading-4',
      }}
    />
  );
}

/** Rows still loading, on the pitch of the rows they stand for. */
export function SkeletonRows({
  count,
  pitch,
  className,
}: {
  count: number;
  pitch: number;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col', className)} style={{ gap: pitch - 40 }}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton width={40} height={40} radius={20} />
          <span className="flex flex-col gap-2 pt-1">
            <Skeleton width={158.85} height={14} radius={6} />
            <Skeleton width={105.9} height={12} radius={6} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** A 16 px chevron, and what comes before it: a state, a count. */
function RowEnd({ before, top }: { before?: ReactNode; top: number }) {
  return (
    <span className="flex items-center gap-2" style={{ marginTop: top }}>
      {before && <span className="flex h-4 items-center">{before}</span>}
      <Icon name="chevron" size={16} className="text-faint" />
    </span>
  );
}

const ROW_TITLE_TOP: Record<number, number> = { 64: 11, 68: 11, 72: 11, 76: 12 };

/** A list row at a measured height, its tile and chevron centred on it. */
export function PhoneRow({
  height,
  leading,
  title,
  lines,
  before,
  separator = false,
}: {
  height: 64 | 68 | 72 | 76;
  leading: ReactNode;
  title: ReactNode;
  lines: string[];
  before?: ReactNode;
  separator?: boolean;
}) {
  const top = ROW_TITLE_TOP[height]!;
  const raised: ListRowLine[] = lines.map((text) => ({
    text: <span className="relative -top-px">{text}</span>,
  }));
  return (
    <div className="relative" style={{ height, paddingTop: top }}>
      <ListRow
        leading={
          <span className="flex" style={{ marginTop: (height - 40) / 2 - top - 7 }}>
            {leading}
          </span>
        }
        title={title}
        lines={raised}
        trailing={<RowEnd before={before} top={(height - 16) / 2 - top - 11} />}
      />
      {separator && (
        <div className="absolute inset-x-0 bottom-0 ml-[52px] h-px bg-separator" />
      )}
    </div>
  );
}

export function PersonAvatar({ initials }: { initials: string }) {
  return (
    <Avatar initials={initials} tone="fill" className="rounded-full bg-fill-2 text-14" />
  );
}

export function RowTile({
  icon,
  className,
}: {
  icon: IconTileProps['icon'];
  className?: string;
}) {
  return <IconTile icon={icon} tone="fill" className={className} />;
}

/** The search and the screen's one action, in the thumb zone. */
export function PhoneDock({ icon, label }: { icon: IconName; label: string }) {
  return (
    <BottomBar className="pt-[34px] pb-[26px]">
      <SearchTrigger size="dock" />
      <Button icon={icon} iconSize={20} className="w-[171px] gap-2">
        {label}
      </Button>
    </BottomBar>
  );
}

/** A 6 px bar on its grey track. */
export function ProgressTrack({
  value,
  toneClass = 'bg-ink',
  className,
}: {
  value: number;
  toneClass?: string;
  className?: string;
}) {
  return (
    <div className={cn('h-1.5 shrink-0 rounded-[3px] bg-fill-2', className)}>
      <div className={cn('h-full rounded-[3px]', toneClass)} style={{ width: `${value * 100}%` }} />
    </div>
  );
}

/** The dark notice over the bottom bar, at its place in the mockups. */
export function DockToast({ message }: { message: string }) {
  return (
    <Toast
      message={message}
      className="absolute inset-x-5 top-[676px] rounded-[14px] bg-[#1c1c1e] px-4 pb-0.5"
    />
  );
}
