import type { Meta, StoryObj } from '@storybook/react-vite';

import { DesktopShell } from '#components/desktop-shell';
import { DESK_NAV } from '#fixtures/desk';

const meta = {
  title: 'Composants/DesktopShell',
  component: DesktopShell,
  parameters: { layout: 'fullscreen' },
  globals: { viewport: { value: 'desktop', isRotated: false } },
  decorators: [
    (Story) => (
      <div className="h-dvh">
        <Story />
      </div>
    ),
  ],
  args: {
    brand: 'Service courrier',
    nav: DESK_NAV,
    active: 'colis',
    children: <p className="p-8 text-15 text-muted">Contenu de la page</p>,
  },
} satisfies Meta<typeof DesktopShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Colis: Story = {};

export const Reglages: Story = { name: 'Réglages', args: { active: 'reglages' } };
