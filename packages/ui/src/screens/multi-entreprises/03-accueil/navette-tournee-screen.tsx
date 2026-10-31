import type { ReactNode } from 'react';

import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { IconTile, type IconTileProps } from '#components/icon-tile';
import { LargeTitle } from '#components/large-title';
import { PhoneRow } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SearchTrigger } from '#components/search-field';
import { SectionHeader } from '#components/section-header';
import { StatusPill, SYNC_PILL } from '#components/status-pill';
import { StateHero } from '#screens/multi-entreprises/21-etats/etats-parts';

export type TourStopRow = {
  id: string;
  name: string;
  place: string;
  parcels: string;
};

export type TourDoneRow = { id: string; name: string; line: string };

/** What the shuttle has to deal with before leaving: a line above the departments. */
export type TourTask = {
  id: string;
  icon: IconTileProps['icon'];
  title: string;
  line: string;
  action?: { label: string; onClick: () => void };
  onClick?: () => void;
};

export type TourScreenProps = {
  sync: keyof typeof SYNC_PILL;
  subtitle?: string;
  /** From 0 to 1; no track without a tour. */
  progress?: number;
  alert?: { title: string; description: string };
  tasks?: readonly TourTask[];
  stops?: readonly TourStopRow[];
  done?: readonly TourDoneRow[];
  /** Replaces the two lists: nothing to deposit, or everything deposited. */
  hero?: { icon: 'scan' | 'check'; title: string; text: string };
  allParcels?: { label: string; onClick: () => void };
  onStop?: (id: string) => void;
  onDone?: (id: string) => void;
  onMenu?: () => void;
  onSearch?: () => void;
  onScan?: () => void;
  children?: ReactNode;
};

function Tappable({
  onClick,
  children,
}: {
  onClick?: () => void;
  children: ReactNode;
}) {
  if (!onClick) return <>{children}</>;
  return (
    <button
      type="button"
      className="block w-full cursor-pointer text-left"
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/** The shuttle's home: the round's progress and the departments still to serve. */
export function TourScreen({
  sync,
  subtitle,
  progress,
  alert,
  tasks = [],
  stops = [],
  done = [],
  hero,
  allParcels,
  onStop,
  onDone,
  onMenu,
  onSearch,
  onScan,
  children,
}: TourScreenProps) {
  return (
    <Screen
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <BottomBar className="pt-[34px] pb-[26px]">
          <SearchTrigger size="dock" onClick={onSearch} />
          <Button
            icon="scan"
            iconSize={20}
            className="w-[171px] gap-2"
            onClick={onScan}
          >
            Scanner
          </Button>
        </BottomBar>
      }
    >
      <div className="flex h-11 items-center justify-between">
        <StatusPill {...SYNC_PILL[sync]} size="sm" />
        <IconButton
          icon="menu"
          label="Menu"
          size="lg"
          iconSize={22}
          className="-mr-0.5"
          onClick={onMenu}
        />
      </div>
      <LargeTitle
        title={<span className="tracking-[-0.4px]">Tournée</span>}
        subtitle={subtitle}
        className="mt-[7px] gap-1.5"
      />
      {progress !== undefined && (
        <div className="mt-2.5 h-1.5 shrink-0 overflow-hidden rounded-[3px] bg-fill-2">
          <div
            className={
              progress >= 1
                ? 'h-full rounded-[3px] bg-green'
                : 'h-full rounded-[3px] bg-ink'
            }
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}
      {alert && (
        <Banner
          tone="red"
          icon="warning"
          title={alert.title}
          description={alert.description}
          className="mt-4 h-[67px] shrink-0 items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4"
          classNames={{
            icon: 'mt-4',
            title: 'mt-[15px] text-15',
            description: 'mt-0.5 text-13 leading-4',
          }}
        />
      )}
      {tasks.length > 0 && (
        <div className="mt-4">
          {tasks.map((task, i) => (
            <Tappable key={task.id} onClick={task.onClick}>
              <PhoneRow
                height={68}
                leading={<IconTile icon={task.icon} tone="fill" />}
                title={task.title}
                lines={[task.line]}
                chevron={Boolean(task.onClick)}
                before={
                  task.action && (
                    <Button size="xs" onClick={task.action.onClick}>
                      {task.action.label}
                    </Button>
                  )
                }
                separator={i < tasks.length - 1}
              />
            </Tappable>
          ))}
        </div>
      )}
      {hero ? (
        <div className="relative min-h-[320px]">
          <StateHero
            top={40}
            icon={hero.icon}
            tone={hero.icon === 'check' ? 'green' : 'fill'}
            title={hero.title}
            text={hero.text}
          />
        </div>
      ) : (
        <>
          {stops.length > 0 && (
            <>
              <SectionHeader
                title={<span className="inline-block w-[105px]">À déposer</span>}
                count={stops.length}
                size="lg"
                className="mt-6 h-[27px]"
              />
              <div className="mt-3.5">
                {stops.map((stop, i) => (
                  <Tappable
                    key={stop.id}
                    onClick={onStop && (() => onStop(stop.id))}
                  >
                    <PhoneRow
                      height={68}
                      leading={<IconTile icon="building" tone="fill" />}
                      title={stop.name}
                      lines={[stop.place]}
                      before={
                        <span className="text-17 font-semibold">
                          {stop.parcels}
                        </span>
                      }
                      separator={i < stops.length - 1}
                    />
                  </Tappable>
                ))}
              </div>
            </>
          )}
          {done.length > 0 && (
            <>
              <SectionHeader
                title={<span className="inline-block w-[91px]">Déposés</span>}
                count={done.length}
                size="lg"
                className="mt-[11px] h-[27px]"
              />
              <div className="mt-3.5">
                {done.map((row, i) => (
                  <Tappable
                    key={row.id}
                    onClick={onDone && (() => onDone(row.id))}
                  >
                    <PhoneRow
                      height={64}
                      leading={
                        <IconTile
                          icon="check"
                          tone="fill"
                          className="bg-green-soft text-green"
                        />
                      }
                      title={row.name}
                      lines={[row.line]}
                      chevron={Boolean(onDone)}
                      separator={i < done.length - 1}
                    />
                  </Tappable>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {allParcels && (
        <button
          type="button"
          className="mt-4 mb-2 cursor-pointer py-2 text-left text-15 font-semibold text-blue"
          onClick={allParcels.onClick}
        >
          {allParcels.label}
        </button>
      )}
      {children}
    </Screen>
  );
}

const TO_DEPOSIT = [
  {
    id: 'studio',
    name: 'Studio',
    place: 'Bât. A, 2e étage, accueil',
    parcels: '6 colis',
  },
  {
    id: 'finance',
    name: 'Finance',
    place: 'Bât. B, 4e étage, bureau 412',
    parcels: '5 colis',
  },
  {
    id: 'juridique',
    name: 'Juridique',
    place: 'Bât. B, 5e étage, secrétariat',
    parcels: '3 colis',
  },
];

export function NavetteTourneeMobile() {
  return (
    <TourScreen
      sync="synced"
      subtitle="1 département sur 4 déposé · 14 colis restent"
      progress={0.25}
      alert={{
        title: '1 colis à régulariser',
        description: 'Finance a compté 4 colis sur 5 au dépôt de 9:40.',
      }}
      stops={TO_DEPOSIT}
      onDone={() => undefined}
      done={[
        { id: 'courrier', name: 'Service courrier', line: '4 colis · confirmé à 8:40' },
      ]}
    />
  );
}
