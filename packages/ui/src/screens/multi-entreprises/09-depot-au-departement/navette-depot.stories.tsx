import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  NavetteAttenteConfirmation,
  NavetteColisARegulariser,
  NavetteDepartementADeposer,
  NavetteDepotConfirme,
  NavetteEcartDeclare,
  NavetteNombreDeColis,
  NavetteQrAutreDepartement,
  NavetteScannerQr,
} from '#screens/multi-entreprises/09-depot-au-departement/navette-depot-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/09 Dépôt au département/Navette · Dépôt',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ADeposer: Story = {
  name: 'Département à déposer',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--navette-departement-a-deposer-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteDepartementADeposer />,
};

export const ScannerQr: Story = {
  name: 'Scanner le QR',
  parameters: {
    device: { tone: 'dark' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--navette-scanner-le-qr-du-departement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteScannerQr />,
};

export const QrAutreDepartement: Story = {
  name: 'QR d’un autre département',
  parameters: {
    device: { tone: 'dark' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--navette-depot-qr-d-un-autre-departement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteQrAutreDepartement />,
};

export const NombreDeColis: Story = {
  name: 'Nombre de colis',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--navette-depot-nombre-de-colis-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteNombreDeColis />,
};

export const AttenteConfirmation: Story = {
  name: 'Attente de confirmation',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--navette-depot-attente-de-confirmation-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteAttenteConfirmation />,
};

export const Confirme: Story = {
  name: 'Confirmé',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--navette-depot-confirme-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteDepotConfirme />,
};

export const EcartDeclare: Story = {
  name: 'Écart déclaré',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--navette-depot-ecart-declare-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteEcartDeclare />,
};

export const ColisARegulariser: Story = {
  name: 'Colis à régulariser',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/09-depot-au-departement/depot--navette-colis-a-regulariser-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteColisARegulariser />,
};
