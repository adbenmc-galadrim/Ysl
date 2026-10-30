import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button, type ButtonProps } from '#components/button';
import { IconButton } from '#components/icon-button';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { Screen } from '#components/screen';
import { Icon, type IconName } from '#icons';
import { cn } from '#lib/tv';

export function NavetteScreen({
  bottom,
  children,
}: {
  bottom?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Screen bottom={bottom} bottomInset={112}>
      {children}
    </Screen>
  );
}

export function NavetteBar({
  title,
  close = false,
  skip = false,
}: {
  title?: string;
  close?: boolean;
  skip?: boolean;
}) {
  return (
    <NavBar
      title={title}
      leading={
        close ? (
          <IconButton
            icon="x"
            label="Fermer"
            size="lg"
            iconSize={22}
            className="-ml-0.5"
          />
        ) : undefined
      }
      trailing={
        skip ? (
          <NavBarAction className="font-normal">Passer</NavBarAction>
        ) : undefined
      }
    />
  );
}

export function NavetteBottom({
  variant,
  icon,
  children,
}: {
  variant?: ButtonProps['variant'];
  icon?: IconName;
  children: string;
}) {
  return (
    <BottomBar surface="plain" className="h-28 pt-6 pb-0">
      <Button block variant={variant} icon={icon} className="gap-2">
        {children}
      </Button>
    </BottomBar>
  );
}

export function ListPhoneRow({
  height,
  leadingTop,
  leading,
  title,
  titleClass,
  detail,
  trailingTop,
  trailing,
  separator = true,
}: {
  height: number;
  leadingTop: number;
  leading: ReactNode;
  title: string;
  titleClass?: string;
  detail: string;
  trailingTop: number;
  trailing: ReactNode;
  separator?: boolean;
}) {
  return (
    <div className="relative shrink-0" style={{ height }}>
      <span className="absolute left-0" style={{ top: leadingTop }}>
        {leading}
      </span>
      <span
        className={cn('absolute top-[11px] left-[52px] text-17 font-semibold', titleClass)}
      >
        {title}
      </span>
      <span className="absolute top-[33px] left-[52px] text-14 text-muted">
        {detail}
      </span>
      <span className="absolute right-0" style={{ top: trailingTop }}>
        {trailing}
      </span>
      {separator && (
        <span className="absolute right-0 bottom-0 left-[52px] h-px bg-separator" />
      )}
    </div>
  );
}

export const Chevron = () => (
  <Icon name="chevron" size={16} className="block text-faint" />
);

export function Coche({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="flex size-6 items-center justify-center rounded-full bg-black text-white">
      <Icon name="tick" size={14} />
    </span>
  ) : (
    <span className="block size-6 rounded-full border-[1.5px] border-[#d1d1d6]" />
  );
}

export function RoundAvatar({
  initials,
  inverted = false,
}: {
  initials: string;
  inverted?: boolean;
}) {
  return (
    <span
      className={cn(
        'flex size-10 items-center justify-center rounded-full pb-px text-14 font-semibold',
        inverted ? 'bg-black text-white' : 'bg-[#eeeef0] text-black',
      )}
    >
      {initials}
    </span>
  );
}

export type DirectoryPerson = {
  name: string;
  initials: string;
  detail: string;
};

const DIRECTORY: DirectoryPerson[] = [
  { name: 'Léa Fontaine', initials: 'LF', detail: 'Finance · 4e étage' },
  { name: 'Louis Fontaine', initials: 'LF', detail: 'Studio · 2e étage' },
  { name: 'Lise Fontan', initials: 'LF', detail: 'Juridique · 5e étage' },
];

/** The whole directory, searched; who is not listed stays « À compléter ». */
export function ChoisirDestinataireMobile({
  queryRaised = false,
}: {
  queryRaised?: boolean;
}) {
  return (
    <NavetteScreen>
      <NavetteBar title="Destinataire" close />
      <div className="mt-3 flex h-11 shrink-0 items-center gap-2 rounded-[12px] bg-fill pl-3 text-16">
        <Icon name="search" size={18} className="text-muted" />
        <span className={queryRaised ? 'relative -top-px' : undefined}>fonta</span>
      </div>
      <p className="relative -top-px mt-5 h-4 text-13 font-medium text-muted">
        Tout l’annuaire · 3 résultats
      </p>
      <div className="mt-1.5">
        {DIRECTORY.map((person) => (
          <ListPhoneRow
            key={person.name}
            height={72}
            leadingTop={16}
            leading={<RoundAvatar initials={person.initials} />}
            title={person.name}
            detail={person.detail}
            trailingTop={28}
            trailing={<Chevron />}
          />
        ))}
      </div>
      <div className="mt-[26px] h-[83px] shrink-0 rounded-[14px] bg-fill">
        <div className="relative">
          <Icon
            name="info"
            size={20}
            className="absolute top-4 left-4 text-ink-2"
          />
          <p className="absolute top-[15px] left-[46px] text-15 font-semibold">
            Pas dans la liste ?
          </p>
          <p className="absolute top-[35px] left-[46px] w-[291px] text-13 leading-4 text-muted">
            Gardez le colis « À compléter » : son département l’ajoutera à son
            annuaire.
          </p>
        </div>
      </div>
    </NavetteScreen>
  );
}

export function KraftLabel({ name }: { name: string }) {
  return (
    <div className="relative mt-3 h-[150px] shrink-0 rounded-[16px] bg-[#b89b78]">
      <div className="absolute top-3.5 left-5 h-[122px] w-[313px] rounded-[4px] bg-paper">
        <p className="absolute top-[9px] left-3 text-[10px] font-semibold text-[#333333]">
          Destinataire :
        </p>
        <p className="absolute top-[26px] left-3 font-label text-24 font-bold text-[#111111]">
          {name}
        </p>
        <p className="absolute top-[59px] left-3 text-[9px] leading-3 text-[#666666]">
          12 RUE DES ATELIERS
          <br />
          75011 PARIS FR
        </p>
      </div>
      <span className="absolute top-[110px] left-[313px] flex size-7 items-center justify-center rounded-full bg-white text-black">
        <Icon name="zoom" size={14} />
      </span>
    </div>
  );
}

export function BuildingTile({ selected = false }: { selected?: boolean }) {
  return (
    <span
      className={cn(
        'flex size-10 items-center justify-center rounded-full',
        selected ? 'bg-black text-white' : 'bg-fill text-black',
      )}
    >
      <Icon name="building" size={20} />
    </span>
  );
}

export function FillGroupRow({
  icon,
  tileClass,
  children,
  trailing,
  separator = true,
}: {
  icon: IconName;
  tileClass: string;
  children: string;
  trailing: ReactNode;
  separator?: boolean;
}) {
  return (
    <div className="relative h-[52px]">
      <span
        className={cn(
          'absolute top-3 left-3.5 flex size-7 items-center justify-center rounded-[7px] text-white',
          tileClass,
        )}
      >
        <Icon name={icon} size={16} />
      </span>
      <span className="absolute top-[17px] left-14 text-16">{children}</span>
      <span className="absolute top-[17px] right-3.5 flex">{trailing}</span>
      {separator && (
        <span className="absolute right-0 bottom-0 left-14 h-px bg-separator" />
      )}
    </div>
  );
}
