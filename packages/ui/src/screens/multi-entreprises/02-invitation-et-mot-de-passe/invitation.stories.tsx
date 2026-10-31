import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  CreerMotDePasseDesktop,
  CreerMotDePasseMobile,
  InvitationEmailDesktop,
  InvitationEmailMobile,
} from '#screens/multi-entreprises/02-invitation-et-mot-de-passe/invitation-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/02 Invitation/Tout compte invité',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const PAGE =
  'multi-entreprises/02-invitation-et-mot-de-passe/invitation--tout-compte-invite';

export const InvitationOrdinateur: Story = {
  name: 'Invitation · ordinateur',
  parameters: { reference: `${PAGE}-invitation-ordinateur` },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <InvitationEmailDesktop />,
};

export const EmailMobile: Story = {
  name: 'E-mail d’invitation · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}-e-mail-d-invitation-mobile` },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <InvitationEmailMobile />,
};

export const MotDePasseOrdinateur: Story = {
  name: 'Créer le mot de passe · ordinateur',
  parameters: { reference: `${PAGE}-creer-le-mot-de-passe-ordinateur` },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <CreerMotDePasseDesktop />,
};

export const MotDePasseMobile: Story = {
  name: 'Créer le mot de passe · mobile',
  parameters: { device: { tone: 'light' }, reference: `${PAGE}-creer-le-mot-de-passe-mobile` },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <CreerMotDePasseMobile />,
};
