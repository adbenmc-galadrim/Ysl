import type { Meta, StoryObj } from '@storybook/react-vite';

import { CameraViewport, Viewfinder } from '#components/camera-viewport';
import { ParcelBox, ParcelLabel } from '#components/parcel-label';
import { SCANNED_LABEL } from '#fixtures/reception';

const parcel = (
  <ParcelBox>
    <ParcelLabel {...SCANNED_LABEL} />
  </ParcelBox>
);

const meta = {
  title: 'Composants/CameraViewport',
  component: CameraViewport,
  parameters: {
    layout: 'fullscreen',
    device: { tone: 'dark' },
    viewport: { defaultViewport: 'iphone15' },
  },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
  args: { subject: parcel },
} satisfies Meta<typeof CameraViewport>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Recherche: Story = { name: 'En recherche' };

/** The moment a label is read: green corners and the green veil. */
export const LectureConfirmee: Story = {
  name: 'Lecture confirmée',
  args: { frame: 'success', flash: true },
};

export const Doublon: Story = { args: { frame: 'warning' } };

/** Unreadable shot: red corners over a dimmed picture. */
export const Illisible: Story = { args: { frame: 'error', dim: 0.25 } };

/** No subject: the empty room, e.g. before a QR code is shown. */
export const SansSujet: Story = {
  name: 'Sans sujet',
  args: { subject: undefined },
};

export const Cadre: StoryObj<typeof Viewfinder> = {
  name: 'Viseur seul',
  parameters: { device: undefined, layout: 'centered' },
  render: () => (
    <div className="flex gap-4 bg-scene p-4">
      <Viewfinder />
      <Viewfinder tone="success" />
      <Viewfinder tone="warning" />
      <Viewfinder tone="error" />
    </div>
  ),
};
