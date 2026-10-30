import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  AnnuaireChargementMobile,
  AnnuaireErreurDesktop,
  AnnuaireErreurMobile,
  AnnuaireHorsLigneMobile,
  AnnuaireVideDesktop,
  ComptesErreurMobile,
  ComptesHorsLigneMobile,
  ComptesVideMobile,
  DepartementsVideMobile,
  FonctionnementHorsLigneMobile,
  RapportsVideMobile,
  VueChargementMobile,
  VueErreurDesktop,
  VueErreurMobile,
  VueNouvelleEntrepriseDesktop,
} from '#screens/multi-entreprises/21-etats/admin-entreprise-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/21 États/Admin entreprise',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const AnnuaireChargementTelephone: Story = {
  name: 'Annuaire, chargement · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-annuaire-chargement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <AnnuaireChargementMobile />,
};

export const AnnuaireErreurTelephone: Story = {
  name: 'Annuaire, erreur · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-annuaire-erreur-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <AnnuaireErreurMobile />,
};

export const AnnuaireErreurOrdinateur: Story = {
  name: 'Annuaire, erreur · ordinateur',
  parameters: {
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-annuaire-erreur-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <AnnuaireErreurDesktop />,
};

export const AnnuaireHorsLigneTelephone: Story = {
  name: 'Annuaire, hors ligne · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-annuaire-hors-ligne-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <AnnuaireHorsLigneMobile />,
};

export const AnnuaireVideOrdinateur: Story = {
  name: 'Annuaire, vide · ordinateur',
  parameters: {
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-annuaire-vide-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <AnnuaireVideDesktop />,
};

export const ComptesErreurTelephone: Story = {
  name: 'Comptes, erreur · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-comptes-erreur-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ComptesErreurMobile />,
};

export const ComptesHorsLigneTelephone: Story = {
  name: 'Comptes, hors ligne · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-comptes-hors-ligne-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ComptesHorsLigneMobile />,
};

export const ComptesVideTelephone: Story = {
  name: 'Comptes, vide · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-comptes-vide-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <ComptesVideMobile />,
};

export const DepartementsVideTelephone: Story = {
  name: 'Départements, vide · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-departements-vide-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <DepartementsVideMobile />,
};

export const FonctionnementHorsLigneTelephone: Story = {
  name: 'Fonctionnement, hors ligne · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-fonctionnement-hors-ligne-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <FonctionnementHorsLigneMobile />,
};

export const RapportsVideTelephone: Story = {
  name: 'Rapports, vide · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-rapports-vide-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <RapportsVideMobile />,
};

export const VueChargementTelephone: Story = {
  name: 'Vue d’ensemble, chargement · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-vue-d-ensemble-chargement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <VueChargementMobile />,
};

export const VueErreurTelephone: Story = {
  name: 'Vue d’ensemble, erreur · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-vue-d-ensemble-erreur-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <VueErreurMobile />,
};

export const VueErreurOrdinateur: Story = {
  name: 'Vue d’ensemble, erreur · ordinateur',
  parameters: {
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-vue-d-ensemble-erreur-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <VueErreurDesktop />,
};

export const VueNouvelleEntrepriseOrdinateur: Story = {
  name: 'Vue d’ensemble, nouvelle entreprise · ordinateur',
  parameters: {
    reference: 'multi-entreprises/21-etats/etats--admin-entreprise-vue-d-ensemble-nouvelle-entreprise-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => <VueNouvelleEntrepriseDesktop />,
};
