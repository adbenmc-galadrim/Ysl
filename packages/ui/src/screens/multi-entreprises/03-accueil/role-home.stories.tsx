import type { Meta, StoryObj } from '@storybook/react-vite';

import { CompanySuspendedScreen } from '#screens/multi-entreprises/03-accueil/company-suspended-screen';
import { CompanyShell } from '#components/company-shell';
import { ACCOUNT, COMPANY } from '#fixtures/multi-entreprises';
import {
  RoleHomeDesktop,
  RoleHomeMobile,
  type RoleHomeProps,
} from '#screens/multi-entreprises/03-accueil/role-home-screen';

/** No mockup: the honest wait of each role until its own space is delivered. */
const meta = {
  title: 'Écrans/Multi-entreprises/03 Accueil/En attente',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const desktop = { viewport: { value: 'landingDesktop', isRotated: false } };
const mobile = { viewport: { value: 'iphone15', isRotated: false } };

const SPACE: RoleHomeProps = {
  title: 'À venir et présents',
  subtitle: 'Studio',
  stats: [{ label: 'Présents', value: '12' }],
  notice: {
    title: 'Les colis à venir arrivent avec la tournée',
    description: 'Vos colis présents restent dans Colis.',
  },
  action: { label: 'Voir les colis', onPress: () => undefined },
};

export const DepartementOrdinateur: Story = {
  name: 'Département · ordinateur',
  globals: desktop,
  render: () => (
    <CompanyShell
      company={COMPANY.studio}
      nav={[]}
      account={ACCOUNT.department}
      breadcrumb={['Studio', 'Accueil']}
    >
      <RoleHomeDesktop {...SPACE} />
    </CompanyShell>
  ),
};

export const DepartementTelephone: Story = {
  name: 'Département · mobile',
  parameters: { device: { tone: 'light' } },
  globals: mobile,
  render: () => <RoleHomeMobile {...SPACE} />,
};

export const EntrepriseSuspendue: Story = {
  name: 'Entreprise suspendue',
  globals: mobile,
  render: () => (
    <CompanySuspendedScreen
      title="Votre entreprise est suspendue"
      description="La connexion et la synchronisation sont arrêtées. Vos colis, photos et preuves restent sur ce téléphone : rien n’est effacé. Tout repartira quand l’entreprise sera réactivée."
      pending="Modifications en attente sur ce téléphone : 3"
      retryLabel="Vérifier à nouveau"
    />
  ),
};
