import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ACCOUNT,
  COMPANY,
  crumbs,
  DEPARTMENT_NAV,
} from '#fixtures/multi-entreprises';
import {
  FicheColisMobile,
  HistoriqueDesktop,
  HistoriqueMobile,
  RechercheMobile,
  SelectionMobile,
} from '#screens/multi-entreprises/10-colis/departement-colis-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/10 Colis/Département',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const phone = { viewport: { value: 'iphone15', isRotated: false } };

export const HistoriqueOrdinateur: Story = {
  name: 'Historique · ordinateur',
  parameters: {
    reference: 'multi-entreprises/10-colis/colis--departement-colis-historique-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => (
    <HistoriqueDesktop
      company={COMPANY.studio}
      nav={DEPARTMENT_NAV}
      account={ACCOUNT.department}
      breadcrumb={crumbs('Studio', 'Colis', 'Historique')}
      subtitle="Studio · Bât. A, 2e étage, accueil"
      tabs={[
        { id: 'a-venir', label: 'À venir 6' },
        { id: 'presents', label: 'Présents 12' },
        { id: 'historique', label: 'Historique' },
      ]}
      activeTab="historique"
      onHandover={() => undefined}
      filters={[
        {
          label: 'Période',
          value: '30 derniers jours',
          choices: [{ value: '30', label: '30 derniers jours' }],
          selected: '30',
          onSelect: () => undefined,
          className: 'w-[190px]',
        },
        {
          label: 'Preuve',
          value: 'Toutes',
          choices: [{ value: 'all', label: 'Toutes' }],
          selected: 'all',
          onSelect: () => undefined,
          className: 'w-[150px]',
        },
      ]}
      rows={[
        { id: 'malik', recipient: 'Malik Benali', tone: 'green', status: 'Remis', to: 'Malik Benali', proof: { icon: 'qr', label: 'QR code' }, by: 'Julie Perrin', when: 'Aujourd’hui, 11:05' },
        { id: 'axelle', recipient: 'Axelle Bernard', tone: 'green', status: 'Remis', to: 'Axelle Bernard', proof: { icon: 'hash', label: 'Code' }, by: 'Thomas Moreau', when: 'Aujourd’hui, 9:58' },
        { id: 'romain', recipient: 'Romain Garnier', tone: 'green', status: 'Remis', to: 'Lucie Hamel (collègue)', proof: { icon: 'sign', label: 'Signature' }, by: 'Julie Perrin', when: 'Hier, 17:12' },
        { id: 'paul', recipient: 'Paul Roy', tone: 'green', status: 'Remis', to: 'Paul Roy', proof: { icon: 'qr', label: 'QR code' }, by: 'Julie Perrin', when: 'Hier, 16:40' },
        { id: 'clara', recipient: 'Clara Sennet', tone: 'red', status: 'À régulariser', to: '—', by: 'Karim Daoud', when: 'Lun., 10:58' },
        { id: 'yves', recipient: 'Yves Morin', tone: 'grey', status: 'Retourné', to: 'Transporteur', by: 'Julie Perrin', when: 'Ven., 15:00' },
      ]}
      range="1–6 sur 214"
    />
  ),
};

export const Historique: Story = {
  name: 'Historique · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/10-colis/colis--departement-colis-historique-mobile',
  },
  globals: phone,
  render: () => (
    <HistoriqueMobile
      title="Historique"
      days={[
        {
          title: 'Aujourd’hui',
          rows: [
            { id: 'malik', title: 'Malik Benali', line: 'QR code · par Julie' },
            { id: 'axelle', title: 'Axelle Bernard', line: 'Code · par Thomas' },
          ],
        },
        {
          title: 'Hier',
          rows: [
            { id: 'romain', title: 'Romain Garnier', line: 'Retiré par Lucie Hamel · signature' },
            { id: 'paul', title: 'Paul Roy', line: 'QR code · par Julie' },
          ],
        },
      ]}
    />
  ),
};

export const Fiche: Story = {
  name: 'Fiche colis · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/10-colis/colis--departement-fiche-colis-mobile',
  },
  globals: phone,
  render: () => <FicheColisMobile />,
};

export const Recherche: Story = {
  name: 'Recherche · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/10-colis/colis--departement-recherche-mobile',
  },
  globals: phone,
  render: () => <RechercheMobile />,
};

export const Selection: Story = {
  name: 'Sélection · mobile',
  parameters: {
    device: { tone: 'light' },
    reference: 'multi-entreprises/10-colis/colis--departement-selection-mobile',
  },
  globals: phone,
  render: () => <SelectionMobile />,
};
