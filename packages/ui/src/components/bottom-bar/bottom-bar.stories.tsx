import type { Meta, StoryObj } from '@storybook/react-vite';

import { BottomBar } from '#components/bottom-bar';
import { Button } from '#components/button';
import { SearchTrigger } from '#components/search-field';

const meta = {
  title: 'Composants/BottomBar',
  component: BottomBar,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div className="flex h-[300px] w-[393px] flex-col justify-end bg-fill">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BottomBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Fondu: Story = {
  args: {
    surface: 'fade',
    children: (
      <>
        <SearchTrigger />
        <Button icon="scan" className="w-[145px]">
          Scanner
        </Button>
      </>
    ),
  },
};

export const Filet: Story = {
  args: {
    surface: 'line',
    children: (
      <>
        <Button variant="secondary" icon="bell" iconSize={20} className="w-[134px]">
          Relancer
        </Button>
        <Button className="min-w-0 flex-1">Remettre 3 colis</Button>
      </>
    ),
  },
};
