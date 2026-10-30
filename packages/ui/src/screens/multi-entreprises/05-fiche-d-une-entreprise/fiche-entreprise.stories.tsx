import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  FicheEntrepriseDesktop,
  SupprimerDesktop,
  SuspendreDesktop,
} from '#screens/multi-entreprises/05-fiche-d-une-entreprise/fiche-entreprise-desktop';
import {
  FicheEntrepriseInvitationMobile,
  FicheEntrepriseMobile,
  FicheEntrepriseSuspendueMobile,
  SupprimerMobile,
  SuspendreMobile,
} from '#screens/multi-entreprises/05-fiche-d-une-entreprise/fiche-entreprise-mobile';

const meta = {
  title: 'Écrans/Multi-entreprises/05 Fiche d’une entreprise/Parcours',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'landingDesktop', isRotated: false } };
const mobile = { viewport: { value: 'iphone15', isRotated: false } };
const page =
  'multi-entreprises/05-fiche-d-une-entreprise/fiche-entreprise--admin-de-l-app-';

export const FicheOrdinateur: Story = {
  name: 'Fiche · ordinateur',
  parameters: { reference: `${page}fiche-entreprise-ordinateur` },
  globals: desktop,
  render: () => <FicheEntrepriseDesktop />,
};

export const FicheMobile: Story = {
  name: 'Fiche · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${page}fiche-entreprise-mobile`,
  },
  globals: mobile,
  render: () => <FicheEntrepriseMobile />,
};

export const InvitationEnAttenteMobile: Story = {
  name: 'Invitation en attente · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${page}fiche-entreprise-invitation-en-attente-mobile`,
  },
  globals: mobile,
  render: () => <FicheEntrepriseInvitationMobile />,
};

export const SuspendueMobile: Story = {
  name: 'Suspendue · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${page}fiche-entreprise-suspendue-mobile`,
  },
  globals: mobile,
  render: () => <FicheEntrepriseSuspendueMobile />,
};

export const SuspendreOrdinateur: Story = {
  name: 'Suspendre · ordinateur',
  parameters: { reference: `${page}suspendre-ordinateur` },
  globals: desktop,
  render: () => <SuspendreDesktop />,
};

export const SuspendreTelephone: Story = {
  name: 'Suspendre · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}suspendre-mobile` },
  globals: mobile,
  render: () => <SuspendreMobile />,
};

export const SupprimerOrdinateur: Story = {
  name: 'Supprimer · ordinateur',
  parameters: { reference: `${page}supprimer-ordinateur` },
  globals: desktop,
  render: () => <SupprimerDesktop />,
};

export const SupprimerTelephone: Story = {
  name: 'Supprimer · mobile',
  parameters: { device: { tone: 'light' }, reference: `${page}supprimer-mobile` },
  globals: mobile,
  render: () => <SupprimerMobile />,
};
