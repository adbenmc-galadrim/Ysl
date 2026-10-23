import { cn } from '#lib/tv';

/** Mail's icon: a blue gradient square with a white envelope. */
export function MailIcon({ size }: { size: 38 | 40 }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center bg-linear-to-b from-site-mail to-site-mail-2',
        size === 38 ? 'size-[38px] rounded-[9px]' : 'size-10 rounded-[10px]',
      )}
    >
      <svg
        viewBox="0 0 20 16"
        width={20}
        height={16}
        className="overflow-visible fill-none stroke-white"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M0,0L20,0L20,16L0,16ZM0,0L10,8L20,0" />
      </svg>
    </span>
  );
}
