import type { ReactNode } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button, type ButtonProps } from '#components/button';
import { IconButton } from '#components/icon-button';
import { NavBar, NavBarAction } from '#components/nav-bar';
import { PersonAvatar, PhoneRow } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { Icon, type IconName } from '#icons';

/** The page of the shuttle's flows, its content clear of the 112 px bar. */
export function ShuttleScreen({
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

/** The bar of the shuttle's flows: back or close, and « Passer » on demand. */
export function ShuttleBar({
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

/** The screen's one action, in the shuttle's 112 px bar. */
export function ShuttleBottom({
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

export type RecipientResult = {
  name: string;
  initials: string;
  detail: string;
};

/** The whole directory, searched; who is not listed stays « À compléter ». */
export function RecipientPicker({
  query,
  results,
  queryRaised = false,
}: {
  query: string;
  results: readonly RecipientResult[];
  /** Penpot set the query 1 px higher on some of its boards. */
  queryRaised?: boolean;
}) {
  return (
    <ShuttleScreen>
      <ShuttleBar title="Destinataire" close />
      <div className="mt-3 flex h-11 shrink-0 items-center gap-2 rounded-[12px] bg-fill pl-3 text-16">
        <Icon name="search" size={18} className="text-muted" />
        <span className={queryRaised ? 'relative -top-px' : undefined}>{query}</span>
      </div>
      <p className="relative -top-px mt-5 h-4 text-13 font-medium text-muted">
        Tout l’annuaire · {results.length} résultats
      </p>
      <div className="mt-1.5">
        {results.map((person) => (
          <PhoneRow
            key={person.name}
            height={72}
            leading={<PersonAvatar initials={person.initials} raised />}
            title={person.name}
            lines={[person.detail]}
            separator
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
    </ShuttleScreen>
  );
}
