import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  ACCOUNT,
  COMPANY,
  crumbs,
  DEPARTMENT_NAV,
  STUDIO_PARCELS,
} from '#fixtures/multi-entreprises';
import {
  DepartementColisDesktop,
  DepartementColisMobile,
} from '#screens/multi-entreprises/03-accueil/departement-colis-screen';

const meta = {
  title: 'Écrans/Multi-entreprises/03 Accueil/Département · Colis',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const PresentsOrdinateur: Story = {
  name: 'Présents · ordinateur',
  parameters: {
    reference:
      'multi-entreprises/03-accueil/accueil--departement-colis-presents-ordinateur',
  },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => (
    <DepartementColisDesktop
      company={COMPANY.studio}
      nav={DEPARTMENT_NAV}
      account={ACCOUNT.department}
      breadcrumb={crumbs('Studio', 'Colis')}
      searchPlaceholder="Nom, suivi, transporteur"
      subtitle="Studio · Bât. A, 2e étage, accueil"
      deposit={{
        title: 'Karim a posé 6 colis à 10:56',
        description: 'Comptez-les puis confirmez : les salariés seront prévenus.',
        action: 'Confirmer le dépôt',
      }}
      tabs={[
        { id: 'a-venir', label: 'À venir 6' },
        { id: 'presents', label: 'Présents 12' },
        { id: 'historique', label: 'Historique' },
      ]}
      activeTab="presents"
      onHandover={() => undefined}
      filters={[
        {
          label: 'Statut',
          value: 'Tous',
          choices: [{ value: 'all', label: 'Tous' }],
          selected: 'all',
          onSelect: () => undefined,
          className: 'w-[170px]',
        },
        {
          label: 'Arrivé',
          value: 'Cette semaine',
          choices: [{ value: 'week', label: 'Cette semaine' }],
          selected: 'week',
          onSelect: () => undefined,
          className: 'w-[170px]',
        },
      ]}
      label="Colis présents"
      parcels={STUDIO_PARCELS}
      range="1–5 sur 12"
      activeParcel="camille"
      panel={{
        recipient: 'Camille Morel',
        place: 'Studio · poste 214',
        details: [
          { label: 'Suivi', value: '1Z E63 44W 04 9923 0622' },
          { label: 'Arrivé', value: '10:56, dépôt de Karim' },
          { label: 'E-mail', value: 'Délivré à 10:58' },
        ],
        remindLabel: 'Relancer',
        onRemind: () => undefined,
        openLabel: 'Ouvrir la fiche',
      }}
    />
  ),
};

export const DepartementMobile: Story = {
  name: 'Département · mobile',
  parameters: {
    device: { tone: 'light' },
    reference:
      'multi-entreprises/03-accueil/accueil--departement-colis-departement-mobile',
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  render: () => <DepartementColisMobile />,
};
