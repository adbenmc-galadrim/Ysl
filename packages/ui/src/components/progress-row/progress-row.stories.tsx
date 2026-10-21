import type { Meta, StoryObj } from '@storybook/react-vite';

import { IconTile } from '#components/icon-tile';
import { ProgressRow } from '#components/progress-row';
import { Icon } from '#icons';

const meta = {
  title: 'Composants/ProgressRow',
  component: ProgressRow,
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <div className="w-[353px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProgressRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EnCours: Story = {
  args: {
    leading: <IconTile icon="scan" />,
    title: 'Lecture des étiquettes',
    subtitle: '18 Mo sur 42 Mo',
    trailing: <span className="text-15 font-semibold">43 %</span>,
    value: 0.43,
  },
};

export const Termine: Story = {
  args: {
    leading: <IconTile icon="users" tone="green" />,
    title: 'Annuaire',
    subtitle: '312 personnes',
    trailing: <Icon name="check" size={22} className="text-green" />,
    value: 1,
    tone: 'green',
  },
};

export const EnPause: Story = {
  args: {
    leading: <IconTile icon="scan" tone="orange" />,
    title: 'Lecture des étiquettes',
    subtitle: '18 Mo sur 42 Mo, en pause',
    subtitleTone: 'orange',
    trailing: <Icon name="wifiOff" size={20} className="text-orange" />,
    value: 0.43,
    tone: 'orange',
  },
};
