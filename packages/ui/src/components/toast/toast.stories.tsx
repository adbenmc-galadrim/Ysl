import type { Meta, StoryObj } from '@storybook/react-vite';

import { Toast } from '#components/toast';

const meta = {
  title: 'Composants/Toast',
  component: Toast,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AvecAction: Story = {
  name: 'Avec action',
  args: { message: 'Nouvelle version disponible', actionLabel: 'Mettre à jour' },
};

export const SansAction: Story = {
  name: 'Sans action',
  args: { message: 'Colis remis à Inès Garnier' },
};
