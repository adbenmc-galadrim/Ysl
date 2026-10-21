import type { Meta, StoryObj } from '@storybook/react-vite';

import { CodeInput } from '#components/code-input';

const meta = {
  title: 'Composants/CodeInput',
  component: CodeInput,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof CodeInput>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Vide: Story = { args: { value: '' } };
export const EnCours: Story = { args: { value: '482' } };
export const Complet: Story = { args: { value: '4821' } };
export const Erreur: Story = { args: { value: '4829', invalid: true } };
export const SixChiffres: Story = { args: { value: '12', length: 6 } };
