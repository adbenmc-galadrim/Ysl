import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  AdminCompteDetailDesktop,
  AdminComptesDesktop,
  AdminComptesErreurDesktop,
  AdminInviterDesktop,
} from '#screens/multi-entreprises/15-comptes/comptes-desktop-screen';
import {
  AdminCompteMobile,
  AdminComptesMobile,
  AdminInviterMobile,
} from '#screens/multi-entreprises/15-comptes/comptes-mobile-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/15 Comptes/Admin entreprise',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const DESKTOP = { viewport: { value: 'landingDesktop', isRotated: false } };
const MOBILE = { viewport: { value: 'iphone15', isRotated: false } };
const PAGE = 'multi-entreprises/15-comptes/comptes--admin-entreprise-';

export const ListeOrdinateur: Story = {
  name: 'Liste · ordinateur',
  parameters: { reference: `${PAGE}comptes-ordinateur` },
  globals: DESKTOP,
  render: () => <AdminComptesDesktop />,
};

export const ListeMobile: Story = {
  name: 'Liste · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}comptes-mobile` },
  globals: MOBILE,
  render: () => <AdminComptesMobile />,
};

export const DetailOrdinateur: Story = {
  name: 'Détail · ordinateur',
  parameters: { reference: `${PAGE}compte-detail-ordinateur` },
  globals: DESKTOP,
  render: () => <AdminCompteDetailDesktop />,
};

export const DetailMobile: Story = {
  name: 'Détail · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}compte-mobile` },
  globals: MOBILE,
  render: () => <AdminCompteMobile />,
};

export const ErreurOrdinateur: Story = {
  name: 'Erreur · ordinateur',
  parameters: { reference: `${PAGE}comptes-erreur-ordinateur` },
  globals: DESKTOP,
  render: () => <AdminComptesErreurDesktop />,
};

export const InviterOrdinateur: Story = {
  name: 'Inviter · ordinateur',
  parameters: { reference: `${PAGE}inviter-un-compte-ordinateur` },
  globals: DESKTOP,
  render: () => <AdminInviterDesktop />,
};

export const InviterMobile: Story = {
  name: 'Inviter · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}inviter-un-compte-mobile`,
  },
  globals: MOBILE,
  render: () => <AdminInviterMobile />,
};

export const AdresseUtiliseeOrdinateur: Story = {
  name: 'Adresse déjà utilisée · ordinateur',
  parameters: { reference: `${PAGE}inviter-adresse-deja-utilisee-ordinateur` },
  globals: DESKTOP,
  render: () => <AdminInviterDesktop taken />,
};

export const AdresseUtiliseeMobile: Story = {
  name: 'Adresse déjà utilisée · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}inviter-adresse-deja-utilisee-mobile`,
  },
  globals: MOBILE,
  render: () => <AdminInviterMobile taken />,
};
