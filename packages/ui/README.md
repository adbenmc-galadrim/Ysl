# @repo/ui — Courrier YSL

The design system of the Courrier YSL PWA and the Storybook that documents it.
Every screen of the Penpot mockups has a story, and every story is checked
pixel by pixel against its reference: the Penpot export, except for the
landing (`reference/10-landing`), whose animated relief has no Penpot board
and is referenced by its own Storybook capture (`"source": "storybook"`), and
the dark theme (`reference/11-sombre`), which Penpot does not draw either:
the screens the app ships, captured from the stories of `Écrans/11 Mode
sombre`. Every other story can be checked in the dark from the « Thème »
menu of the toolbar.

```bash
pnpm storybook                              # http://localhost:6006
pnpm visual                                 # compare every screen story
pnpm visual -- --filter 04-reception        # a subset, by story id
pnpm --filter @repo/ui check-types
pnpm --filter @repo/ui lint
pnpm --filter @repo/ui test                 # Vitest, tests/**/*.test.ts
```

## Layout

```
styles.css            tokens (colours, type scale, radii) — read off Penpot
reference/<page>/     Penpot exports: <screen>.png (2x) and <screen>.json
visual/compare.mjs    pixel diff, writes visual/out/<ref>.sheet.png
tests/                Vitest unit tests (QR matrix read back with jsQR)
src/
  icons/              <Icon name size strokeWidth>, Lucide paths from Penpot
  device/             iOS status bar + home indicator, Storybook only
  lib/tv.ts           tailwind-variants, taught the custom scales
  lib/qr.ts           QR encoder (level H) and the logo area of BrandedQr
  fixtures/           the demo mailroom shared by every story
  components/<name>/  index.tsx + <name>.stories.tsx — generic building blocks
  screens/<flow>/     one <screen>-screen.tsx per screen family + its stories
```

## Rules

- **Internal imports use the `#` alias**, never relative paths
  (`#components/button`, `#screens/colis/colis-screen`).
- **Tailwind only, through the tokens.** `text-17` carries the size *and* the
  Penpot line height; colours are `text-muted`, `bg-fill`, `bg-blue/12`… An
  arbitrary value (`mt-[33px]`) is fine for a measured spacing; an arbitrary
  colour is not — add the token instead.
- **Components are generic, screens are composition.** A component takes data
  and variants and knows nothing of a given screen. A screen component takes
  props (parcels, states, counts) so each Penpot variant of a screen is the
  same component with other args, not a copy.
- **Responsive by construction.** No absolute positioning of content: flex
  and grid, 20 px gutters, widths that follow the viewport. Check a screen at
  375, 393 and 430 px wide in the Storybook viewport menu. Fixed widths are
  for things that are fixed in the design (a 145 px button), not for rows.
- **Comments in English and about _why_.** User-facing wording is French.

## Screen stories

```tsx
const meta = {
  title: 'Écrans/05 Colis/Colis',
  component: ColisScreen,
  parameters: { layout: 'fullscreen', device: { tone: 'light' } },
  globals: { viewport: { value: 'iphone15', isRotated: false } },
} satisfies Meta<typeof ColisScreen>;

export const Accueil: Story = {
  parameters: { reference: '05-colis/colis--colis' },
  args: { … },
};
```

`parameters.device` wraps the story in the iPhone chrome (`tone: 'dark'` for
the camera screens) and sets `--safe-top: 50px` / `--safe-bottom: 34px`.
`parameters.reference` is what `pnpm visual` compares the story with.

## Reading a reference

`reference/<page>/<screen>.json` is the Penpot layer tree of the screen: every
node with `x`, `y`, `w`, `h` relative to the screen, fills (`c` colour, `o`
opacity), strokes, radius `r`, and for text `text`, `ff`, `fw`, `fs`, `lh`,
`ta`, plus `segs` when a text mixes styles. Icons are groups named
`icon / <name>`, whose `<name>` is an `IconName`. Penpot keeps a 2 px stroke
when it scales an icon, which `<Icon>` reproduces.

The landing's JSON keeps the tree of its first Penpot board for its
measures and copy; its PNG is the Storybook capture, not that board.
