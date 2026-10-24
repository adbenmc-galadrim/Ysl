import { CheckDisc } from '#components/check-disc';
import type { LandingCopy } from '#components/landing-page';
import { MailIcon } from '#components/mail-icon';
import {
  AppQr,
  CARD,
  RELIEF_BODY,
  WELL,
} from '#components/landing-page/shared';
import { cn } from '#lib/tv';

/*
 * The three cards of the journey. Each one is a small scene: its parts are
 * marked `data-*` and played once, when the card comes into view, by
 * `scenes.ts`. At rest (reduced motion, or before the scene runs on a page
 * that is not moving) each card shows its final picture.
 */

const PHOTO_CHECK = 'M3.5,7L6,9.5L10.5,4.5';

type Tone = 'kraft' | 'mid' | 'light';

function BatchPhoto({ tone, read }: { tone: Tone; read: boolean }) {
  return (
    <span className="size-[60px] shrink-0 rounded-[12px] xl:size-[76px] xl:rounded-[14px] block bg-site-fill shadow-[inset_0_2px_5px_rgba(20,24,40,0.1),0_1px_0_rgba(255,255,255,0.9)]">
      <span
        data-photo
        className={cn(
          'relative block size-[60px] rounded-[12px] shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_4px_8px_-3px_rgba(80,50,10,0.35)] xl:size-[76px] xl:rounded-[14px]',
          tone === 'kraft' && 'bg-kraft',
          tone === 'mid' && 'bg-kraft-mid',
          tone === 'light' && 'bg-kraft-light',
        )}
      >
        <span className="absolute top-4 left-3.5 h-6 w-8 rounded-[2px] bg-paper xl:top-5 xl:left-[18px] xl:h-[30px] xl:w-10" />
        <span
          className={cn(
            'absolute top-7 left-[18px] h-2 w-6 xl:top-[35px] xl:left-[23px] xl:h-2.5 xl:w-[30px]',
            read ? 'bg-label-ink-2' : 'bg-site-fill-3',
          )}
        />
        <CheckDisc
          size={14}
          d={PHOTO_CHECK}
          stroke={1.6}
          className="absolute top-[42px] left-[42px] xl:top-[54px] xl:left-[54px] xl:size-4"
        />
      </span>
    </span>
  );
}

/** « 3 sur 12 »: the first number is the one the scene counts. */
function Progress({ text }: { text: string }) {
  const parts = text.split(/(\d+)/);
  const first = parts.findIndex((p) => /^\d+$/.test(p));
  return (
    <>
      {parts.map((part, i) =>
        i === first ? (
          <span
            key={i}
            data-count
            data-final={part}
            className="inline-block tabular-nums"
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function BatchCard({ copy }: { copy: LandingCopy['journey']['batch'] }) {
  return (
    <div
      data-scene="batch"
      className={cn(
        CARD,
        'px-[18px] pt-[18px] pb-[15px] xl:px-6 xl:pt-6 xl:pb-[25px]',
      )}
    >
      <div className="flex justify-between text-13 leading-4 xl:text-15 xl:leading-[18px]">
        <span className="font-semibold">{copy.title}</span>
        <span className="text-site-subtle">
          <Progress text={copy.progress} />
        </span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-site-fill-2 shadow-[inset_0_1px_2px_rgba(20,24,40,0.12)] xl:mt-3">
        <div
          data-fill
          className="h-full w-1/4 origin-left rounded-full bg-linear-to-r from-site-blue to-ios-blue"
        />
      </div>
      <div aria-hidden="true" className="mt-4 flex gap-2.5 xl:mt-5">
        <BatchPhoto tone="kraft" read />
        <BatchPhoto tone="mid" read={false} />
        <BatchPhoto tone="light" read />
        <span
          className={cn(
            'flex size-[60px] shrink-0 items-center justify-center rounded-[12px] xl:size-[76px] xl:rounded-[14px]',
            WELL,
          )}
        >
          <span className="size-4 rounded-full ring-2 ring-faint ring-inset xl:size-5" />
        </span>
      </div>
      <p
        data-names
        className="mt-3.5 text-[12px] leading-[15px] text-site-subtle xl:mt-6 xl:text-14 xl:leading-[17px]"
      >
        {copy.names}
      </p>
    </div>
  );
}

export function NotificationCard({
  copy,
}: {
  copy: LandingCopy['journey']['notification'];
}) {
  return (
    <div
      data-scene="notif"
      className="xl:rounded-[24px] xl:bg-white xl:px-6 xl:pt-6 xl:pb-[25px] xl:shadow-[inset_0_1px_0_rgb(255_255_255),0_1px_2px_rgb(29_29_31/0.05),0_8px_18px_-4px_rgb(29_29_31/0.07),0_32px_56px_-18px_rgb(29_29_31/0.16)] xl:ring-1 xl:ring-black/6 xl:ring-inset"
    >
      <p
        data-device
        className="hidden text-13 leading-4 text-site-subtle xl:block"
      >
        {copy.device}
      </p>
      <div
        data-banner
        className={cn(
          'flex h-[92px] gap-3 rounded-[22px] bg-white pt-[15px] pr-3.5 pl-3.5 ring-1 ring-black/6 ring-inset xl:-mx-1 xl:mt-4 xl:h-[100px] xl:gap-3.5 xl:bg-site-fill-2/80 xl:pt-4 xl:shadow-none xl:ring-0',
          RELIEF_BODY,
        )}
      >
        <span data-mail className="mt-px xl:mt-0.5">
          <MailIcon size={38} className="xl:hidden" />
          <MailIcon size={40} className="hidden xl:flex" />
        </span>
        <div className="flex-1">
          <div className="flex items-start justify-between">
            <span className="text-14 leading-[17px] font-semibold xl:text-15 xl:leading-[18px]">
              {copy.sender}
            </span>
            <span className="mt-px text-[12px] leading-[15px] text-site-muted">
              {copy.time}
            </span>
          </div>
          <p className="mt-[3px] text-14 leading-[17px] font-medium xl:mt-1">
            {copy.title}
          </p>
          <p className="mt-[3px] text-13 leading-4 text-site-ink-2 xl:mt-[5px]">
            {copy.body}
          </p>
        </div>
      </div>
      <p
        data-foot
        className="mt-[22px] hidden text-14 leading-[17px] text-site-subtle xl:block"
      >
        {copy.footnote}
      </p>
    </div>
  );
}

const PICKUP_CODE = '4821';

/**
 * Each digit is a strip of cells that starts on the digit itself (so the
 * still picture needs no transform) and holds, below it, the way up from 0:
 * the scene slides the strip down from its last cell.
 */
function RollingCode({ code }: { code: string }) {
  return (
    <p
      aria-label={code}
      className="mt-1 flex font-mono text-34 leading-[1.2em] font-semibold tracking-[3px] xl:mt-1.5 xl:text-[40px] xl:tracking-[4px]"
    >
      {[...code].map((ch, i) => {
        const digit = Number(ch);
        const cells = Array.from(
          { length: digit + 11 },
          (_, k) => (((digit - k) % 10) + 10) % 10,
        );
        return (
          <span
            key={i}
            aria-hidden="true"
            className="block h-[1.2em] overflow-hidden"
          >
            <span data-strip data-n={cells.length} className="block">
              {cells.map((value, k) => (
                <span key={k} className="block h-[1.2em]">
                  {value}
                </span>
              ))}
            </span>
          </span>
        );
      })}
    </p>
  );
}

const SIGNATURE =
  'M4,22C8,10 12,5 14,10C16,15 8,24 14,24C20,24 24,12 26,12C27,18 28,22 32,20C36,18 38,12 40,14C42,18 40,24 46,22C52,20 54,12 58,14C60,18 56,24 62,22C70,18 78,14 84,16C90,18 86,24 92,22C98,20 102,16 108,11';
const SIGNATURE_UNDERLINE = 'M6,27C30,24 70,28 106,21';

export function HandoverCard({
  copy,
}: {
  copy: LandingCopy['journey']['handover'];
}) {
  return (
    <div
      data-scene="handover"
      className={cn(
        CARD,
        'flex flex-wrap gap-x-4 gap-y-3 p-4 xl:gap-x-6 xl:gap-y-4 xl:p-6 xl:pb-[25px]',
      )}
    >
      <AppQr value={PICKUP_CODE} size={118} radius={14} className="xl:hidden" />
      <AppQr
        value={PICKUP_CODE}
        size={130}
        radius={16}
        className="hidden xl:block"
      />
      <div>
        <p className="mt-1.5 text-[11px] leading-[14px] font-semibold tracking-[1.2px] text-site-subtle xl:mt-2 xl:tracking-[1.4px]">
          {copy.codeLabel}
        </p>
        <RollingCode code={PICKUP_CODE} />
        <p
          data-pill
          className="mt-[17px] flex h-[30px] w-[140px] items-center gap-1.5 rounded-[15px] bg-ios-green/16 pl-3 text-13 leading-4 font-semibold text-site-green-ink xl:mt-[18px] xl:h-8 xl:w-[150px] xl:gap-2 xl:rounded-[16px] xl:text-14 xl:leading-[17px]"
        >
          <span className="relative flex size-2.5">
            <span
              data-ping
              className="absolute inset-0 rounded-full bg-ios-green opacity-0"
            />
            <span className="relative size-2.5 rounded-full bg-ios-green" />
          </span>
          {copy.handedAt}
        </p>
      </div>
      <div className="flex w-full basis-full items-center gap-3 border-t border-black/6 pt-3 text-site-subtle xl:pt-4">
        <svg
          aria-hidden="true"
          viewBox="0 0 112 30"
          width={112}
          height={30}
          className="shrink-0 overflow-visible fill-none stroke-site-ink"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path data-sig d={SIGNATURE} />
          <path data-sig d={SIGNATURE_UNDERLINE} strokeWidth={1.1} />
        </svg>
        <p className="text-13 leading-4 xl:text-14 xl:leading-[17px]">
          {copy.signature}
        </p>
      </div>
    </div>
  );
}
