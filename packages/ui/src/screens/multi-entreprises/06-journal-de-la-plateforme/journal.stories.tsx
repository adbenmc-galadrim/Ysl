import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  JournalChargementMobile,
  JournalDesktop,
  JournalListMobile,
  JournalMobile,
  JournalVideMobile,
} from '#screens/multi-entreprises/06-journal-de-la-plateforme/journal-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/06 Journal de la plateforme/Journal',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'landingDesktop', isRotated: false } };
const mobile = { viewport: { value: 'iphone15', isRotated: false } };
const page =
  'multi-entreprises/06-journal-de-la-plateforme/journal--admin-de-l-app-journal-';

export const Ordinateur: Story = {
  name: 'Journal · ordinateur',
  parameters: { reference: `${page}ordinateur` },
  globals: desktop,
  render: () => <JournalDesktop />,
};

export const Mobile: Story = {
  name: 'Journal · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}mobile` },
  globals: mobile,
  render: () => <JournalMobile />,
};

export const ChargementMobile: Story = {
  name: 'Chargement · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}chargement-mobile` },
  globals: mobile,
  render: () => <JournalChargementMobile />,
};

export const VideMobile: Story = {
  name: 'Vide · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}vide-mobile` },
  globals: mobile,
  render: () => <JournalVideMobile />,
};

/** No reference: the mockup names people, the app never does (D26). */
const LINES = [
  {
    id: '1',
    when: 'Aujourd’hui, 9:14',
    kind: 'suspension',
    action: 'Entreprise suspendue',
    company: 'Studio Kerval',
    detail: '',
    by: 'SL',
  },
  {
    id: '2',
    when: 'Hier, 18:02',
    kind: 'deletion',
    action: 'Entreprise supprimée',
    company: 'Imprimerie Vasse',
    detail: '12 comptes, 3 départements, 940 colis effacés',
    by: 'SL',
  },
] as const;

export const Monte: Story = {
  name: 'Journal réel · ordinateur',
  globals: desktop,
  render: () => (
    <JournalDesktop
      data={{
        searchPlaceholder: 'Rechercher une entreprise',
        filters: [
          { icon: 'filter', label: 'Type', value: 'Tous', className: 'w-[260px]' },
        ],
        lines: [...LINES],
        range: '1–2 sur 2',
      }}
    />
  ),
};

export const MonteMobile: Story = {
  name: 'Journal réel · mobile',
  parameters: { device: { tone: 'light' } },
  globals: mobile,
  render: () => (
    <JournalListMobile
      days={[
        { title: 'Aujourd’hui', lines: [LINES[0]] },
        { title: 'Hier', lines: [LINES[1]] },
      ]}
      moreLabel="Voir plus"
    />
  ),
};
