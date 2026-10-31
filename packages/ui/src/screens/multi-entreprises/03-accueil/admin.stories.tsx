import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  EntreprisesDesktop,
  EntreprisesErreurDesktop,
  EntreprisesMobile,
} from '#screens/multi-entreprises/03-accueil/entreprises-screen';
import {
  NavetteTourneeMobile,
  TourScreen,
} from '#screens/multi-entreprises/03-accueil/navette-tournee-screen';
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
  parameters: {
    reference: `${page}admin-de-l-app-entreprises-erreur-ordinateur`,
  },
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
  parameters: {
    reference: `${page}admin-entreprise-vue-d-ensemble-ordinateur`,
  },
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

export const NavetteTourneeAPreparer: Story = {
  name: 'Navette · tournée, à préparer · mobile',
  parameters: { device: { tone: 'light' } },
  globals: mobile,
  render: () => (
    <TourScreen
      sync="offline"
      subtitle="0 département sur 2 déposés · 5 colis restent"
      progress={0}
      tasks={[
        {
          id: 'incomplete',
          icon: 'alert',
          title: '1 colis',
          line: 'À compléter avant de partir',
          onClick: () => undefined,
        },
        {
          id: 'dispatch',
          icon: 'package',
          title: '2 colis',
          line: 'Reçus, pas encore en route',
          action: { label: 'Mettre en route', onClick: () => undefined },
        },
      ]}
      stops={[
        {
          id: 'a',
          name: 'Studio',
          place: 'Bât. A, accueil',
          parcels: '3 colis',
        },
        {
          id: 'b',
          name: 'Finance',
          place: 'Bât. B, bureau 412',
          parcels: '2 colis',
        },
      ]}
      allParcels={{ label: 'Tous mes colis', onClick: () => undefined }}
    />
  ),
};

export const NavetteTourneeVide: Story = {
  name: 'Navette · tournée vide · mobile',
  parameters: { device: { tone: 'light' } },
  globals: mobile,
  render: () => (
    <TourScreen
      sync="synced"
      hero={{
        icon: 'scan',
        title: 'Rien à déposer',
        text: 'Scannez les colis reçus : ils se rangent ici par département.',
      }}
    />
  ),
};

export const NavetteTourneeClose: Story = {
  name: 'Navette · tournée close · mobile',
  parameters: { device: { tone: 'light' } },
  globals: mobile,
  render: () => (
    <TourScreen
      sync="synced"
      subtitle="4 départements sur 4 déposés"
      progress={1}
      hero={{
        icon: 'check',
        title: 'Tout est déposé',
        text: '18 colis, 4 dépôts confirmés. Les prochains colis apparaîtront ici après le scan.',
      }}
    />
  ),
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
