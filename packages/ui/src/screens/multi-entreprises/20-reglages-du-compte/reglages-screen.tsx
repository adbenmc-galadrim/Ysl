import type { ReactNode } from 'react';

import { Avatar } from '#components/avatar';
import { SettingsIcon, type SettingsIconProps } from '#components/grouped-list';
import { NavBar } from '#components/nav-bar';
import { PhoneGroupTitle } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { Switch } from '#components/switch';
import { Icon } from '#icons';
import { cn } from '#lib/tv';

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-[14px] bg-surface', className)}>{children}</div>;
}

function Row({
  icon,
  color,
  title,
  titleClass,
  value,
  chevron = false,
  control,
  textTop,
  separator,
}: Pick<SettingsIconProps, 'icon' | 'color'> & {
  title: string;
  titleClass?: string;
  value?: string;
  chevron?: boolean;
  control?: ReactNode;
  textTop: number;
  separator?: 'top' | 'bottom';
}) {
  return (
    <div className="relative flex h-[52px] items-start pl-3.5">
      <SettingsIcon icon={icon} color={color} className="mt-3 rounded-[7px]" />
      <span className={cn('ml-3.5 text-16', titleClass)} style={{ marginTop: textTop }}>
        {title}
      </span>
      <span className="ml-auto flex items-start">
        {value && (
          <span
            className={cn('text-16 text-muted', chevron ? '' : 'mr-3.5')}
            style={{ marginTop: textTop }}
          >
            {value}
          </span>
        )}
        {chevron && <Icon name="chevron" size={16} className="mt-[18px] mr-3.5 ml-1.5 text-faint" />}
        {control}
      </span>
      {separator && (
        <span
          className={cn(
            'absolute right-0 left-14 h-px bg-separator',
            separator === 'top' ? 'top-0' : 'bottom-0',
          )}
        />
      )}
    </div>
  );
}

/** The department's settings on the phone, from the account to signing out. */
export function ReglagesMobile() {
  return (
    <Screen tone="fill">
      <NavBar title="Réglages" />
      <Card className="relative mt-3 flex h-[72px] items-start pl-3.5">
        <Avatar initials="JP" size="md" tone="fill" className="mt-[18px] size-9 rounded-full bg-fill-2 text-13" />
        <span className="ml-3 flex flex-col">
          <span className="mt-3 text-16 font-semibold">Julie Perrin</span>
          <span className="mt-[3px] text-13 text-muted">Département Studio · Atelier Lumen</span>
        </span>
        <Icon name="chevron" size={16} className="mt-7 mr-3.5 ml-auto text-faint" />
      </Card>
      <PhoneGroupTitle className="mt-[22px]">Données</PhoneGroupTitle>
      <Card className="mt-1.5">
        <Row icon="cloud" color="green" title="Synchronisation" value="À jour" chevron textTop={16} separator="bottom" />
        <Row icon="download" color="ink" title="Hors ligne" value="31 Mo" chevron textTop={17} />
      </Card>
      <PhoneGroupTitle className="mt-5">Studio</PhoneGroupTitle>
      <Card className="mt-1.5">
        <Row icon="users" color="orange" title="Annuaire du Studio" value="84" chevron textTop={17} separator="bottom" />
        <Row icon="pin" color="red" title="Lieu et horaires" value="Lecture" chevron textTop={17} />
      </Card>
      <PhoneGroupTitle className="mt-5">App</PhoneGroupTitle>
      <Card className="mt-1.5">
        <Row
          icon="volume"
          color="grey"
          title="Son au scan"
          textTop={17}
          separator="bottom"
          control={<Switch checked label="Son au scan" className="mt-[10.5px] mr-3.5" />}
        />
        <Row icon="sun" color="grey" title="Apparence" value="Automatique" chevron textTop={17} separator="bottom" />
        <Row icon="logout" color="grey" title="Se déconnecter" titleClass="text-red" textTop={17} />
      </Card>
    </Screen>
  );
}

/** What this iPhone holds, when it last synced, and its app version. */
export function SynchronisationMobile() {
  return (
    <Screen tone="fill">
      <NavBar title="Synchronisation" />
      <Card className="relative mt-3 h-[120px]">
        <span className="absolute top-[18px] left-[18px] flex size-11 items-center justify-center rounded-full bg-green/12 text-green">
          <Icon name="check" size={22} />
        </span>
        <p className="absolute top-[18px] left-[76px] text-18 font-semibold">Tout est à jour</p>
        <p className="absolute top-[41px] left-[76px] text-14 text-muted">
          Dernière synchronisation à 11 h 21
        </p>
        <span className="absolute inset-x-4 top-[72px] h-px bg-separator" />
        <p className="absolute inset-x-4 top-[86px] text-center text-16 font-semibold">
          Synchroniser maintenant
        </p>
      </Card>
      <PhoneGroupTitle className="mt-6">Sur cet iPhone</PhoneGroupTitle>
      <Card className="mt-1.5">
        <Row icon="package" color="ink" title="Colis" value="418" textTop={15} />
        <Row icon="image" color="ink" title="Photos d’étiquettes" value="22 Mo" textTop={15} separator="top" />
        <Row icon="scan" color="ink" title="Lecture des étiquettes" value="42 Mo" textTop={15} separator="top" />
        <Row icon="lock" color="green" title="Stockage protégé" value="Oui" textTop={15} separator="top" />
      </Card>
      <p className="mt-3 px-4 text-13 leading-[1.4] text-muted">
        Stockage protégé : iOS ne supprimera pas ces données, même si l’app n’est pas ouverte
        pendant longtemps.
      </p>
      <PhoneGroupTitle className="mt-[26px]">Mise à jour</PhoneGroupTitle>
      <Card className="mt-1.5">
        <Row icon="download" color="ink" title="Version 2.0.3" value="À jour" textTop={15} />
        <Row icon="refresh" color="grey" title="Rechercher une mise à jour" chevron textTop={15} separator="top" />
      </Card>
    </Screen>
  );
}
