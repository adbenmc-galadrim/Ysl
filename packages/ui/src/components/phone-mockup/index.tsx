import type { ReactNode } from 'react';

import { AppMark } from '#components/app-mark';
import { ParcelThumb } from '#components/parcel-thumb';
import { cn } from '#lib/tv';

/*
 * The phones the landing page draws: the three steps of the install guide
 * and the parcel list that floats over the hero. Pictures, not interface:
 * every one is `aria-hidden` and keeps the geometry of its Penpot layer.
 */

function PhoneFrame({
  screen,
  children,
}: {
  screen: string;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden="true"
      className="relative h-[270px] w-[156px] shrink-0 rounded-[30px] bg-site-fill-2"
    >
      <div
        className={cn(
          'absolute top-[5px] left-[5px] h-[260px] w-[146px] overflow-hidden rounded-[25px]',
          screen,
        )}
      >
        {children}
        <span className="absolute top-2 left-12 h-3.5 w-[50px] rounded-[7px] bg-black" />
      </div>
    </div>
  );
}

/** Step 1: a page in Safari, its Partager button lit. */
export function SafariPhone() {
  return (
    <PhoneFrame screen="bg-white">
      <span className="absolute top-10 left-3.5 h-3 w-[90px] rounded-[3px] bg-night" />
      {[60, 74, 88, 102].map((y, i) => (
        <span
          key={y}
          className={cn(
            'absolute left-3.5 h-[7px] rounded-[3px] bg-separator',
            i % 2 ? 'w-[100px]' : 'w-[118px]',
          )}
          style={{ top: y }}
        />
      ))}
      <span className="absolute top-[120px] left-3.5 h-[60px] w-[118px] rounded-[8px] bg-fill" />
      <div className="absolute inset-x-0 top-[206px] h-[54px] bg-sidebar">
        <span className="absolute top-1.5 left-2.5 h-5 w-[126px] rounded-[7px] bg-separator" />
        <span className="absolute top-6 left-[55px] size-9 rounded-full bg-ios-blue/15" />
        <svg
          viewBox="0 0 12 18"
          width={12}
          height={18}
          className="absolute top-[30px] left-[67px] overflow-visible fill-none stroke-ios-blue"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M6,0L6,13M1,5L6,0L11,5M0,8L0,18L12,18L12,8" />
        </svg>
      </div>
    </PhoneFrame>
  );
}

/** Step 2: Safari's share sheet, on « Sur l’écran d’accueil ». */
export function ShareSheetPhone() {
  return (
    <PhoneFrame screen="bg-muted">
      <div className="absolute inset-x-0 top-[92px] h-[168px] rounded-[16px] bg-fill">
        <span className="absolute top-1.5 left-[58px] h-1 w-[30px] rounded-[2px] bg-faint" />
        <div className="absolute top-5 left-2 h-[108px] w-[130px] overflow-hidden rounded-[10px] bg-white text-[10px] leading-3">
          <span className="absolute top-[11px] left-2.5 text-black">Copier</span>
          <span className="absolute top-[35px] left-2.5 h-px w-[120px] bg-separator" />
          <span className="absolute inset-x-0 top-9 h-9 bg-ios-blue/12" />
          <span className="absolute top-[47px] left-2.5 font-semibold text-ios-blue">
            Sur l’écran d’accueil
          </span>
          <span className="absolute top-[46px] left-[108px] size-3.5 rounded-[3px] ring-[1.4px] ring-ios-blue ring-inset" />
          <svg
            viewBox="0 0 7 7"
            width={7}
            height={7}
            className="absolute top-[49.5px] left-[111.5px] overflow-visible fill-none stroke-ios-blue"
            strokeWidth={1.4}
            strokeLinecap="round"
          >
            <path d="M3.5,0L3.5,7M0,3.5L7,3.5" />
          </svg>
          <span className="absolute top-[71px] left-2.5 h-px w-[120px] bg-separator" />
          <span className="absolute top-[83px] left-2.5 text-black">Liste de lecture</span>
        </div>
      </div>
    </PhoneFrame>
  );
}

const HOME_ICONS = [
  [14, 40, 'bg-ios-green/90'],
  [45, 40, 'bg-site-blue/90'],
  [76, 40, 'bg-ios-orange-light/90'],
  [107, 40, 'bg-ios-red-light/90'],
  [14, 84, 'bg-site-purple/90'],
  [76, 84, 'bg-site-yellow/90'],
  [107, 84, 'bg-ios-green/90'],
] as const;

const DOCK_ICONS = ['bg-ios-green', 'bg-site-blue', 'bg-white', 'bg-ios-orange-light'];

export type HomeScreenPhoneProps = {
  appName: string;
};

/** Step 3: the home screen, the app among the others. */
export function HomeScreenPhone({ appName }: HomeScreenPhoneProps) {
  return (
    <PhoneFrame screen="bg-linear-to-br from-site-wallpaper to-site-wallpaper-2">
      {HOME_ICONS.map(([x, y, tone]) => (
        <span
          key={`${x}-${y}`}
          className={cn('absolute size-[26px] rounded-[6.5px]', tone)}
          style={{ left: x, top: y }}
        />
      ))}
      <span className="absolute top-[81px] left-[42px] size-8 rounded-[9px] ring-[1.5px] ring-white ring-inset" />
      <AppMark size={26} className="absolute top-[84px] left-[45px]" />
      <span className="absolute top-[113px] left-[39px] w-[38px] text-center text-[6.5px] leading-2 font-semibold text-white">
        {appName}
      </span>
      <div className="absolute top-[208px] left-2 flex h-11 w-[130px] gap-1 rounded-[16px] bg-black/11 pt-[9px] pl-2.5">
        {DOCK_ICONS.map((tone) => (
          <span key={tone} className={cn('size-[26px] rounded-[6.5px]', tone)} />
        ))}
      </div>
    </PhoneFrame>
  );
}

const LIST_PARCELS = [
  { name: 'Camille Roux', meta: 'Comptabilité · 10 h 15', tone: 'kraft', status: 'bg-site-blue' },
  { name: 'Hugo Bernard', meta: 'Juridique · il y a 2 h', tone: 'mid', status: 'bg-ios-orange-light' },
  { name: 'Léa Martin', meta: 'Presse · 9 h 40', tone: 'light', status: 'bg-ios-green' },
  { name: 'Nora Petit', meta: 'Studio · 8 h 55', tone: 'deep', status: 'bg-site-blue' },
  { name: 'Inès Garnier', meta: 'RH · hier', tone: 'dark', status: 'bg-ios-orange-light' },
] as const;

export type ParcelListPhoneProps = {
  className?: string;
};

/** The parcel list of the app, on the phone that floats over the hero. */
export function ParcelListPhone({ className }: ParcelListPhoneProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'relative h-[470px] w-[230px] rounded-[40px] bg-site-fill-2 shadow-site-phone ring-1 ring-black/6 ring-inset',
        className,
      )}
    >
      <div className="absolute top-[9px] left-[9px] h-[452px] w-[212px] overflow-hidden rounded-[31px] bg-white px-[18px]">
        <span className="absolute top-2.5 left-[61px] h-[26px] w-[90px] rounded-[13px] bg-black" />
        <p className="absolute top-4 left-7 text-15 leading-[18px] font-semibold text-site-ink">
          9:41
        </p>
        <p className="mt-[58px] text-30 leading-9 font-bold text-site-ink">Colis</p>
        <p className="mt-1 text-13 leading-4 text-site-muted">Aujourd’hui · 12 colis</p>
        <ul className="mt-2.5">
          {LIST_PARCELS.map((p) => (
            <li key={p.name} className="relative flex h-16 w-44 gap-3 pt-2.5">
              <ParcelThumb size={44} tone={p.tone} />
              <div className="pt-0.5">
                <p className="text-16 leading-5 font-semibold text-site-ink">{p.name}</p>
                <p className="mt-0.5 text-13 leading-4 whitespace-nowrap text-site-muted">
                  {p.meta}
                </p>
              </div>
              <span className={cn('absolute top-[27px] left-[166px] size-2.5 rounded-full', p.status)} />
              <span className="absolute top-[63px] left-14 h-px w-[120px] bg-separator" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
