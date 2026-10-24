import { AppMark } from '#components/app-mark';
import { BrandedQr } from '#components/branded-qr';
import { QR_LOGO } from '#lib/qr';
import { cn } from '#lib/tv';

export const CONTAINER = 'mx-auto w-full max-w-[480px] px-5 xl:max-w-[1240px]';

export const EYEBROW =
  'text-[12px] leading-[15px] font-semibold tracking-[1.6px] uppercase xl:text-13 xl:leading-4 xl:tracking-[2px]';

export const WELL =
  'bg-site-fill shadow-[inset_0_2px_6px_rgba(20,24,40,0.07),inset_0_0_0_1px_rgba(20,24,40,0.05),0_1px_0_rgba(255,255,255,0.9)]';

/** The card shadow of the body: a lit top edge, a contact line, two ambient falloffs. */
export const RELIEF_BODY =
  'shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(29_29_31/0.05),0_8px_18px_-4px_rgb(29_29_31/0.07),0_32px_56px_-18px_rgb(29_29_31/0.16)]';

export const CARD = cn(
  'rounded-[22px] bg-white ring-1 ring-black/6 ring-inset xl:rounded-[24px]',
  RELIEF_BODY,
);

export function AppQr({
  value,
  size,
  radius,
  className,
}: {
  value: string;
  size: number;
  radius: number;
  className?: string;
}) {
  return (
    <BrandedQr
      value={value}
      size={size}
      radius={radius}
      logo={<AppMark size={size * QR_LOGO} edge="halo" />}
      className={className}
    />
  );
}

export function SectionHeading({
  eyebrow,
  title,
  text,
  titleClass,
  textClass,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  titleClass: string;
  textClass?: string;
}) {
  return (
    <div className="xl:flex xl:items-end xl:justify-between">
      <div>
        <p className={cn(EYEBROW, 'text-site-subtle')}>{eyebrow}</p>
        <h2 data-split className={cn('font-bold', titleClass)}>
          {title}
        </h2>
      </div>
      {text && (
        <p
          data-split
          className={cn(
            'text-15 leading-[23px] text-site-muted xl:mb-1.5 xl:w-[480px] xl:text-18 xl:leading-[27px]',
            textClass,
          )}
        >
          {text}
        </p>
      )}
    </div>
  );
}

/** A green disc with a check that the scenes draw: the circle pops, the stroke traces. */
export function Tick({
  size,
  className,
}: {
  size: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      data-tick
      viewBox="0 0 14 14"
      width={size}
      height={size}
      className={cn('shrink-0', className)}
    >
      <circle cx={7} cy={7} r={7} className="fill-ios-green" />
      <path
        d="M3.8,7.2L6,9.4L10.2,4.8"
        className="fill-none stroke-white"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
