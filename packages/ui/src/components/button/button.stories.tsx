import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';

const meta = {
  title: 'Composants/Button',
  component: Button,
  args: { children: 'Notifier maintenant' },
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Principal: Story = {};

export const AvecIcone: Story = {
  name: 'Avec icône',
  args: { icon: 'scan', children: 'Scanner', className: 'w-[145px]' },
};

export const Secondaire: Story = {
  args: { variant: 'secondary', icon: 'trash', iconSize: 20, children: 'Supprimer' },
};

export const Tailles: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="lg">Remettre</Button>
      <Button size="md">Remettre</Button>
      <Button size="sm">Remettre</Button>
      <Button size="xs">Notifier</Button>
    </div>
  ),
};

export const Teintes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <Button size="xs" variant="danger">Choisir</Button>
      <Button size="xs" variant="warning">Relancer</Button>
      <Button size="xs" variant="success">Remis</Button>
      <Button size="xs" variant="info">Voir</Button>
      <Button size="xs" variant="outline">Annuler</Button>
      <Button variant="link">Voir les colis remis</Button>
    </div>
  ),
};

export const Desactive: Story = {
  name: 'Désactivé',
  args: { disabled: true },
};
