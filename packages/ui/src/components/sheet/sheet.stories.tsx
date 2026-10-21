import type { Meta, StoryObj } from '@storybook/react-vite';

import { Button } from '#components/button';
import { Sheet } from '#components/sheet';

const meta = {
  title: 'Composants/Sheet',
  component: Sheet,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof Sheet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Defaut: Story = {
  args: {
    title: 'Reprendre le lot ?',
    description: 'L’app s’est fermée pendant le lot de 10 h 31. Rien n’est perdu.',
    behind: <div className="h-dvh bg-fill" />,
    children: (
      <Button block className="mt-6">
        Reprendre le scan
      </Button>
    ),
  },
};
