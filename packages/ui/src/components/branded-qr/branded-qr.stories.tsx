import type { Meta, StoryObj } from '@storybook/react-vite';

import { BrandedQr } from '#components/branded-qr';

const APP_URL = 'https://ysl.shinseo.fr';

/** A stand-in for the app mark: the kraft parcel and its label. */
function Mark() {
  return (
    <svg viewBox="0 0 100 100" className="size-full rounded-[24%] bg-white">
      <rect
        x="19"
        y="27"
        width="62"
        height="50"
        rx="6"
        className="fill-kraft"
      />
      <rect x="19" y="36" width="62" height="7" className="fill-kraft-light" />
      <rect
        x="45.03"
        y="48"
        width="28.53"
        height="20"
        rx="2"
        className="fill-paper"
      />
    </svg>
  );
}

const meta = {
  title: 'Composants/BrandedQr',
  component: BrandedQr,
  parameters: { layout: 'centered', backgrounds: { value: 'light' } },
  args: {
    value: APP_URL,
    size: 200,
    label: `Ouvrir ${APP_URL}`,
    logo: <Mark />,
  },
  decorators: [
    (Story) => (
      <div className="bg-fill p-5">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrandedQr>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Installation: Story = {};

export const SansLogo: Story = { name: 'Sans logo', args: { logo: undefined } };

export const Tailles: Story = {
  render: (args) => (
    <div className="flex items-end gap-5">
      <BrandedQr {...args} size={120} radius={14} />
      <BrandedQr {...args} size={140} radius={14} />
      <BrandedQr {...args} size={200} />
    </div>
  ),
};
