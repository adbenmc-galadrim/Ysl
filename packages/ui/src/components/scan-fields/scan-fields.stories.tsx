import type { Meta, StoryObj } from '@storybook/react-vite';

import { ScanFields } from '#components/scan-fields';

const meta = {
  title: 'Composants/ScanFields',
  component: ScanFields,
  parameters: { layout: 'padded' },
  args: {
    fields: [
      { label: 'Transporteur', value: 'Colissimo' },
      { label: 'Suivi', value: '8J 02299 07975 0', mono: true },
      { label: 'Destinataire', value: 'L. Fontain ?', status: 'warning' },
      { label: 'Expéditeur', value: 'Illisible', status: 'error' },
    ],
  },
} satisfies Meta<typeof ScanFields>;

export default meta;

type Story = StoryObj<typeof meta>;

/** On a white screen: the parcel check. */
export const Clair: Story = { args: { tone: 'light' } };

/** Over the camera, inside a `CameraPanel`. */
export const Sombre: Story = {
  args: { tone: 'dark' },
  decorators: [
    (Story) => (
      <div className="w-[361px] rounded-card bg-night p-4">
        <Story />
      </div>
    ),
  ],
};
