import type { Meta, StoryObj } from '@storybook/react-vite';

import { AppBrand, AppMark } from '#components/app-mark';

const meta = {
  title: 'Composants/AppMark',
  component: AppMark,
  parameters: { layout: 'centered' },
  args: { size: 64 },
} satisfies Meta<typeof AppMark>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SurFond: Story = {
  name: 'Sur fond',
  decorators: [
    (Story) => (
      <div className="bg-fill p-5">
        <Story />
      </div>
    ),
  ],
};

export const SurPageBlanche: Story = {
  name: 'Sur page blanche',
  args: { edge: 'outline' },
};

export const SurUnQr: Story = {
  name: 'Sur un QR',
  args: { edge: 'halo' },
  decorators: [
    (Story) => (
      <div className="bg-black p-5">
        <Story />
      </div>
    ),
  ],
};

export const Marque: Story = {
  render: () => (
    <div className="flex flex-col gap-6 text-site-ink">
      <AppBrand size="nav" name="Courrier" />
      <AppBrand size="footer" name="Courrier" />
    </div>
  ),
};
