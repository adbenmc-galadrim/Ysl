import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ChoisirDepartementMobile,
  ChoisirDestinataireMobile,
  DestinataireInconnuMobile,
  PourQuiMobile,
} from '#screens/multi-entreprises/08-rapprochement-du-destinataire/navette-rapprochement-screen';

const PAGE =
  'multi-entreprises/08-rapprochement-du-destinataire/rapprochement--navette';

const meta = {
  title: 'Écrans/Multi-entreprises/08 Rapprochement du destinataire/Navette',
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PourQui: Story = {
  name: 'Pour qui est ce colis · département · mobile',
  parameters: { reference: `${PAGE}-pour-qui-est-ce-colis-departement-mobile` },
  render: () => <PourQuiMobile />,
};

export const ChoisirDestinataire: Story = {
  name: 'Choisir le destinataire · tout l’annuaire · mobile',
  parameters: {
    reference: `${PAGE}-choisir-le-destinataire-tout-l-annuaire-mobile`,
  },
  render: () => <ChoisirDestinataireMobile />,
};

export const DestinataireInconnu: Story = {
  name: 'Destinataire inconnu · mobile',
  parameters: { reference: `${PAGE}-destinataire-inconnu-mobile` },
  render: () => <DestinataireInconnuMobile />,
};

export const ChoisirDepartement: Story = {
  name: 'Choisir le département · mobile',
  parameters: { reference: `${PAGE}-choisir-le-departement-mobile` },
  render: () => <ChoisirDepartementMobile />,
};
