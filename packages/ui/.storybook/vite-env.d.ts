// Storybook builds this package with Vite, so `preview.ts` may import a
// stylesheet for its side effect. Vite's ambient types are what declare that
// `.css` module; they are pulled in here rather than through `types` in
// tsconfig, which would otherwise narrow the whole package to this one entry.
/// <reference types="vite/client" />
