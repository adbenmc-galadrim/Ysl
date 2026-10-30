# Courrier

Suivi des colis reçus à l'accueil : une PWA pour iPhone et son API.

## Structure

| Dossier | Rôle |
| --- | --- |
| `apps/web` | Application Vite, React 19, TanStack Router, Query et Form |
| `apps/server` | API Hono qui sert le routeur tRPC |
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

Chaque compte appartient à un service courrier (une organisation), la clé de toutes les
données synchronisées. `--organization "<nom>"` le désigne (créé s'il n'existe pas) ;
sans l'option, le script prend l'unique organisation de la base, ou crée « Service
courrier » si elle est vide. Un compte créé avant la synchronisation se rattache après
coup :

```bash
pnpm auth:attach-organization --email admin@example.com [--organization "<nom>"]
```

En production, `BETTER_AUTH_SECRET` (32 caractères au moins) et `BETTER_AUTH_URL` (URL
publique de l'API) sont obligatoires ; en local, des valeurs de développement s'appliquent.

## Installation sur iPhone

L'app s'installe depuis Safari, sans App Store ni MDM (D18) :
[docs/installation-iphone.md](docs/installation-iphone.md) donne le pas à pas illustré,
les réglages d'iPhone recommandés, la marche à suivre en cas de perte ou de vol
(Réglages › Appareils connectés) et la liste de vérification sur un vrai iPhone.

## Déploiement

L'app tourne sur Coolify, sur un serveur Hetzner situé dans l'UE : les données y restent.
Deux environnements, chacun avec son app, son API et sa base Postgres 17 gérée par Coolify :

| Environnement | App | API | Branche |
| --- | --- | --- | --- |
| Production | https://ysl.shinseo.fr | https://ysl-api.shinseo.fr | `prod` |
| Staging | https://ysl-staging.shinseo.fr | https://ysl-api-staging.shinseo.fr | `main` |

| Ressource | Build | Variables |
| --- | --- | --- |
| API | `apps/server/Dockerfile`, port 3101 | `DATABASE_URL`, `CORS_ORIGIN`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `TRUST_PROXY=true` ; pour l'envoi d'e-mails : `BREVO_API_KEY`, `MAIL_FROM_ADDRESS`, `MAIL_FROM_NAME` (facultatif) |
| App | `apps/web/Dockerfile`, port 80 | `PUBLIC_SERVER_URL` (adresse de l'API de l'environnement) et `PUBLIC_APP_URL` (adresse publique de l'app, celle du QR d'installation : `https://ysl.shinseo.fr` en production, `https://ysl-staging.shinseo.fr` en staging) au build |

`TRUST_PROXY=true` fait lire l'IP du client dans la dernière entrée de `X-Forwarded-For`,
celle qu'ajoute le proxy de Coolify : sans elle, le rate limit de connexion verrait tous
les clients sous l'IP du proxy. En local, sans proxy, la laisser absente.

Il n'y a pas de stockage objet : le serveur ne garde que les comptes, leurs annuaires
(D7) et les e-mails en cours d'envoi, et les photos ne quittent jamais l'iPhone (D8).

nginx pose `Cross-Origin-Opener-Policy: same-origin` et
`Cross-Origin-Embedder-Policy: require-corp` sur toute l'app
(`apps/web/nginx/isolation.conf`), pour le WASM multithread. Toute ressource chargée
depuis une autre origine doit donc être servie en CORS ou avec un en-tête
`Cross-Origin-Resource-Policy`.

Les deux images se construisent depuis la racine du dépôt.
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

## Intégration continue

Chaque pull request passe `.github/workflows/ci.yml` (deux jobs en parallèle, moins de
10 minutes) ; `deploy.yml` rejoue les mêmes vérifications sur `main` et `prod` avant de
déployer.

| Job | Ce qu'il vérifie |
| --- | --- |
| Lint, types et tests | `pnpm turbo run lint check-types test` sur tout le monorepo |
| Storybook et écrans | `pnpm build-storybook`, puis `pnpm visual -- --max 0.75` contre le build statique servi par `vite preview`, sur un runner macOS (les références ont été calibrées sur Chromium macOS ; sous Linux les polices décalent chaque écran de 0,8 point) |

`pnpm visual` capture chaque story `Écrans/` qui déclare `parameters.reference` et la
compare au PNG de `packages/ui/reference/` : le run échoue dès qu'un écran diffère de plus
de `--max` % de ses pixels (0,6 par défaut, 0,75 en CI pour le bruit du code-barres de
`scan-lecture`), ou si aucun écran n'a été comparé. Le tableau des écarts
est dans le résumé du job, et les planches référence | capture | diff de tous les écrans
dans l'artefact `planches-visuelles` du run (7 jours). En local : `pnpm storybook` puis
`pnpm visual -- --filter 05-colis`.

## Écrans de l'app

Connecté, l'agent arrive sur **Colis** (`/`), la liste de ce qu'il reste à faire. De là :
« Scanner » ouvre la réception (`/scan`), « Remettre » la remise (`/remise`), et le bouton
« Menu » les **Réglages** (`/reglages`), avec le compte (`/reglages/compte`, déconnexion) et
l'apparence (`/reglages/apparence` : automatique, clair ou sombre) et le choix des arrondis
(`/reglages/arrondis`). Le groupe « Service courrier » des réglages
n'apparaît qu'aux administrateurs. Une adresse inconnue affiche « Page introuvable » et un
retour aux colis.

Les écrans viennent de `@repo/ui` tels qu'ils sont dessinés dans Storybook ; l'app leur
passe les données et les actions. La liste des colis se lit dans la base locale de
l'appareil (Dexie, voir `docs/architecture/stockage-local.md`). L'écran Scan filme en
rafale (voir `docs/architecture/capture-rafale.md`) ; l'écran Remise reste une coquille.

Les arrondis (presets `Carrés` à `Pilules`, pastilles rondes ou non) sont un réglage de
l'appareil, gardé dans `localStorage` (`courrier.corners`) et appliqué sur `<html>` avant le
premier rendu (`data-radius`, `data-tiles`). Storybook propose les mêmes presets dans sa
barre d'outils. L'apparence suit le même chemin (`courrier.theme`, `data-theme` sur
`<html>`, rien en automatique) : elle règle `color-scheme`, que suivent les jetons
`light-dark()` de `@repo/ui`, le fond du document et `theme-color`.

### Lecteur de codes-barres

Le package `@repo/barcode` lit les codes 1D et 2D avec `zxing-wasm`. Le `.wasm` est
auto-hébergé (jamais de CDN) et précaché par le service worker. Tout se passe dans un Web
Worker, une image à la fois, avec une cascade qui s'arrête dès qu'un code est lu : image
entière, puis tuiles en pleine résolution, puis MaxiCode recadré.

Sur `/scan`, chaque appui sur l'obturateur (ou « Importer une photo ») ajoute un colis au
lot et décode l'image en arrière-plan. Le rendu des champs est provisoire : ils affichent
le format et le contenu brut de chaque code lu ; le numéro de suivi et le transporteur
sont déduits pour la ligne « Dernier ajouté » et la liste des colis.

### OCR

Le package `@repo/ocr` lit le texte imprimé avec PaddleOCR (PP-OCRv6 tiny, `onnxruntime-web`
en WASM, 4 threads derrière COOP/COEP) et Tesseract.js v7 en repli, dans un Web Worker, une
photo à la fois (voir `docs/architecture/ocr.md`). Les modèles ne sont pas dans le dépôt :
`pnpm --filter @repo/ocr models` les télécharge (URL et sha256 épinglés) ; `pnpm build` et
`pnpm dev` le font d'eux-mêmes, `pnpm --filter @repo/web build` seul non. Sur `/scan`, après
les codes, l'OCR propose le destinataire avec un « ? » quand aucun code 2D ne le nomme.

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
- Une nouvelle version n'est jamais appliquée d'office (mode `prompt`). L'app compare
  `/version.json` à sa propre version et demande au service worker de se mettre à jour au
  lancement, à chaque retour au premier plan et toutes les 30 minutes
  (`apps/web/src/features/update/`). Quand une version plus récente existe, l'écran Colis
  affiche le toast « Nouvelle version disponible · Mettre à jour » ; il n'apparaît que là,
  jamais pendant un lot (Scan, Remise), et « Mettre à jour » recharge l'app sur la
  nouvelle version. Hors ligne, rien ne s'affiche.
- Réglages › App › « Forcer la mise à jour » : désinscrit le service worker de l'app, vide
  ses caches (ceux laissés par les anciens spikes sont gardés) et recharge ; les données de
  l'iPhone ne sont pas touchées. C'est le recours quand le toast n'apparaît pas.
- Essayer en local : lancer `preview` sur un premier build, ouvrir http://localhost:3100,
  puis relancer `pnpm --filter @repo/web build` dans un autre terminal : au retour sur
  l'onglet (ou après un rechargement), le toast s'affiche.
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
| `pnpm auth:create-user` | Crée un compte agent ou admin, rattaché à son organisation |
| `pnpm auth:attach-organization` | Rattache un compte existant à une organisation |
| `pnpm auth:generate` | Régénère le schéma Drizzle des tables Better Auth |
| `pnpm storybook` | Storybook du design system sur http://localhost:6006 |
| `pnpm visual` | Compare les stories à leurs références ; échoue au-dessus de `--max` % (0,6 par défaut) |
