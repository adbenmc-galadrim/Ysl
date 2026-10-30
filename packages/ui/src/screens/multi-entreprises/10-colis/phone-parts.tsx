import type { ReactNode } from 'react';

import { Banner, type BannerProps } from '#components/banner';
import { ListRow } from '#components/list-row';
import { SectionHeader } from '#components/section-header';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

/** A list thumbnail of these mockups: kraft, a paper label, two lines, a code. */
export function KraftThumb() {
  return (
    <span aria-hidden="true" className="relative block size-10 rounded-[8px] bg-kraft">
      <span className="absolute top-[8.8px] left-[7.2px] h-5 w-[25.6px] rounded-[2px] bg-paper" />
      <span className="absolute top-3 left-[10.4px] h-[1.5px] w-4 bg-label-line" />
      <span className="absolute top-[16.8px] left-[10.4px] h-[1.5px] w-4 bg-label-line" />
      <span className="absolute top-[22px] left-[10.4px] h-1 w-[19.2px] bg-label-ink" />
    </span>
  );
}

/** The ticked state of a row: a black disc. */
export function TickDisc() {
  return (
    <span className="flex size-6 items-center justify-center rounded-full bg-ink text-on-ink">
      <Icon name="tick" size={14} />
    </span>
  );
}

export type PhoneRowProps = {
  leading: ReactNode;
  title: ReactNode;
  lines: ReactNode[];
  trailing?: 'chevron' | 'tick' | 'none';
  separator?: boolean;
};

/** A list row on the fixed pitch of the mockups: 64 px, or 76 with two lines. */
export function PhoneRow({
  leading,
  title,
  lines,
  trailing = 'chevron',
  separator = false,
}: PhoneRowProps) {
  const tall = lines.length > 1;
  return (
    <div className={tall ? 'relative h-[76px] pt-3' : 'relative h-16 pt-[11px]'}>
      <ListRow
        leading={<span className={cn('flex', tall ? '-mt-px' : '-mt-1.5')}>{leading}</span>}
        title={title}
        lines={lines.map((text) => ({
          text: <span className="relative -top-px">{text}</span>,
        }))}
        trailing={
          trailing === 'chevron' ? (
            <Icon
              name="chevron"
              size={16}
              className={tall ? 'mt-[7px] text-faint' : 'mt-0.5 text-faint'}
            />
          ) : trailing === 'tick' ? (
            <span className="-mt-0.5">
              <TickDisc />
            </span>
          ) : null
        }
      />
      {separator && (
        <div className="absolute inset-x-0 bottom-0 ml-[52px] h-px bg-separator" />
      )}
    </div>
  );
}

/** A 20 px section title and its count, one word space apart. */
export function PhoneSection({
  title,
  count,
  className,
}: {
  title: string;
  count: number;
  className?: string;
}) {
  return (
    <SectionHeader
      title={
        <>
          {title}
          <span className="ml-1.5 font-medium text-muted">{count}</span>
        </>
      }
      className={className}
    />
  );
}

export type PhoneBannerProps = Pick<BannerProps, 'tone' | 'icon'> & {
  title: string;
  description: string;
  /** 67 with one line of description, 83 with two. */
  height: 67 | 83;
  /** Grey by default on a grey banner; ink where the mockup draws it so. */
  descriptionClassName?: string;
  iconClassName?: string;
  className?: string;
};

/** The 14 px radius banner of the phone screens, its icon hung from the top. */
export function PhoneBanner({
  tone = 'grey',
  icon,
  title,
  description,
  height,
  descriptionClassName,
  iconClassName,
  className,
}: PhoneBannerProps) {
  return (
    <Banner
      tone={tone}
      icon={icon}
      title={title}
      description={description}
      className={cn(
        'shrink-0 items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4',
        height === 67 ? 'h-[67px]' : 'h-[83px]',
        className,
      )}
      classNames={{
        icon: cn('mt-4', iconClassName),
        title: 'mt-[15px] text-15',
        description: cn('mt-0.5 text-13 leading-4', descriptionClassName),
      }}
    />
  );
}
