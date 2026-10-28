import type { Meta, StoryObj } from '@storybook/react-vite';

import { PEOPLE } from '#fixtures/people';
import { QuiRetireScreen } from '#screens/remise/qui-retire-screen';

const meta = {
  title: 'Écrans/09 Zones d’ombre/Remise/Qui retire',
  component: QuiRetireScreen,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'light' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof QuiRetireScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Recherche: Story = {
  parameters: { reference: '09-zones-d-ombre/remise--qui-retire' },
  args: {
    query: 'nor',
    waiting: [
      { person: PEOPLE.nora, parcels: 3 },
      { person: PEOPLE.noe, parcels: 1 },
    ],
    others: [PEOPLE.noemie],
  },
};

export const Vide: Story = { args: { query: '', waiting: [], others: [] } };

/** Choosing who collects for Nora: anyone of the directory or a contact, or the name as typed. */
export const CollegueQuiRetire: Story = {
  name: 'Collègue qui retire',
  args: {
    title: 'Qui retire pour Nora Haddad ?',
    navTitle: 'Retiré par',
    query: 'paul m',
    waiting: [],
    others: [PEOPLE.paul],
    othersTitle: 'Annuaire et contacts',
    onPickOther: () => {},
    typed: 'Paul M',
    onUseTyped: () => {},
    note: 'Le QR ou le code présenté vaut preuve pour Nora Haddad ; notez qui retire.',
  },
};
