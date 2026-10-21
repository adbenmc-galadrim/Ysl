import type { Meta, StoryObj } from '@storybook/react-vite';

import { StepCard } from '#components/step-card';

const meta = {
  title: 'Composants/StepCard',
  component: StepCard,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StepCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Partager: Story = {
  args: { icon: 'share', title: '1. Touchez Partager', hint: 'en bas de Safari' },
};

export const TitreLong: Story = {
  args: {
    icon: 'plusSquare',
    title: '2. Choisissez « Sur l’écran d’accueil »',
    hint: 'puis touchez Ajouter',
  },
};
