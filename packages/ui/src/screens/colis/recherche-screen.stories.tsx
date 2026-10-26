import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';
import { EmptyState } from '#components/empty-state';
import { PARCELS } from '#fixtures/parcels';
import {
  type RechercheFilter,
  RechercheScreen,
} from '#screens/colis/recherche-screen';

const meta = {
  title: 'Écrans/05 Colis/Recherche',
  component: RechercheScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof RechercheScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

const FILTERS: RechercheFilter[] = [
  { label: 'Tout', selected: true },
  { label: 'En attente' },
  { label: 'Remis' },
  { label: '30 derniers jours' },
  { label: 'Aujourd’hui' },
  { label: 'À compléter' },
  { label: 'En souffrance' },
];

const GROUPING = {
  value: 'status',
  options: [
    { value: 'status', label: 'Par statut' },
    { value: 'recipient', label: 'Par destinataire' },
    { value: 'date', label: 'Par date' },
  ],
};

const HINT =
  'Recherche sur le nom, le service, le numéro de suivi, l’expéditeur et le transporteur.';

export const Recherche: Story = {
  parameters: { reference: '05-colis/colis--recherche' },
  args: {
    query: 'garn',
    filters: FILTERS,
    grouping: GROUPING,
    sections: [
      {
        title: 'En attente',
        parcels: [{ ...PARCELS.ines, status: 'En attente depuis 3 jours' }],
      },
      {
        title: 'Remis',
        parcels: [PARCELS.inesFedex, PARCELS.inesAmazon, PARCELS.romain],
      },
    ],
    hint: HINT,
  },
};

/** Grouped by recipient: one section per person, namesakes apart. */
export const ParDestinataire: Story = {
  name: 'Par destinataire',
  args: {
    ...Recherche.args,
    grouping: { ...GROUPING, value: 'recipient' },
    sections: [
      {
        id: 'person-ines',
        title: 'Inès Garnier',
        parcels: [
          { ...PARCELS.ines, status: 'En attente depuis 3 jours' },
          PARCELS.inesFedex,
          PARCELS.inesAmazon,
        ],
      },
      {
        id: 'person-romain',
        title: 'Romain Garnier',
        parcels: [PARCELS.romain],
      },
    ],
  },
};

/** Grouped by day, latest first: the day a parcel came in or went out. */
export const ParDate: Story = {
  name: 'Par date',
  args: {
    ...Recherche.args,
    grouping: { ...GROUPING, value: 'date' },
    sections: [
      {
        id: '2026-10-21',
        title: 'Mercredi 21 octobre',
        parcels: [{ ...PARCELS.ines, status: 'En attente depuis 3 jours' }],
      },
      {
        id: '2026-10-14',
        title: 'Mercredi 14 octobre',
        parcels: [PARCELS.inesFedex],
      },
      {
        id: '2026-10-02',
        title: 'Vendredi 2 octobre',
        parcels: [PARCELS.inesAmazon],
      },
      {
        id: '2026-09-28',
        title: 'Lundi 28 septembre',
        parcels: [PARCELS.romain],
      },
    ],
  },
};

/** Nothing matches: the query stays, one tap clears it. */
export const SansResultat: Story = {
  name: 'Sans résultat',
  args: {
    ...Recherche.args,
    query: 'garnx',
    sections: [],
    hint: undefined,
    children: (
      <EmptyState
        icon="search"
        title="Aucun résultat pour “garnx”"
        description="Vérifiez l’orthographe, ou cherchez un numéro de suivi."
        className="mt-[96px]"
      >
        <Button variant="link" className="text-16 font-semibold">
          Effacer
        </Button>
      </EmptyState>
    ),
  },
};

const CAST = [
  PARCELS.ines,
  PARCELS.hugo,
  PARCELS.nora,
  PARCELS.camille,
  PARCELS.inesFedex,
  PARCELS.romain,
];

/** The whole journal behind an empty field: 500 rows, only those in view drawn. */
export const Journal: Story = {
  args: {
    query: '',
    filters: FILTERS,
    grouping: GROUPING,
    sections: [
      {
        title: 'En attente',
        parcels: Array.from({ length: 200 }, (_, i) => ({
          ...CAST[i % 4]!,
          id: `waiting-${i}`,
        })),
      },
      {
        title: 'Remis',
        parcels: Array.from({ length: 300 }, (_, i) => ({
          ...CAST[4 + (i % 2)]!,
          id: `out-${i}`,
        })),
      },
    ],
    hint: HINT,
  },
};
