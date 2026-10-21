import type { Meta, StoryObj } from '@storybook/react-vite';

import { Banner } from '#components/banner';
import { Button } from '#components/button';
import { EmptyState } from '#components/empty-state';
import { ListRowValue } from '#components/list-row';
import { Toast } from '#components/toast';
import { PARCELS } from '#fixtures/parcels';
import { ColisScreen } from '#screens/colis/colis-screen';

const meta = {
  title: 'Écrans/05 Colis/Colis',
  component: ColisScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ColisScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Accueil: Story = {
  parameters: { reference: '05-colis/colis--colis' },
  args: {
    sync: 'synced',
    summary: '18 colis, dont 6 à traiter',
    sections: [
      {
        title: 'À compléter',
        parcels: [PARCELS.unknown],
        rowAction: () => (
          <Button variant="danger" size="xs" className="w-[81px]">
            Choisir
          </Button>
        ),
      },
      {
        title: 'À notifier',
        parcels: [PARCELS.camille],
        action: (
          <Button size="xs" className="w-[84px]">
            Notifier
          </Button>
        ),
      },
      {
        title: 'En attente de retrait',
        parcels: [PARCELS.ines, PARCELS.hugo, PARCELS.nora],
      },
      { title: 'Remis aujourd’hui', count: 12, parcels: [PARCELS.malik] },
    ],
  },
};

export const Chargement: Story = {
  parameters: { reference: '05-colis/colis--colis-chargement' },
  args: {
    sync: 'syncing',
    summary: '18 colis, dont 6 à traiter',
    loading: true,
    sections: [
      {
        title: 'À compléter',
        parcels: [PARCELS.unknown],
        rowAction: () => (
          <Button variant="danger" size="xs" className="w-[81px]">
            Choisir
          </Button>
        ),
      },
      { title: 'À notifier', parcels: [PARCELS.camille] },
    ],
  },
};

export const Vide: Story = {
  parameters: { reference: '05-colis/colis--colis-vide' },
  args: {
    sync: 'synced',
    summary: 'Aucun colis en attente',
    sections: [],
    bottomBar: false,
    children: (
      <EmptyState
        icon="inbox"
        title="Tout est remis"
        description="Les colis scannés apparaîtront ici, rangés par ce qu’il reste à faire."
        className="mt-[129px]"
      >
        <Button className="w-[201px]">Scanner des colis</Button>
        <Button variant="link" className="text-16 font-semibold">
          Voir les colis remis
        </Button>
      </EmptyState>
    ),
  },
};

/** Rows touched offline say where their change stands instead of a chevron. */
const PENDING: Record<string, string> = {
  [PARCELS.camille.id]: 'Non envoyé',
  [PARCELS.hugo.id]: 'En file',
};

export const HorsLigne: Story = {
  name: 'Hors ligne',
  parameters: { reference: '05-colis/colis--colis-hors-ligne' },
  args: {
    sync: 'offline',
    summary: '18 colis, dont 6 à traiter',
    notice: (
      <Banner
        tone="orange"
        icon="cloud"
        title="4 changements en attente"
        description="Enregistrés sur l’iPhone, envoyés au retour du réseau."
        // Penpot fixes this card at 64 px and lets the second line touch
        // its bottom edge; kept as drawn.
        classNames={{
          root: 'h-16 py-[11px]',
          description: 'mt-[3px] leading-4',
        }}
      />
    ),
    sections: [
      {
        title: 'À notifier',
        parcels: [PARCELS.camille],
        action: (
          <Button size="xs" className="w-[84px]">
            Notifier
          </Button>
        ),
      },
      {
        title: 'En attente de retrait',
        parcels: [PARCELS.ines, PARCELS.hugo, PARCELS.nora],
      },
    ].map((section) => ({
      ...section,
      rowAction: (parcel) =>
        PENDING[parcel.id] && <ListRowValue>{PENDING[parcel.id]}</ListRowValue>,
    })),
    toast: (
      <Toast message="Nouvelle version disponible" actionLabel="Mettre à jour" />
    ),
  },
};
