import type { Meta, StoryObj } from '@storybook/react-vite';

import { AlphabetIndex } from '#components/alphabet-index';
import { DIRECTORY_LETTERS } from '#fixtures/directory';

const meta = {
  title: 'Composants/AlphabetIndex',
  component: AlphabetIndex,
  args: { letters: DIRECTORY_LETTERS },
} satisfies Meta<typeof AlphabetIndex>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Annuaire: Story = {};

export const PeuDeLettres: Story = {
  name: 'Peu de lettres',
  args: { letters: ['A', 'C', 'H'] },
};
