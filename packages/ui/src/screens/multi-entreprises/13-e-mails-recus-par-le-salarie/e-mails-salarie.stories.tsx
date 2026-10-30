import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  CODE_ONLY_MAIL,
  NO_LOGO_MAIL,
  NOTICE_MAIL,
  REMINDER_MAIL,
  SalarieMailDesktop,
  SalarieMailMobile,
} from '#screens/multi-entreprises/13-e-mails-recus-par-le-salarie/e-mails-salarie-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/13 E-mails reçus par le salarié/Salarié · E-mails',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const PAGE = 'multi-entreprises/13-e-mails-recus-par-le-salarie/e-mails-salarie--salarie';
const DESKTOP = { viewport: { value: 'landingDesktop', isRotated: false } };
const PHONE = { viewport: { value: 'iphone15', isRotated: false } };

export const AvisOrdinateur: Story = {
  name: 'Avis de retrait · ordinateur',
  parameters: { reference: `${PAGE}-avis-de-retrait-ordinateur` },
  globals: DESKTOP,
  render: () => <SalarieMailDesktop mail={NOTICE_MAIL} />,
};

export const AvisMobile: Story = {
  name: 'Avis de retrait · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}-avis-de-retrait-mobile`,
  },
  globals: PHONE,
  render: () => <SalarieMailMobile mail={NOTICE_MAIL} />,
};

export const CodeSeulMobile: Story = {
  name: 'Avis, code seul · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}-avis-code-seul-mobile`,
  },
  globals: PHONE,
  render: () => <SalarieMailMobile mail={CODE_ONLY_MAIL} />,
};

export const SansLogoMobile: Story = {
  name: 'Avis sans logo ni horaires · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}-avis-sans-logo-ni-horaires-mobile`,
  },
  globals: PHONE,
  render: () => <SalarieMailMobile mail={NO_LOGO_MAIL} />,
};

export const RelanceOrdinateur: Story = {
  name: 'Relance · ordinateur',
  parameters: { reference: `${PAGE}-relance-ordinateur` },
  globals: DESKTOP,
  render: () => <SalarieMailDesktop mail={REMINDER_MAIL} />,
};

export const RelanceMobile: Story = {
  name: 'Relance · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}-relance-mobile`,
  },
  globals: PHONE,
  render: () => <SalarieMailMobile mail={REMINDER_MAIL} />,
};
