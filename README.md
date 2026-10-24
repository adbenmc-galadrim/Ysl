# Courrier

Suivi des colis reçus à l'accueil : une PWA pour iPhone et son API.

## Structure

| Dossier | Rôle |
| --- | --- |
| `apps/web` | Application Vite, React 19, TanStack Router, Query et Form |
| `apps/server` | API Hono qui sert le routeur tRPC |
| `apps/spike-camera` | Prototype jetable du spike S1 (caméra et rafale), servi sous `/spike-camera/` |
| `apps/spike-storage` | Prototype jetable du spike S4 (stockage et mises à jour), servi sous `/spike-storage/` |
| `apps/spike-email` | Prototype jetable du spike S5 (e-mail par la messagerie du téléphone), servi sous `/spike-email/` |
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

L'app tourne sur Coolify, sur un serveur Hetzner situé dans l'UE : les données y restent.
Deux environnements, chacun avec son app, son API et sa base Postgres 17 gérée par Coolify :

| Environnement | App | API | Branche |
| --- | --- | --- | --- |
| Production | https://ysl.shinseo.fr | https://ysl-api.shinseo.fr | `prod` |
| Staging | https://ysl-staging.shinseo.fr | https://ysl-api-staging.shinseo.fr | `main` |

| Ressource | Build | Variables |
| --- | --- | --- |
| API | `apps/server/Dockerfile`, port 3101 | `DATABASE_URL`, `CORS_ORIGIN`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `TRUST_PROXY=true` |
| App | `apps/web/Dockerfile`, port 80 | `PUBLIC_SERVER_URL` et `PUBLIC_APP_URL` (adresse publique de l'app, celle du QR d'installation) au build |

`TRUST_PROXY=true` fait lire l'IP du client dans la dernière entrée de `X-Forwarded-For`,
celle qu'ajoute le proxy de Coolify : sans elle, le rate limit de connexion verrait tous
les clients sous l'IP du proxy. En local, sans proxy, la laisser absente.

Il n'y a pas de stockage objet : le serveur ne garde que les comptes et leurs annuaires
(D7), et les photos ne quittent jamais l'iPhone (D8).

nginx pose `Cross-Origin-Opener-Policy: same-origin` et
`Cross-Origin-Embedder-Policy: require-corp` sur toute l'app
(`apps/web/nginx/isolation.conf`), pour le WASM multithread. Toute ressource chargée
depuis une autre origine doit donc être servie en CORS ou avec un en-tête
`Cross-Origin-Resource-Policy`.

Les deux images se construisent depuis la racine du dépôt. L'image de l'app sert aussi les
prototypes des spikes : https://ysl.shinseo.fr/spike-camera/ (S1),
https://ysl.shinseo.fr/spike-storage/ (S4) et https://ysl.shinseo.fr/spike-email/ (S5).
L'API applique les migrations Drizzle à chaque démarrage, avant d'ouvrir son port.

Chaque push sur `main` ou sur `prod` lance `.github/workflows/deploy.yml` : lint, types
et tests, puis déploiement via l'API Coolify, sur staging pour `main` et en production pour
`prod`. Mettre en production revient à avancer `prod` sur `main`
(`git push origin main:prod`). L'auto-deploy de Coolify reste coupé pour ne pas déployer
deux fois. Le workflow se relance à la main depuis l'onglet Actions, en choisissant
l'environnement. Les UUID des ressources Coolify sont une variable
`COOLIFY_RESOURCE_UUIDS` de chaque environnement GitHub (`staging`, `production`).

Pour créer un compte en production, depuis le terminal du conteneur de l'API dans Coolify :

```bash
cd /app/packages/auth
AUTH_USER_PASSWORD='un-mot-de-passe' ./node_modules/.bin/tsx src/scripts/create-user.ts --email admin@example.com --name "Admin" --role admin
```

Ce terminal est interactif, le script n'y lit donc pas l'entrée standard : le mot de
passe passe par `AUTH_USER_PASSWORD`.

## App installée sur l'iPhone

L'app est une PWA : sur iPhone, elle s'utilise installée sur l'écran d'accueil. Ouverte
dans un onglet Safari, elle n'affiche que l'écran « Installez l'app » (Partager, puis « Sur
l'écran d'accueil »). Sur ordinateur, elle s'ouvre normalement.

- Le service worker (`sw.js`, généré par `vite-plugin-pwa`) met l'app en cache au premier
  lancement : relancée en mode avion, elle s'ouvre sans réseau. Il ne s'enregistre qu'en
  build de production ; pour l'essayer en local, avec
  `SKIP_ENV_VALIDATION=1 PUBLIC_APP_NAME=Courrier PUBLIC_SERVER_URL=http://localhost:3101 PUBLIC_APP_URL=http://localhost:3100`
  devant chaque commande : `pnpm --filter @repo/web build` puis
  `pnpm --filter @repo/web preview` (http://localhost:3100).
- Une nouvelle version n'est jamais appliquée d'office (mode `prompt`) : elle attend la
  fermeture de l'app et s'applique au lancement suivant, jamais au milieu d'un lot.
- `/version.json` donne l'heure du build : `curl -s https://ysl.shinseo.fr/version.json`.
- nginx sert `index.html`, `sw.js`, `version.json` et `manifest.webmanifest` en `no-cache`
  pour qu'un déploiement soit vu au lancement suivant.
- Les icônes (`apps/web/public/`) se régénèrent depuis `icon.svg` :
  `pnpm --filter @repo/web generate-icons`.

Vérifier sur l'iPhone : ouvrir l'app dans Safari, l'installer, l'ouvrir une fois en ligne,
passer en mode avion, fermer l'app puis la relancer : l'écran de connexion s'affiche.

## Commandes

| Commande | Effet |
| --- | --- |
| `pnpm dev` | Lance l'app et l'API |
| `pnpm lint` | ESLint, sans avertissement toléré |
| `pnpm check-types` | Vérification TypeScript de tous les paquets |
| `pnpm test` | Tests Vitest |
| `pnpm build` | Build de production ; exige `PUBLIC_SERVER_URL` et `PUBLIC_APP_URL` (ex. `PUBLIC_SERVER_URL=http://localhost:3101 PUBLIC_APP_URL=http://localhost:3100 pnpm build`) |
| `pnpm db:generate` | Génère une migration Drizzle depuis le schéma |
| `pnpm db:migrate` | Applique les migrations |
| `pnpm auth:create-user` | Crée un compte agent ou admin |
| `pnpm auth:generate` | Régénère le schéma Drizzle des tables Better Auth |
| `pnpm storybook` | Storybook du design system sur http://localhost:6006 |
| `pnpm visual` | Compare les stories à leurs références |
