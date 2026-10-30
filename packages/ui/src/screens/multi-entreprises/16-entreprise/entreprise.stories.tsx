import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ConservationDesktop,
  ConservationMobile,
  DomaineMobile,
  DomaineVerificationEchoueeMobile,
  EntrepriseMobile,
  IdentiteDomaineAVerifierDesktop,
  IdentiteDomaineVerifieDesktop,
} from '#screens/multi-entreprises/16-entreprise/entreprise-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/16 Entreprise/Admin entreprise · Entreprise',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'landingDesktop', isRotated: false } };
const phone = { viewport: { value: 'iphone15', isRotated: false } };
const REF = 'multi-entreprises/16-entreprise/entreprise--admin-entreprise';

export const IdentiteAVerifierOrdinateur: Story = {
  name: 'Identité, domaine à vérifier · ordinateur',
  parameters: { reference: `${REF}-identite-et-e-mails-domaine-a-verifier-ordinateur` },
  globals: desktop,
  render: () => <IdentiteDomaineAVerifierDesktop />,
};

export const IdentiteVerifieOrdinateur: Story = {
  name: 'Identité, domaine vérifié · ordinateur',
  parameters: { reference: `${REF}-identite-et-e-mails-domaine-verifie-ordinateur` },
  globals: desktop,
  render: () => <IdentiteDomaineVerifieDesktop />,
};

export const ConservationOrdinateur: Story = {
  name: 'Conservation · ordinateur',
  parameters: { reference: `${REF}-conservation-ordinateur` },
  globals: desktop,
  render: () => <ConservationDesktop />,
};

export const EntrepriseTelephone: Story = {
  name: 'Entreprise · mobile',
  parameters: { device: { tone: 'light' }, reference: `${REF}-entreprise-mobile` },
  globals: phone,
  render: () => <EntrepriseMobile />,
};

export const DomaineTelephone: Story = {
  name: 'Domaine d’envoi · mobile',
  parameters: { device: { tone: 'light' }, reference: `${REF}-domaine-d-envoi-mobile` },
  globals: phone,
  render: () => <DomaineMobile />,
};

export const DomaineEchecTelephone: Story = {
  name: 'Domaine, vérification échouée · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${REF}-domaine-verification-echouee-mobile`,
  },
  globals: phone,
  render: () => <DomaineVerificationEchoueeMobile />,
};

export const ConservationTelephone: Story = {
  name: 'Conservation · mobile',
  parameters: { device: { tone: 'light' }, reference: `${REF}-conservation-mobile` },
  globals: phone,
  render: () => <ConservationMobile />,
};
