import type { Meta, StoryObj } from '@storybook/react-vite';

import { PhotoViewer } from '#components/photo-viewer';
import { LABEL_PHOTO_URL } from '#fixtures/label-photo';

const meta = {
  title: 'Composants/PhotoViewer',
  component: PhotoViewer,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof PhotoViewer>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  name: 'Par défaut',
  args: {
    src: LABEL_PHOTO_URL,
    alt: 'Photo de l’étiquette',
    onClose: () => {},
  },
};
