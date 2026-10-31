import type { Meta, StoryObj } from '@storybook/react-vite';

import { CompanyShell, DeskPageHeader } from '#components/company-shell';
import {
  ACCOUNT,
  COMPANY,
  COMPANY_ADMIN_NAV,
  crumbs,
  DEPARTMENT_NAV,
  PLATFORM_NAV,
} from '#fixtures/multi-entreprises';

const meta = {
  title: 'Composants/CompanyShell',
  component: CompanyShell,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  args: {
    company: COMPANY.studio,
    nav: DEPARTMENT_NAV,
    active: 'colis',
    account: ACCOUNT.department,
    breadcrumb: crumbs('Studio', 'Colis'),
    searchPlaceholder: 'Nom, suivi, transporteur',
    children: <DeskPageHeader title="Colis" subtitle="Contenu de la page" />,
  },
} satisfies Meta<typeof CompanyShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Departement: Story = { name: 'Département' };

export const AdminEntreprise: Story = {
  name: 'Admin entreprise',
  args: {
    company: COMPANY.admin,
    nav: COMPANY_ADMIN_NAV,
    active: 'vue-d-ensemble',
    account: ACCOUNT.companyAdmin,
    breadcrumb: crumbs('Atelier Lumen', 'Vue d’ensemble'),
    searchPlaceholder: 'Rechercher',
  },
};

export const AdminApp: Story = {
  name: 'Admin de l’app',
  args: {
    company: COMPANY.platform,
    nav: PLATFORM_NAV,
    active: 'entreprises',
    account: ACCOUNT.platform,
    breadcrumb: crumbs('Plateforme', 'Entreprises'),
    searchPlaceholder: 'Rechercher une entreprise',
  },
};
