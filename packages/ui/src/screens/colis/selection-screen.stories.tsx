import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { Button } from '#components/button';
import { Toast } from '#components/toast';
import { PARCELS } from '#fixtures/parcels';
import {
  SelectionScreen,
  type SelectionScreenProps,
} from '#screens/colis/selection-screen';

/** The screen with its ticks held, as the home list holds them. */
function Ticking(props: SelectionScreenProps) {
  const [ids, setIds] = useState(props.selectedIds);
  const all = props.sections.flatMap((s) => s.parcels.map((p) => p.id));
  const allSelected = all.every((id) => ids.includes(id));
  return (
    <SelectionScreen
      {...props}
      selectedIds={ids}
      allSelected={allSelected}
      onSelectAll={() => setIds(allSelected ? [] : all)}
      onSelectedChange={(parcel, selected) =>
        setIds((prev) =>
          selected
            ? [...prev, parcel.id]
            : prev.filter((id) => id !== parcel.id),
        )
      }
    />
  );
}

const meta = {
  title: 'Écrans/05 Colis/Sélection',
  component: SelectionScreen,
  render: (args) => <Ticking {...args} />,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof SelectionScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Selection: Story = {
  name: 'Sélection',
  parameters: { reference: '05-colis/colis--selection' },
  args: {
    sections: [
      { title: 'À notifier', parcels: [PARCELS.camille] },
      {
        title: 'En attente de retrait',
        parcels: [PARCELS.ines, PARCELS.hugo, PARCELS.nora],
      },
    ],
    selectedIds: [PARCELS.ines.id, PARCELS.hugo.id, PARCELS.nora.id],
  },
};

const all = (
  <Button variant="link" className="text-15 font-normal">
    Tout
  </Button>
);

/**
 * In the app: « Tout » per section, the search field and the counters
 * still filter, « ⋯ » holds Supprimer and Exporter. No Penpot drawing.
 */
export const InTheApp: Story = {
  name: 'Dans l’app',
  args: {
    sections: [
      { title: 'À notifier', parcels: [PARCELS.camille], action: all },
      {
        title: 'En attente de retrait',
        parcels: [PARCELS.ines, PARCELS.hugo, PARCELS.nora],
        action: all,
      },
    ],
    selectedIds: [PARCELS.camille.id, PARCELS.hugo.id],
    query: '',
    onQueryChange: () => {},
    counters: [
      { label: 'À retirer', count: 3 },
      { label: 'À relancer', count: 1, selected: true },
      { label: 'En souffrance', count: 1 },
    ],
    remindLabel: 'Notifier',
    onMore: () => {},
  },
};

/** What an action left out, said over the bar. */
export const LeftOut: Story = {
  name: 'Colis ignorés',
  args: {
    ...InTheApp.args,
    toast: <Toast message="1 colis ignoré : sans destinataire" />,
  },
};

/** Nothing ticked: the actions wait for a first row. */
export const NothingTicked: Story = {
  name: 'Rien de sélectionné',
  args: {
    sections: [
      {
        title: 'En attente de retrait',
        parcels: [PARCELS.ines, PARCELS.hugo, PARCELS.nora],
      },
    ],
    selectedIds: [],
    onMore: () => {},
  },
};
