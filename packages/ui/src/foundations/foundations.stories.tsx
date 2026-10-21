import type { Meta, StoryObj } from '@storybook/react-vite';

import { Icon, ICON_PATHS, type IconName } from '#icons';

/**
 * The tokens of `styles.css`, drawn. Colours are read from the computed
 * custom properties rather than retyped, so this page cannot drift from the
 * stylesheet it documents.
 */
const meta = {
  title: 'Fondations',
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const COLOR_GROUPS: { title: string; tokens: string[] }[] = [
  { title: 'Texte', tokens: ['ink', 'ink-2', 'muted', 'faint'] },
  { title: 'Surfaces', tokens: ['white', 'fill', 'fill-2', 'separator', 'border'] },
  {
    title: 'États',
    tokens: [
      'blue',
      'blue-strong',
      'blue-soft',
      'red',
      'red-soft',
      'orange',
      'orange-strong',
      'orange-soft',
      'green',
      'green-soft',
    ],
  },
  {
    title: 'Caméra',
    tokens: [
      'night',
      'night-2',
      'night-3',
      'night-muted',
      'ios-green',
      'ios-yellow',
      'ios-orange',
      'ios-red',
    ],
  },
  { title: 'Illustration du colis', tokens: ['kraft', 'kraft-dark', 'paper'] },
];

function Swatch({ token }: { token: string }) {
  const value =
    typeof window === 'undefined'
      ? ''
      : getComputedStyle(document.documentElement)
          .getPropertyValue(`--color-${token}`)
          .trim();
  return (
    <figure className="flex w-[120px] flex-col gap-1.5">
      <span
        className="h-14 rounded-card border border-separator"
        style={{ background: `var(--color-${token})` }}
      />
      <figcaption className="text-13 font-semibold">{token}</figcaption>
      <span className="font-mono text-12 text-muted">{value}</span>
    </figure>
  );
}

export const Couleurs: Story = {
  render: () => (
    <div className="flex flex-col gap-8">
      {COLOR_GROUPS.map((group) => (
        <section key={group.title} className="flex flex-col gap-3">
          <h2 className="text-20 font-bold">{group.title}</h2>
          <div className="flex flex-wrap gap-4">
            {group.tokens.map((token) => (
              <Swatch key={token} token={token} />
            ))}
          </div>
        </section>
      ))}
    </div>
  ),
};

const TYPE_SCALE: { name: string; className: string; sample: string }[] = [
  { name: 'Grand titre 34 / Bold', className: 'text-34 font-bold', sample: 'Colis' },
  { name: 'Titre 28 / Bold', className: 'text-28 font-bold', sample: 'Camille Morel' },
  { name: 'Section 20 / Bold', className: 'text-20 font-bold', sample: 'À notifier' },
  { name: 'Ligne 17 / Semibold', className: 'text-17 font-semibold', sample: 'Inès Garnier' },
  { name: 'Corps 17 / Regular', className: 'text-17', sample: 'Rechercher' },
  { name: 'Sous-titre 15 / Regular', className: 'text-15 text-muted', sample: '18 colis, dont 6 à traiter' },
  { name: 'Détail 14 / Regular', className: 'text-14 text-muted', sample: 'Ressources humaines, FedEx ···3338' },
  { name: 'Pastille 13 / Semibold', className: 'text-13 font-semibold', sample: 'À jour' },
  { name: 'Suivi 15 / Mono', className: 'font-mono text-15', sample: '1Z E63 44W 04 9923 0622' },
  { name: 'Étiquette 14 / Archivo', className: 'font-label text-14 font-bold', sample: 'SHIP TO: CAMILLE MOREL' },
];

export const Typographie: Story = {
  render: () => (
    <div className="flex flex-col divide-y divide-separator">
      {TYPE_SCALE.map((row) => (
        <div key={row.name} className="flex items-baseline gap-6 py-3">
          <span className="w-56 shrink-0 text-13 text-muted">{row.name}</span>
          <span className={row.className}>{row.sample}</span>
        </div>
      ))}
    </div>
  ),
};

export const Icones: Story = {
  name: 'Icônes',
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-3">
      {(Object.keys(ICON_PATHS) as IconName[]).map((name) => (
        <figure
          key={name}
          className="flex flex-col items-center gap-2 rounded-card bg-fill py-4"
        >
          <Icon name={name} size={24} />
          <figcaption className="text-12 text-ink-2">{name}</figcaption>
        </figure>
      ))}
    </div>
  ),
};

/**
 * Both toolbar menus ("Arrondis", "Pastilles") rewrite these tokens, so this
 * story shows the values of the preset currently selected.
 */
const RADII: { token: string; use: string }[] = [
  { token: 'tag', use: '4 px — étiquettes' },
  { token: 'chip', use: '6 px — puces, petits boutons' },
  { token: 'control', use: '8 px — boutons, champs, carrés d’icône' },
  { token: 'sheet', use: '12 px — feuilles, grands visuels' },
  { token: 'tile', use: 'pastilles : carrés d’icône, avatars' },
];

export const Arrondis: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      {RADII.map((r) => (
        <figure key={r.token} className="flex w-40 flex-col gap-2">
          <span
            className="h-20 bg-black"
            style={{ borderRadius: `var(--radius-${r.token})` }}
          />
          <figcaption className="text-13">
            <strong className="font-semibold">{r.token}</strong> · {r.use}
          </figcaption>
        </figure>
      ))}
    </div>
  ),
};
