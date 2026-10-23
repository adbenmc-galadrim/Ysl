# Courrier

Suivi des colis reçus à l'accueil : une PWA pour iPhone et son API.

## Structure

| Dossier | Rôle |
| --- | --- |
| `apps/web` | Application Vite, React 19, TanStack Router, Query et Form |
| `apps/server` | API Hono qui sert le routeur tRPC |
| `apps/spike-camera` | Prototype jetable du spike S1 (caméra et rafale), servi sous `/spike-camera/` |
| `packages/api` | Routeur tRPC ; l'app web n'en importe que le type |
| `packages/auth` | Better Auth : comptes, rôles agent et admin, client web |
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
pnpm db:migrate
pnpm dev
```

- App : http://localhost:3100
- API : http://localhost:3101 (`/health` répond toujours, `/ready` vérifie la base)

L'API démarre aussi sans Postgres : `/ready` le signale, et la connexion est alors
impossible. `pnpm db:down` arrête la base.

## Comptes

Chaque agent a son compte, avec le rôle `agent` ou `admin`. Il n'y a pas d'inscription
publique : le premier administrateur se crée en ligne de commande, les comptes suivants
aussi tant que l'écran d'équipe n'existe pas.

```bash
echo 'un-mot-de-passe' | pnpm auth:create-user --email admin@example.com --name "Admin" --role admin
```

Le mot de passe se lit sur l'entrée standard ou dans `AUTH_USER_PASSWORD`, jamais en
argument. Sans `--role`, le compte est un agent. Un mot de passe oublié se réinitialise
par l'administrateur.

En production, `BETTER_AUTH_SECRET` (32 caractères au moins) et `BETTER_AUTH_URL` (URL
publique de l'API) sont obligatoires ; en local, des valeurs de développement s'appliquent.

## Déploiement

La production tourne sur Coolify : https://ysl.shinseo.fr pour l'app,
https://ysl-api.shinseo.fr pour l'API, et une base Postgres 17 gérée par Coolify.

| Ressource | Build | Variables |
| --- | --- | --- |
| API | `apps/server/Dockerfile`, port 3101 | `DATABASE_URL`, `CORS_ORIGIN`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET` |
| App | `apps/web/Dockerfile`, port 80 | `PUBLIC_SERVER_URL` au build |

Les deux images se construisent depuis la racine du dépôt. L'image de l'app sert aussi le
prototype du spike S1 sous https://ysl.shinseo.fr/spike-camera/. L'API applique les migrations
Drizzle à chaque démarrage, avant d'ouvrir son port.

Chaque push sur la branche `prod` lance `.github/workflows/deploy.yml` : lint, types et
tests, puis déploiement via l'API Coolify. Mettre en production revient à avancer `prod`
sur `main` (`git push origin main:prod`). L'auto-deploy de Coolify reste coupé pour ne pas
déployer deux fois. Le workflow se relance à la main depuis l'onglet Actions.

Pour créer un compte en production, depuis le terminal du conteneur de l'API dans Coolify :

```bash
cd /app/packages/auth
AUTH_USER_PASSWORD='un-mot-de-passe' ./node_modules/.bin/tsx src/scripts/create-user.ts --email admin@example.com --name "Admin" --role admin
```

Ce terminal est interactif, le script n'y lit donc pas l'entrée standard : le mot de
passe passe par `AUTH_USER_PASSWORD`.

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
| `pnpm auth:create-user` | Crée un compte agent ou admin |
| `pnpm auth:generate` | Régénère le schéma Drizzle des tables Better Auth |
| `pnpm storybook` | Storybook du design system sur http://localhost:6006 |
| `pnpm visual` | Compare les stories à leurs références |
