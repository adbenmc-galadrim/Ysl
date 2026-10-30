import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  EntreprisesDesktop,
  EntreprisesErreurDesktop,
  EntreprisesMobile,
} from '#screens/multi-entreprises/03-accueil/entreprises-screen';
import { NavetteTourneeMobile } from '#screens/multi-entreprises/03-accueil/navette-tournee-screen';
import {
  VueDEnsembleDesktop,
  VueDEnsembleMobile,
} from '#screens/multi-entreprises/03-accueil/vue-d-ensemble-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/03 Accueil/Admin et navette',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'landingDesktop', isRotated: false } };
const mobile = { viewport: { value: 'iphone15', isRotated: false } };
const page = 'multi-entreprises/03-accueil/accueil--';

export const EntreprisesOrdinateur: Story = {
  name: 'Entreprises · ordinateur',
  parameters: { reference: `${page}admin-de-l-app-entreprises-ordinateur` },
  globals: desktop,
  render: () => <EntreprisesDesktop />,
};

export const EntreprisesErreurOrdinateur: Story = {
  name: 'Entreprises · erreur · ordinateur',
  parameters: { reference: `${page}admin-de-l-app-entreprises-erreur-ordinateur` },
  globals: desktop,
  render: () => <EntreprisesErreurDesktop />,
};

export const EntreprisesTelephone: Story = {
  name: 'Entreprises · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${page}admin-de-l-app-entreprises-mobile`,
  },
  globals: mobile,
  render: () => <EntreprisesMobile />,
};

export const VueDEnsembleOrdinateur: Story = {
  name: 'Vue d’ensemble · ordinateur',
  parameters: { reference: `${page}admin-entreprise-vue-d-ensemble-ordinateur` },
  globals: desktop,
  render: () => <VueDEnsembleDesktop />,
};

export const VueDEnsembleTelephone: Story = {
  name: 'Vue d’ensemble · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${page}admin-entreprise-vue-d-ensemble-mobile`,
  },
  globals: mobile,
  render: () => <VueDEnsembleMobile />,
};

export const NavetteTournee: Story = {
  name: 'Navette · tournée · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${page}navette-tournee-accueil-mobile`,
  },
  globals: mobile,
  render: () => <NavetteTourneeMobile />,
};
