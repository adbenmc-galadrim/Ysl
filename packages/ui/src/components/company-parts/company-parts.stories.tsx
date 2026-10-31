import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  CompanyLogo,
  CompanyPill,
  CompanySettingsDesk,
  DeskAuthPage,
} from '#components/company-parts';
import { companySettingsShell } from '#fixtures/multi-entreprises';

const meta = {
  title: 'Composants/CompanyParts',
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Logos: Story = {
  name: 'Logos et pastilles',
  render: () => (
    <div className="flex items-center gap-3">
      <CompanyLogo initials="AL" size={24} />
      <CompanyLogo initials="AL" size={40} />
      <CompanyLogo initials="NV" size={56} muted />
      <CompanyPill tone="green" label="Active" />
      <CompanyPill tone="blue" label="Invitation envoyée" />
      <CompanyPill tone="orange" label="Suspendue" />
    </div>
  ),
};

export const Reglages: Story = {
  name: 'Réglages de l’entreprise',
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => (
    <CompanySettingsDesk tab="identity" shell={companySettingsShell('Identité et e-mails')}>
      <p className="mt-6 text-13">Contenu de l’onglet</p>
    </CompanySettingsDesk>
  ),
};

export const Connexion: Story = {
  name: 'Page de connexion',
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'landingDesktop', isRotated: false } },
  render: () => (
    <DeskAuthPage logo="AL" brand="Atelier Lumen" product="Courrier" footer="Besoin d’aide ?">
      <p className="text-13">Formulaire</p>
    </DeskAuthPage>
  ),
};
