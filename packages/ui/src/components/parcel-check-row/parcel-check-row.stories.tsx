import type { Meta, StoryObj } from '@storybook/react-vite';

import { ParcelCheckRow } from '#components/parcel-check-row';

const meta = {
  title: 'Composants/ParcelCheckRow',
  component: ParcelCheckRow,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
  args: { title: 'Amazon ···4471', detail: 'Reçu aujourd’hui à 10 h 15' },
} satisfies Meta<typeof ParcelCheckRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Coche: Story = {};
export const Decoche: Story = { args: { checked: false } };
export const Recommande: Story = {
  args: {
    title: 'UPS ···8810',
    detail: 'Reçu hier, recommandé',
    detailTone: 'orange',
  },
};
