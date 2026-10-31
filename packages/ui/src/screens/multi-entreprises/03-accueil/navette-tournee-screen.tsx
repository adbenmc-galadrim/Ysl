import { Banner } from '#components/banner';
import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { IconButton } from '#components/icon-button';
import { IconTile } from '#components/icon-tile';
import { LargeTitle } from '#components/large-title';
import { PhoneRow } from '#components/phone-parts';
import { Screen } from '#components/screen';
import { SearchTrigger } from '#components/search-field';
import { SectionHeader } from '#components/section-header';
import { StatusPill, SYNC_PILL } from '#components/status-pill';

const TO_DEPOSIT = [
  { name: 'Studio', place: 'Bât. A, 2e étage, accueil', parcels: '6 colis' },
  { name: 'Finance', place: 'Bât. B, 4e étage, bureau 412', parcels: '5 colis' },
  { name: 'Juridique', place: 'Bât. B, 5e étage, secrétariat', parcels: '3 colis' },
];

/** The shuttle's home: the round's progress and the departments still to serve. */
export function NavetteTourneeMobile() {
  return (
    <Screen
      className="pt-[calc(var(--safe-top)+6px)]"
      bottom={
        <BottomBar className="pt-[34px] pb-[26px]">
          <SearchTrigger size="dock" />
          <Button icon="scan" iconSize={20} className="w-[171px] gap-2">
            Scanner
          </Button>
        </BottomBar>
      }
    >
      <div className="flex h-11 items-center justify-between">
        <StatusPill {...SYNC_PILL.synced} size="sm" />
        <IconButton
          icon="menu"
          label="Menu"
          size="lg"
          iconSize={22}
          className="-mr-0.5"
        />
      </div>
      <LargeTitle
        title={<span className="tracking-[-0.4px]">Tournée</span>}
        subtitle="1 département sur 4 déposé · 14 colis restent"
        className="mt-[7px] gap-1.5"
      />
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-[3px] bg-fill-2">
        <div className="h-full w-1/4 rounded-[3px] bg-ink" />
      </div>
      <Banner
        tone="red"
        icon="warning"
        title="1 colis à régulariser"
        description="Finance a compté 4 colis sur 5 au dépôt de 9:40."
        className="mt-4 h-[67px] items-start gap-2.5 rounded-[14px] py-0 pr-4 pl-4"
        classNames={{
          icon: 'mt-4',
          title: 'mt-[15px] text-15',
          description: 'mt-0.5 text-13 leading-4',
        }}
      />
      <SectionHeader
        title={<span className="inline-block w-[105px]">À déposer</span>}
        count={3}
        size="lg"
        className="mt-6 h-[27px]"
      />
      <div className="mt-3.5">
        {TO_DEPOSIT.map((department, i) => (
          <PhoneRow
            key={department.name}
            height={68}
            leading={<IconTile icon="building" tone="fill" />}
            title={department.name}
            lines={[department.place]}
            before={
              <span className="text-17 font-semibold">{department.parcels}</span>
            }
            separator={i < TO_DEPOSIT.length - 1}
          />
        ))}
      </div>
      <SectionHeader
        title={<span className="inline-block w-[91px]">Déposés</span>}
        count={1}
        size="lg"
        className="mt-[11px] h-[27px]"
      />
      <div className="mt-3.5">
        <PhoneRow
          height={64}
          leading={
            <IconTile
              icon="check"
              tone="fill"
              className="bg-green-soft text-green"
            />
          }
          title="Service courrier"
          lines={['4 colis · confirmé à 8:40']}
        />
      </div>
    </Screen>
  );
}
