# Courrier

Suivi des colis reçus à l'accueil : une PWA pour iPhone et son API.

## Structure

| Dossier | Rôle |
| --- | --- |
| `apps/web` | Application Vite, React 19, TanStack Router, Query et Form |
| `apps/server` | API Hono qui sert le routeur tRPC |
| `packages/api` | Routeur tRPC ; l'app web n'en importe que le type |
| `packages/contract` | Schémas zod partagés entre l'app et l'API |
| `packages/db` | Client Drizzle et schéma Postgres 17 |
| `packages/shared` | Variables d'environnement, logs, traductions |
| `packages/ui` | Design system et Storybook |
| `docs/` | Cahier des charges, recherches, maquettes |

## Démarrage local

Prérequis : Node 22.12 ou plus, pnpm 11, Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm dev
```

- App : http://localhost:3100
- API : http://localhost:3101 (`/health` répond toujours, `/ready` vérifie la base)

L'API démarre aussi sans Postgres : l'écran d'accueil indique alors que la base est
indisponible. `pnpm db:down` arrête la base.

## Commandes

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Lance l'app et l'API |
| `pnpm lint` | ESLint, sans avertissement toléré |
| `pnpm check-types` | Vérification TypeScript de tous les paquets |
| `pnpm test` | Tests Vitest |
| `pnpm build` | Build de production ; exige `PUBLIC_SERVER_URL` (ex. `PUBLIC_SERVER_URL=http://localhost:3101 pnpm build`) |
| `pnpm db:generate` | Génère une migration Drizzle depuis le schéma |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm storybook` | Storybook du design system sur http://localhost:6006 |
| `pnpm visual` | Compare les stories à leurs références |
