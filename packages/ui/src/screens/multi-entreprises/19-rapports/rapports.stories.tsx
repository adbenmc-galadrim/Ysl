import type { Meta, StoryObj } from '@storybook/react-vite';

import { CompanyShell } from '#components/company-shell';
import { ACCOUNT, COMPANY, COMPANY_ADMIN_NAV, crumbs } from '#fixtures/multi-entreprises';
import {
  RapportsDepartementMobile,
  RapportsDesktop,
  RapportsMobile,
  type ReportDay,
  type ReportLine,
} from '#screens/multi-entreprises/19-rapports/rapports-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/19 Rapports/Admin entreprise · Rapports',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const LINES: ReportLine[] = [
  { id: 'studio', name: 'Studio', received: '548', handed: '532', delay: '1,2 j', reminders: '61', gaps: '2', proof: 'QR code' },
  { id: 'finance', name: 'Finance', received: '402', handed: '391', delay: '1,6 j', reminders: '74', gaps: '1', proof: 'Code' },
  { id: 'juridique', name: 'Juridique', received: '334', handed: '318', delay: '2,4 j', reminders: '96', gaps: '1', proof: 'Signature' },
];

const FIGURES = { received: '1 284', handed: '1 241', delay: '1,4 j', late: '9', gaps: '4' };

const DAILY: Record<number, number> = {
  0: 98.8, 1: 135.2, 2: 158.6, 3: 114.4, 4: 182,
  7: 127.4, 8: 150.8, 9: 171.6, 10: 106.6, 11: 189.8,
  14: 143, 15: 122.2, 16: 161.2, 17: 153.4, 18: 176.8,
  21: 132.6, 22: 166.4, 23: 148.2, 24: 156, 25: 187.2,
  28: 124.8,
};

const DAYS: ReportDay[] = Array.from({ length: 29 }, (_, day) => {
  const total = DAILY[day] ?? 0;
  return { label: `${day + 1} octobre`, values: [total * 0.45, total * 0.3, total * 0.25] };
});

const PERIODS = [
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'quarter', label: 'Trimestre' },
];

const noop = () => {};

const COMMON = {
  periods: PERIODS,
  period: 'month',
  periodLabel: 'Octobre 2026',
  figures: FIGURES,
  lines: LINES,
  onPeriod: noop,
  onPrint: noop,
  onExport: noop,
};

export const RapportsOrdinateur: Story = {
  name: 'Rapports · ordinateur',
  parameters: {
    reference: 'multi-entreprises/19-rapports/rapports--admin-entreprise-rapports-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => (
    <CompanyShell
      company={COMPANY.admin}
      nav={COMPANY_ADMIN_NAV}
      active="rapports"
      account={ACCOUNT.companyAdmin}
      breadcrumb={crumbs('Atelier Lumen', 'Rapports')}
    >
      <RapportsDesktop
        {...COMMON}
        subtitle="Octobre 2026 · tous les départements"
        chartSubtitle="Studio, Finance, Juridique"
        days={DAYS}
        departments={[{ value: 'all', label: 'Tous' }]}
        department="all"
        departmentLabel="Tous"
        onDepartment={noop}
      />
    </CompanyShell>
  ),
};

export const PhoneRapports: Story = {
  name: 'Rapports · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/19-rapports/rapports--admin-entreprise-rapports-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <RapportsMobile {...COMMON} onOpenLine={noop} onBack={noop} />,
};

export const UnDepartementMobile: Story = {
  name: 'Un département · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/19-rapports/rapports--admin-entreprise-rapports-un-departement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => (
    <RapportsDepartementMobile
      name="Studio"
      periodLabel="Octobre 2026"
      figures={{ received: '548', handed: '532', delay: '1,2 j', late: '2', gaps: '2' }}
      lastDays={[93.33, 127.27, 110.3, 76.36, 131.52, 84.85, 114.55, 106.06, 123.03, 140]}
      onBack={noop}
    />
  ),
};
