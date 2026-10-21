import type { Meta, StoryObj } from '@storybook/react-vite';

import { ContactRow } from '#components/contact-row';

const meta = {
  title: 'Composants/ContactRow',
  component: ContactRow,
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
  args: { name: 'Axelle Bernard', initials: 'AB', detail: 'Presse' },
} satisfies Meta<typeof ContactRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Personne: Story = {};

export const AvecSeparateur: Story = {
  name: 'Avec séparateur',
  args: { separator: true },
};

export const NomLong: Story = {
  name: 'Nom long',
  args: {
    name: 'Marie-Charlotte de La Rochefoucauld',
    initials: 'MR',
    detail: 'Ressources humaines, relations sociales',
  },
};
