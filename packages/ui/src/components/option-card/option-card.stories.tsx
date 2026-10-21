import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { OptionCard, OptionCardGroup } from '#components/option-card';

const meta = {
  title: 'Composants/OptionCard',
  component: OptionCard,
  decorators: [(Story) => <div className="w-[353px]"><Story /></div>],
  args: {
    icon: 'mail',
    title: 'Ajouter son e-mail',
    description: 'Il recevra le QR code et le code',
  },
} satisfies Meta<typeof OptionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Choisie: Story = { args: { selected: true } };

export const NonChoisie: Story = { name: 'Non choisie' };

export const Groupe: Story = {
  render: () => {
    const [way, setWay] = useState('email');
    return (
      <OptionCardGroup label="Comment le prévenir ?">
        <OptionCard
          icon="mail"
          title="Ajouter son e-mail"
          description="Il recevra le QR code et le code"
          selected={way === 'email'}
          onClick={() => setWay('email')}
        />
        <OptionCard
          icon="users"
          title="Prévenir un contact"
          description="Par exemple l’assistante du service"
          selected={way === 'contact'}
          onClick={() => setWay('contact')}
        />
        <OptionCard
          icon="info"
          title="Le prévenir de vive voix"
          description="Le colis reste à notifier jusqu’au retrait"
          selected={way === 'voice'}
          onClick={() => setWay('voice')}
        />
      </OptionCardGroup>
    );
  },
};
