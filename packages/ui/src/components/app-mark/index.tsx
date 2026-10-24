import { cn } from '#lib/tv';

export type AppMarkProps = {
  size: number;
  /**
   * `outline` draws the hairline the mark needs on a white page; `halo` the
   * white ring that cuts it out of a QR code.
   */
  edge?: 'none' | 'outline' | 'halo';
  className?: string;
};

/** The app icon: a kraft parcel with its label, on a white square. */
export function AppMark({ size, edge = 'none', className }: AppMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative block shrink-0 bg-white',
        edge === 'outline' && 'ring-1 ring-black/10 ring-inset',
        className,
      )}
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        boxShadow: edge === 'halo' ? `0 0 0 ${size * 0.1}px white` : undefined,
      }}
    >
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full">
        <rect
          x="19"
          y="27"
          width="62"
          height="50"
          rx="6"
          className="fill-kraft"
        />
        <rect
          x="19"
          y="36"
          width="62"
          height="7"
          className="fill-kraft-light"
        />
        <rect
          x="45.03"
          y="48"
          width="28.53"
          height="20"
          rx="2"
          className="fill-paper"
        />
      </svg>
    </span>
  );
}

export type AppBrandProps = {
  /** `nav` for the top bar, `footer` for the foot of the page. */
  size: 'nav' | 'footer';
  name: string;
};

/** The app mark and its name, as the landing page signs itself. */
export function AppBrand({ size, name }: AppBrandProps) {
  const nav = size === 'nav';
  return (
    <span className="flex items-center gap-2.5 xl:gap-3">
      <AppMark size={nav ? 30 : 28} edge="outline" className="xl:hidden" />
      <AppMark size={32} edge="outline" className="hidden xl:block" />
      <span
        className={cn(
          'font-semibold text-site-ink',
          nav
            ? 'text-17 leading-[21px] xl:text-18 xl:leading-[22px]'
            : 'text-15 leading-[18px] xl:text-17 xl:leading-[21px]',
        )}
      >
        {name}
      </span>
    </span>
  );
}
