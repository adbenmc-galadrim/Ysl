import type { Meta, StoryObj } from '@storybook/react-vite';

import {
  DeskChoice,
  DeskField,
  DeskFormRow,
  DeskInput,
  DeskPanelField,
  DeskSectionTitle,
  DeskSelect,
} from '#components/desk-form';

const meta = {
  title: 'Composants/DeskForm',
  decorators: [
    (Story) => (
      <div className="flex w-[720px] flex-col gap-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Ligne: Story = {
  name: 'Ligne de formulaire',
  render: () => (
    <>
      <DeskSectionTitle title="Identité" description="Ce que voient les salariés" />
      <DeskFormRow label="Nom" hint="Affiché dans les e-mails">
        <DeskInput label="Nom" defaultValue="Atelier Lumen" />
      </DeskFormRow>
      <DeskFormRow label="Signature">
        <DeskChoice options={['Désactivée', 'Facultative', 'Obligatoire']} value="Facultative" />
      </DeskFormRow>
    </>
  ),
};

export const Champs: Story = {
  render: () => (
    <>
      <DeskField label="E-mail" type="email" value="julie@atelier-lumen.fr" focused />
      <DeskField label="Mot de passe" type="password" value="motdepasse12" />
      <DeskPanelField label="Lieu" value="2e étage" />
      <DeskPanelField label="E-mail" value="hugo@" invalid />
    </>
  ),
};

export const Filtre: Story = {
  render: () => <DeskSelect icon="building" label="Entreprise" value="Toutes" className="w-[220px]" />,
};
