import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ColisEnSouffranceMobile,
  CorrigerAdresseMobile,
  DestinataireSansEmailMobile,
  ReponsesSalariesMobile,
  SENT_MAILS,
  SuiviEmailsDesktop,
  SuiviEmailsMobile,
} from '#screens/multi-entreprises/12-suivi-des-e-mails/suivi-e-mails-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/12 Suivi des e-mails/Département · Suivi',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const PAGE = 'multi-entreprises/12-suivi-des-e-mails/suivi-e-mails--departement';
const PHONE = { viewport: { value: 'iphone15', isRotated: false } };

export const SuiviOrdinateur: Story = {
  name: 'Suivi des e-mails · ordinateur',
  parameters: { reference: `${PAGE}-suivi-des-e-mails-ordinateur` },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <SuiviEmailsDesktop mails={SENT_MAILS} />,
};

export const SuiviMobile: Story = {
  name: 'Suivi des e-mails · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}-suivi-des-e-mails-mobile`,
  },
  globals: PHONE,
  render: () => <SuiviEmailsMobile mails={SENT_MAILS} />,
};

export const EnSouffranceMobile: Story = {
  name: 'Colis en souffrance · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}-colis-en-souffrance-mobile`,
  },
  globals: PHONE,
  render: () => <ColisEnSouffranceMobile />,
};

export const CorrigerMobile: Story = {
  name: 'Corriger l’adresse · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}-corriger-l-adresse-mobile`,
  },
  globals: PHONE,
  render: () => <CorrigerAdresseMobile />,
};

export const SansEmailMobile: Story = {
  name: 'Destinataire sans e-mail · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}-destinataire-sans-e-mail-mobile`,
  },
  globals: PHONE,
  render: () => <DestinataireSansEmailMobile />,
};

export const ReponsesMobile: Story = {
  name: 'Réponses des salariés · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}-reponses-des-salaries-mobile`,
  },
  globals: PHONE,
  render: () => <ReponsesSalariesMobile />,
};
