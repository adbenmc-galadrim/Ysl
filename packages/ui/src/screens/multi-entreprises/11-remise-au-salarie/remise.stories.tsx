import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  CodeAutreDepartementMobile,
  CodeRetraitMobile,
  NavetteRemiseMobile,
  RemiseConfirmeeMobile,
  ScanColisMobile,
  ScannerQrMobile,
  SesColisMobile,
  SignatureMobile,
} from '#screens/multi-entreprises/11-remise-au-salarie/remise-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/11 Remise au salarié/Remise',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const ScannerLeQr: Story = {
  name: 'Scanner le QR · mobile',
  parameters: {
    device: { tone: 'dark' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-scanner-le-qr-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ScannerQrMobile />,
};

export const CodeAutreDepartement: Story = {
  name: 'Code d’un autre département · mobile',
  parameters: {
    device: { tone: 'dark' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-code-d-un-autre-departement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <CodeAutreDepartementMobile />,
};

export const ScanDuColis: Story = {
  name: 'Scan du colis · mobile',
  parameters: {
    device: { tone: 'dark' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-scan-du-colis-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ScanColisMobile />,
};

export const SesColis: Story = {
  name: 'Ses colis, scan obligatoire · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-ses-colis-scan-obligatoire-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <SesColisMobile />,
};

export const CodeDeRetrait: Story = {
  name: 'Code de retrait · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-code-de-retrait-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <CodeRetraitMobile />,
};

export const Signature: Story = {
  name: 'Signature · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-signature-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <SignatureMobile />,
};

export const Confirmee: Story = {
  name: 'Remise confirmée · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--departement-remise-confirmee-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <RemiseConfirmeeMobile />,
};

export const ParLaNavette: Story = {
  name: 'Par la navette, petit site · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/11-remise-au-salarie/remise--navette-profil-petit-site-remise-par-la-navette-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <NavetteRemiseMobile />,
};
