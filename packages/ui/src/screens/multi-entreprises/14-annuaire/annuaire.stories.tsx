import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  AdminAnnuaireDeplacerDesktop,
  AdminImportCsvDesktop,
  DepartementAnnuaireDesktop,
} from '#screens/multi-entreprises/14-annuaire/annuaire-desktop-screen';
import {
  AdminAnnuaireMobile,
  AdminDeplacerMobile,
  DepartementAjouterDejaAilleursMobile,
  DepartementAjouterMobile,
  DepartementAnnuaireMobile,
} from '#screens/multi-entreprises/14-annuaire/annuaire-mobile-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/14 Annuaire/Annuaire',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const DESKTOP = { viewport: { value: 'landingDesktop', isRotated: false } };
const MOBILE = { viewport: { value: 'iphone15', isRotated: false } };
const PAGE = 'multi-entreprises/14-annuaire/annuaire--';

export const DepartementOrdinateur: Story = {
  name: 'Département · ordinateur',
  parameters: {
    reference: `${PAGE}departement-annuaire-du-departement-ordinateur`,
  },
  globals: DESKTOP,
  render: () => <DepartementAnnuaireDesktop />,
};

export const DepartementMobile: Story = {
  name: 'Département · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}departement-annuaire-du-departement-mobile`,
  },
  globals: MOBILE,
  render: () => <DepartementAnnuaireMobile />,
};

export const AjouterMobile: Story = {
  name: 'Ajouter un salarié · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}departement-ajouter-un-salarie-mobile`,
  },
  globals: MOBILE,
  render: () => <DepartementAjouterMobile />,
};

export const AjouterDejaAilleursMobile: Story = {
  name: 'Ajouter, déjà ailleurs · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}departement-ajouter-deja-ailleurs-mobile`,
  },
  globals: MOBILE,
  render: () => <DepartementAjouterDejaAilleursMobile />,
};

export const AdminDeplacerOrdinateur: Story = {
  name: 'Admin, déplacer un salarié · ordinateur',
  parameters: {
    reference: `${PAGE}admin-entreprise-annuaire-deplacer-un-salarie-ordinateur`,
  },
  globals: DESKTOP,
  render: () => <AdminAnnuaireDeplacerDesktop />,
};

export const AdminImportOrdinateur: Story = {
  name: 'Admin, import CSV · ordinateur',
  parameters: {
    reference: `${PAGE}admin-entreprise-import-csv-verification-ordinateur`,
  },
  globals: DESKTOP,
  render: () => <AdminImportCsvDesktop />,
};

export const AdminMobile: Story = {
  name: 'Admin, annuaire · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}admin-entreprise-annuaire-mobile`,
  },
  globals: MOBILE,
  render: () => <AdminAnnuaireMobile />,
};

export const AdminDeplacerSheetMobile: Story = {
  name: 'Admin, déplacer un salarié · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: `${PAGE}admin-entreprise-deplacer-un-salarie-mobile`,
  },
  globals: MOBILE,
  render: () => <AdminDeplacerMobile />,
};
