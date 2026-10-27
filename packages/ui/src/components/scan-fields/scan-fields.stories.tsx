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

const levels = [
  { label: 'Transporteur', value: 'DHL Express' },
  {
    label: 'Suivi',
    value: '54133 37112 ?',
    mono: true,
    status: 'warning' as const,
  },
  {
    label: 'Destinataire',
    value: '',
    status: 'error' as const,
    suggestions: [{ label: 'Léa Fontaine' }, { label: 'Lise Fontan' }],
  },
];

/** The three levels of §4.4 over the camera: read, to verify, empty with suggestions. */
export const TroisNiveaux: Story = {
  args: { tone: 'dark', fields: levels },
  decorators: Sombre.decorators,
};

/** The same on a white screen, the chips to tap. */
export const TroisNiveauxClair: Story = {
  args: {
    tone: 'light',
    fields: levels.map((field) =>
      field.suggestions
        ? {
            ...field,
            suggestions: field.suggestions.map((s) => ({
              ...s,
              onPick: () => undefined,
              pickLabel: `Choisir ${s.label}`,
            })),
          }
        : field,
    ),
  },
};
