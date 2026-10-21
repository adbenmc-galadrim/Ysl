import { useState } from 'react';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { LargeTitle } from '#components/large-title';
import { NavBar, NavBarAction } from '#components/nav-bar';
import {
  ParcelSection,
  type ParcelSectionProps,
} from '#components/parcel-section';
import { Screen } from '#components/screen';

export type SelectionScreenProps = {
  sections: Omit<
    ParcelSectionProps,
    'className' | 'selectedIds' | 'onSelectedChange'
  >[];
  /** Ids ticked when the screen opens. */
  selectedIds: string[];
};

/**
 * Selection mode of the home list: several parcels handed over or chased in
 * one go — a colleague collecting for the whole team.
 */
export function SelectionScreen({
  sections,
  selectedIds: initialIds,
}: SelectionScreenProps) {
  const [ids, setIds] = useState(initialIds);
  const all = sections.flatMap((s) => s.parcels.map((p) => p.id));
  return (
    <Screen
      bottom={
        <BottomBar surface="line" className="pt-[15px]">
          <Button
            variant="secondary"
            icon="bell"
            iconSize={20}
            className="w-[134px] justify-start gap-2 pr-0 pl-5 text-16"
          >
            Relancer
          </Button>
          <Button className="min-w-0 flex-1">
            {`Remettre ${ids.length} colis`}
          </Button>
        </BottomBar>
      }
    >
      <NavBar
        back={false}
        leading={
          <NavBarAction
            tone="blue"
            className="font-normal"
            onClick={() => setIds(all)}
          >
            Tout sélectionner
          </NavBarAction>
        }
        trailing={<NavBarAction tone="blue">OK</NavBarAction>}
      />
      <LargeTitle
        size="md"
        title={`${ids.length} colis sélectionné${ids.length > 1 ? 's' : ''}`}
        className="mt-1"
      />
      {sections.map((section, s) => (
        <ParcelSection
          key={section.title}
          {...section}
          selectedIds={ids}
          onSelectedChange={(parcel, selected) =>
            setIds((prev) =>
              selected
                ? [...prev, parcel.id]
                : prev.filter((id) => id !== parcel.id),
            )
          }
          className={s ? 'mt-[29px]' : 'mt-6'}
        />
      ))}
    </Screen>
  );
}
