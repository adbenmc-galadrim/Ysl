# Stack Emis : analyse pour Courrier YSL

Source : `~/Documents/emis/emis` (checkout principal, branche `main`, commit `983675d`), lu en lecture seule. Le `main` est un gabarit épuré : un seul exemple métier (`todo`), plus `health` et `auth`. Les features réelles d'Emis vivent dans les autres worktrees (`emis-dev`, `emis-feat-*`), non analysés ici.

Versions : celles du catalog (`pnpm-workspace.yaml`) ou du `package.json`, avec la version résolue dans `pnpm-lock.yaml` quand le range est flottant. Rien n'est déduit de mémoire.

## 1. Tableau de la stack

| Couche | Techno | Version (déclarée / résolue lockfile) | Rôle |
| --- | --- | --- | --- |
| Gestionnaire | pnpm | `pnpm@11.20.0` (`packageManager`) | Workspaces + catalog. pnpm 11 est requis : `allowBuilds:` n'existe pas avant |
| Runtime | Node | `engines >=22.12`, CI et Docker en Node 24 | |
| Orchestration | Turborepo | `^2.10.9` / 2.10.9 | Tâches, cache, `turbo gen` |
| Langage | TypeScript | `6.0.3` (catalog, exact) | Plafonné à 6.x car typescript-eslint ne supporte pas TS 7 |
| UI | React / React DOM | `^19.2.0` / 19.2.8 | |
| Bundler web | Vite | `^8.0.0` / 8.2.1 (rolldown) | SPA, pas de SSR |
| Plugin React | `@vitejs/plugin-react` | `^6.0.1` | |
| Routage | TanStack Router | `^1.170.23`, plugin `^1.168.27` | File-based, `autoCodeSplitting` |
| Server state | TanStack Query | `^5.101.4` | |
| Formulaires | TanStack Form | `^1.24.1` / 1.33.3 | Validés avec les schémas zod de `@repo/contract` |
| Offline lecture | `@powersync/web` | `^1.39.1` / 1.39.1 | SQLite WASM en navigateur, sync |
| SQLite WASM | `@journeyapps/wa-sqlite` | `^1.7.2` / 1.7.2 | Moteur SQLite (artefact WASM prébuilt) |
| Collections réactives | `@tanstack/react-db` | `^0.2.1` | Live queries sur le SQLite local |
| Adaptateur | `@tanstack/powersync-db-collection` | `^0.1.58` | Branche PowerSync sur TanStack DB |
| Plugin WASM | `vite-plugin-wasm` | `^3.6.0` | WASM dans la page et dans le worker |
| Contrat API | tRPC | `11.18.0` (client, server, tanstack-react-query), exact | Écritures et lectures online, types partagés |
| Serveur HTTP | Hono | `^4.13.1` / 4.13.1 | Transport seul (headers, CORS, limites, /health, /ready) |
| Adaptateurs Hono | `@hono/node-server` / `@hono/trpc-server` | `^2.1.0` / `^0.4.2` | |
| Build serveur | tsdown | `^0.21.9` / 0.21.10 | Bundle prod, `noExternal` sur `@repo/*` |
| Auth | Better Auth | `^1.6.26` / 1.6.26 (le CLI `@better-auth/cli` est épinglé `1.4.22`) | Email + mot de passe, plugin `jwt()` pour PowerSync |
| BDD | PostgreSQL | image `postgres:17-alpine` | `wal_level=logical` pour PowerSync |
| ORM | drizzle-orm / drizzle-kit | `^0.45.2` / 0.45.2 ; kit `^0.31.10` | Schéma TS, migrations SQL commitées |
| Driver | `pg` | `^8.22.0` | |
| Validation | zod | `4.4.3` (exact) | Contrat partagé client/serveur |
| Env | `@t3-oss/env-core` + dotenv | `^0.13.1` / 0.13.11 ; dotenv `^17.2.2` | Env validé au démarrage, `.env` unique à la racine |
| Logs | pino / pino-pretty | `^10.3.1` ; `^13.1.3` | + `AsyncLocalStorage` de corrélation (`requestId`, `userId`) |
| Styles | Tailwind CSS + `@tailwindcss/vite` | `^4.3.3` / 4.3.3 | Tokens CSS dans `packages/ui/styles.css` |
| Variantes | tailwind-variants / tailwind-merge | `^3.3.1` ; `^3.6.0` | Pas de lib headless |
| Storybook | storybook, `@storybook/react-vite`, addons a11y/docs/themes | `^10.5.7` / 10.5.7 | Doc du design system |
| i18n | `@repo/i18n` maison | sans dépendance | `t()` typé, clés pointées plates, locale `fr` |
| Tests unitaires | Vitest | `^4.1.10` / 4.1.10 | Node, pas de DOM |
| e2e | Playwright | `^1.57.0` / 1.62.1 | Chromium, 1 worker |
| Lint | ESLint 9 (flat) + typescript-eslint `^8.66.0` | eslint `^9.39.1` / 9.39.5 | `--max-warnings 0` |
| Format | Prettier | `^3.7.4` / 3.9.6 | `.prettierrc.json` : simples quotes, trailing commas, 80 colonnes |
| CI | GitHub Actions | `actions/checkout@v5`, `pnpm/action-setup@v6`, `setup-node@v6` | `.github/workflows/ci.yml` |
| Sync service | `journeyapps/powersync-service:latest` | image Docker, **non épinglée** | Self-hosted, stockage Postgres séparé |
| Secrets env | Transcrypt (aes-256-cbc) | | `.env.dev`, `.env.preprod`, `.env.prod` chiffrés dans git |

## 2. Architecture du monorepo

```
apps/
  server/   @repo/server : Hono, Better Auth monté sur /api/auth/*, tRPC sur /trpc/*, /health, /ready
  web/      @repo/web    : SPA React/Vite
packages/
  api/      routers tRPC par feature : features/<nom>/{router,schema,service}.ts
  auth/     config Better Auth (".") + client navigateur ("./client")
  contract/ schémas zod + constantes, un sous-chemin par feature (feuille, dépend de zod seul)
  db/       schéma Drizzle, client pg, migrations commitées (drizzle/), SYNCED_TABLES, reconcile-publication
  env/      env validé (./server, ./web, ./ports, ./load-env, ./test-database)
  i18n/     wording typé (src/locales/fr.ts), feuille
  logger/   pino + AsyncLocalStorage
  seed/     comptes de démo (pnpm db:seed)
  e2e/      Playwright (3 specs dont powersync.spec.ts)
  ui/       design system (button, checkbox, text-field) + Storybook
  eslint-config/, typescript-config/
turbo/generators/  @repo/generators (workspace déclaré : turbo gen ne lit que ce chemin)
powersync/  service.yaml, sync-config.yaml, docker/ (compose + module storage-postgres)
scripts/worktree.sh
```

DAG strict (`AGENTS.md`) : `env` -> `db` -> `auth` -> `api` -> `apps/server`. `i18n` et `contract` sont des feuilles importables partout. `logger` est juste au-dessus de `env`. `seed` et `e2e` ne sont importés par personne. `apps/web` n'importe `@repo/api` qu'avec `import type` (sinon routers + `pg` partent dans le bundle), ses valeurs viennent de `@repo/contract`.

Particularités structurantes :
- Les packages livrent leur source TS, sans étape de build. Vite et tsx la consomment directement, `apps/server` les inline avec tsdown.
- Alias interne `#/...` (apps) et `#features/...` (packages), déclaré dans les `imports` des `package.json`. Imports relatifs interdits (lint).
- `apps/web` : `app/` (shell, routes) -> `features/<nom>/{api,components}` -> `lib/` + `utils/` + `hooks/`. Une feature n'importe jamais une autre, pas de barrel files. Règles imposées par `no-restricted-imports` dans `apps/web/eslint.config.mjs`.
- Scaffolding : `turbo gen ui-component | translation-key | package` (`turbo/generators/`).

Commandes clés (racine `package.json`) :
```
pnpm dev | build | lint | check-types | format | format:check | storybook | gen
pnpm test            # vitest : tests web (Node) + @repo/api sur un vrai Postgres
pnpm test:e2e        # Playwright
pnpm db:up | db:test:up | db:migrate | db:generate | db:seed | db:studio
pnpm auth:generate   # régénère packages/db/src/schema/auth.ts
pnpm powersync:up | powersync:down   # après pnpm dev (récupère le JWKS)
pnpm worktree <branche>              # scripts/worktree.sh
```

Tests, trois niveaux : unitaires web en Node (`apps/web/tests/*.test.ts`, 13 fichiers), `packages/api/tests` contre un Postgres jetable (`postgres-test`, tmpfs, `fsync=off`, garde `assertTestDatabaseUrl()`), puis e2e Playwright.

CI (`.github/workflows/ci.yml`), 3 jobs parallèles : (1) `ci` avec format:check, lint, check-types, build, puis vérification des fichiers générés (auth schema, migrations, routeTree : régénère et `git diff --exit-code`), (2) `test` (API contre Postgres), (3) `image` (build Docker du serveur, boot, sonde `/health` et `/ready`). Le job `test:e2e` n'apparaît pas dans les extraits lus de la CI ; la présence de `docker-compose.e2e.yaml` et du commit "test(e2e): run powersync stack" indique que l'e2e tourne en local.

## 3. Focus : offline, PWA, loading, design system

### 3.1 PowerSync (offline-first en lecture)

Principe : lectures via SQLite local (PowerSync + TanStack DB), écritures via tRPC (`apps/web/README.md`, `AGENTS.md`).

- Client : `apps/web/src/lib/powersync/`
  - `db.ts` : singleton `PowerSyncDatabase({ schema, database: { dbFilename: 'emis.db' } })`. Moteur SQLite WASM dans un worker, fichier dans OPFS. Connecteur : `fetchCredentials()` appelle `authClient.token()` (plugin `jwt()` de Better Auth), `uploadData()` appelle `getNextCrudTransaction()` puis `uploadTransaction()`. `connectPowerSync()` est mémoïsé et se réinitialise en cas d'échec. `CLIENT_SCHEMA_VERSION` (localStorage) déclenche un `disconnectAndClear()` quand il bouge. `flushPendingWrites()` puis `clearPowerSync()` à la déconnexion (sinon la file d'upload serait détruite).
  - `registry.ts` : `syncModules` (table + upload) assemblés en `AppSchema`. Une table inconnue dans la file est ignorée pour ne pas bloquer la file.
  - `tables/todo.ts` : `new Table({...})` avec colonnes `column.text/integer` + deux schémas zod (`schema` pour l'app, `deserializationSchema` pour le sync : booléens en entier, dates en ISO texte).
  - `collections/todo.ts` : `createCollection(powerSyncCollectionOptions(...))` privée, exposant `preloadTodos()`, `useTodos()` (`useLiveQuery`) et les mutations (`addTodo`, etc.). L'id est généré côté client (`safeRandomUUID`), `created_at` aussi.
  - `crud-upload.ts` : `crudUploader` (PUT/PATCH/DELETE vers 3 handlers tRPC), `isPermanentDataError` (400/403/404/409 abandonnés, 401 et réseau retentés), échec jugé par opération et non par lot. Les procédures serveur doivent être idempotentes (un lot est renvoyé en entier).
  - `use-sync-status.ts` + `features/sync/components/sync-status.tsx` : affiche joignabilité du service, ancienneté de la dernière synchro, nombre d'écritures en attente. Volontairement jamais "hors ligne" (le client ne connaît pas l'état du réseau).
- Service : `powersync/service.yaml` (self-hosted ; réplication Postgres via `PS_DATA_SOURCE_URI`, stockage Postgres séparé, `client_auth.jwks_uri` = `/api/auth/jwks` de Better Auth, `audience` = `PUBLIC_POWERSYNC_URL`, `api.tokens`).
- Règles de sync : `powersync/sync-config.yaml`, `edition: 3`, streams. Seul stream : `todos` avec `auto_subscribe: true` et `SELECT * FROM todo WHERE user_id = auth.user_id()`. Le filtre est la frontière d'autorisation (exécuté côté service). Interdits : alias de table dans `FROM` (le nom client en dérive), `JOIN` (préférer une sous-requête).
- Côté Postgres : `SYNCED_TABLES` dans `packages/db/src/powersync.ts` ; la publication `powersync` est réconciliée à chaque `pnpm db:migrate` (`reconcile-publication.ts`). `docker-compose.yml` lance Postgres avec `-c wal_level=logical`.
- Docker : `powersync/docker/docker-compose.yaml` (projet compose `powersync_emis`, healthcheck `/probes/liveness`, `extra_hosts host.docker.internal`, `NODE_OPTIONS --max-old-space-size=1000`) + `modules/storage-postgres`. Le service ne démarre qu'après l'API (JWKS lu au démarrage). Modifier `sync-config.yaml` exige un redémarrage.
- Vite (`apps/web/vite.config.ts`) : `build.target: 'esnext'` (top-level await), `optimizeDeps.exclude` de `@journeyapps/wa-sqlite` et `@powersync/web`, `worker: { format: 'es', plugins: () => [wasm()] }`, `vite-plugin-wasm`. Le plugin top-level-await est inutilisable avec Vite 8/rolldown. `pnpm-workspace.yaml` : `'@journeyapps/wa-sqlite': false` dans `allowBuilds` (artefact WASM prébuilt, pas de toolchain Emscripten).
- Triple déclaration d'une table synchronisée, non vérifiée automatiquement : `SYNCED_TABLES`, un stream YAML, un `Table` + collection côté client.

### 3.2 PWA / service worker

**Il n'y en a aucun.** Aucun manifest, aucun service worker, aucun `vite-plugin-pwa`, pas de dossier `public/` dans `apps/web` (grep sur `service worker|workbox|manifest|vite-plugin-pwa`). Le README racine le dit : "The app is not a PWA, so a reload with the network down still gets the browser's offline page — only the data survives, not the document. `vite-plugin-pwa` is what closes that gap when it is worth closing." Pour Courrier YSL, c'est un chantier à ajouter (precache de l'app shell, manifest, installabilité, mises à jour du SW), sans modèle à reprendre dans Emis. `apps/web/index.html` ne contient qu'un script inline de thème sombre avant le premier rendu, et `lang` et `<title>` injectés par le plugin `htmlWording` de `vite.config.ts`.

### 3.3 Skeletons et états de chargement

**Pas de composant skeleton ni de `Suspense` dans le dépôt.** Approche actuelle :
- Aucun `Skeleton` dans `packages/ui` (3 composants seulement).
- `useTodos()` expose `{ isLoading, isError }` issus de `useLiveQuery` ; les composants gèrent eux-mêmes pending et erreur.
- Loaders de routes TanStack Router qui préchargent sans bloquer (`void queryClient.prefetchQuery(...)`, pas `ensureQueryData`), exprès pour garder pending et error dans les composants et non dans `pendingComponent`/`errorComponent` du routeur. `defaultPreload: 'intent'`, `staleTime` 30 s et `gcTime` 5 min dans `apps/web/src/lib/query-client.ts`.
- Côté offline, le chargement est quasi instantané (lecture SQLite locale) ; `preloadTodos()` remplit la collection avant le rendu de la route.

### 3.4 Design system

- Package `@repo/ui` : `Button` (variantes `solid|outline|ghost|destructive`, tailles `sm|md|lg`), `Checkbox`, `TextField`. Éléments HTML natifs, pas de lib headless (le README prévoit d'en rajouter une seulement le jour où un composant interactif complexe est nécessaire), pas d'`asChild` (un `<Link>` prend `buttonVariants()`). Un dossier par composant (`index.tsx` + `<nom>.stories.tsx`), `tv()` depuis `#lib/tv`.
- Tokens dans `packages/ui/styles.css` : variables CSS `:root` et `.dark` (`--background`, `--surface`, `--foreground`, `--muted`, `--muted-foreground`, `--primary`, `--accent` rouge `#da291c` en clair, `--destructive`, `--border`, `--ring`), mappées dans `@theme` en `--color-*`. Typo : Inter / Inter Tight, échelle `text-display|h1|body|label`, `--radius-field: 0` (angles droits). `@custom-variant dark` rebranché sur la classe `.dark`. Le mode sombre suit `prefers-color-scheme` via un script inline, sans bascule manuelle. Les tokens sont très liés à l'identité visuelle d'Emis (rouge, angles droits) : à redéfinir pour YSL.
- Pas shadcn/ui : tailwind-variants maison. Storybook 10 avec addon a11y, thème clair/sombre et autodocs (`packages/ui/.storybook/`).

## 4. Conventions notables à reprendre

- Commentaires et docs en anglais, qui expliquent le pourquoi et non le quoi (densité élevée dans tout le code). Wording utilisateur en français, uniquement dans `@repo/i18n`, jamais en dur dans un composant.
- Chaque package a son `README.md` à lire en premier ; `AGENTS.md` fait office de guide du dépôt, `CLAUDE.md` pointe sur les mêmes consignes. Skills locales dans `.agents/skills` et `.claude/skills` (better-auth, powersync, turborepo, playwright-cli, smart-commit, check-code-quality).
- Versions partagées uniquement dans le `catalog:` de `pnpm-workspace.yaml`, avec commentaire de la raison de chaque contrainte.
- Un seul `.env` racine, validé au démarrage ; variables navigateur préfixées `PUBLIC_` (et non `VITE_`) ; les URLs dérivent des ports.
- Tests : asserter sur `TRPCError.code`, jamais sur le message ; sélecteurs e2e issus de `t()` (pas de `data-testid`) ; BDD de test jetable et séparée de la BDD de dev ; unitaires web en Node pur ; e2e limité à quelques smoke tests.
- Git : commits conventional (`feat:`, `docs:`, `ci:`, `chore(scope):`, `test(e2e):`), titres courts en anglais dans l'historique d'Emis. **Pour YSL, les règles du `~/.claude/CLAUDE.md` de l'utilisateur priment** : messages en français, une seule ligne, pas de trailer.
- Worktrees : `pnpm worktree <branche>` crée `../emis-<branche>` avec son `.env` (ports `SERVER_PORT`/`WEB_PORT` décalés au premier couple libre), ses `node_modules`, et partage Postgres. L'e2e et Storybook ne tournent qu'une fois par machine.
- Lint strict (`--max-warnings 0`), prettier vérifié en CI, fichiers générés commités et vérifiés en CI (migrations, `routeTree.gen.ts`, schéma auth).
- Sécurité : taux limité par IP avec `TRUSTED_PROXY_HOPS`, `secureHeaders`, cookie de session `lax`, `seed` refusé en production.

## 5. Recommandation pour Courrier YSL

Contexte : 1 à quelques agents courrier, 100 à 1000 salariés destinataires, PWA hors ligne, lecture de bordereaux par photo.

### À reprendre tel quel
- Monorepo pnpm 11 + Turborepo avec `catalog:`, TypeScript 6.0.3, ESLint/Prettier/Vitest avec les mêmes réglages et la CI en jobs parallèles.
- Front : React 19, Vite 8, TanStack Router, Query, Form, Tailwind 4, tailwind-variants. Règles d'import par feature, alias `#/`, pas de barrel, routes minces.
- Back : Hono + tRPC 11 + Drizzle + PostgreSQL 17 + zod 4. Pattern `router.ts` (câblage) / `service.ts` (logique) / `@repo/contract` (contrat partagé), `import type` uniquement vers `@repo/api`.
- Better Auth + plugin `jwt()` si PowerSync est retenu (le JWKS sert aussi à vérifier les tokens PowerSync).
- `@repo/env` (validation + `.env` unique), `@repo/i18n` typé (utile même en mono-locale : wording centralisé, sélecteurs e2e), `@repo/logger` (pino).
- Le cœur offline : `lib/powersync/` (db.ts, registry, tables, collections, crud-upload). La logique file d'upload par opération, idempotence, id client, date d'écriture client et vidage sécurisé à la déconnexion est précieuse pour des agents qui scannent des colis en zone sans réseau. À reprendre aussi : `powersync/` (service.yaml, sync-config), le réglage Vite WASM/worker et la version de schéma client.
- `scripts/worktree.sh` et le dispositif des skills locales, conformes aux conventions de l'utilisateur.

### À alléger
- Découpage en packages : 12 packages pour une petite app. Candidats à la fusion : `env` + `logger` + `i18n` en un `@repo/shared`, `seed` dans `db`. Les règles de DAG strict et les restrictions d'import par ESLint peuvent être réduites aux deux essentielles (`import type` d'`@repo/api`, pas d'import entre features).
- Génération `turbo gen` (3 générateurs) : utile surtout pour `translation-key`, le reste peut attendre.
- Storybook 10 + addons : garder seulement si un design system est vraiment construit ; 3 composants suffisent pour démarrer, une page de démo dans l'app peut remplacer Storybook au début.
- e2e : garder 2 ou 3 smoke tests (connexion, scan d'un bordereau, remise d'un colis) ; la stack e2e avec compose PowerSync jetable est lourde.
- Docker/CI : conserver le job image + sondes `/health` `/ready`, mais le job "fichiers générés" peut se limiter aux migrations.
- Rate limiting par IP et `TRUSTED_PROXY_HOPS` : utiles seulement si l'app est exposée sur Internet ; en intranet derrière un SSO, très simplifiable.
- Transcrypt et trois profils chiffrés (`.env.dev/preprod/prod`) : à remplacer par le secret manager de l'hébergeur si l'équipe est de 1 à 2 personnes.

### À ajouter (absent d'Emis)
- PWA : manifest, service worker (`vite-plugin-pwa` suggéré dans le README racine), precache de l'app shell, mise à jour du SW, installabilité. Sans cela, un rechargement hors ligne ne charge pas le document.
- Capture photo et lecture de bordereaux (OCR ou modèle de vision), stockage et upload des images. Rien de tel dans Emis. Attention : PowerSync synchronise des lignes SQLite, pas des blobs volumineux ; prévoir une file d'upload d'images distincte.
- Composant skeleton et conventions de loading states (inexistants ici).
- Notifications (mail, push) aux destinataires.

### Ne s'applique pas / surdimensionné
- **PowerSync auto-hébergé en entier est probablement surdimensionné** pour 1 à quelques agents : trois conteneurs (service, Postgres de stockage, plus l'API), `wal_level=logical`, publication à réconcilier, JWKS, audience, redémarrage pour chaque changement de règle, image `latest` non épinglée. Chaque table ajoutée exige trois déclarations non vérifiées entre elles. À arbitrer explicitement avec l'utilisateur : si l'offline ne concerne que la saisie d'un seul agent, une alternative légère (cache TanStack Query persisté + file d'écriture IndexedDB/Dexie) peut suffire. Si la sync reste nécessaire (consultation hors ligne de la liste des destinataires, saisie hors ligne de plusieurs agents), garder PowerSync, mais seulement pour les 2 ou 3 tables utiles.
- TanStack DB (`@tanstack/react-db`, `@tanstack/powersync-db-collection`) : versions jeunes (0.1.x et 0.2.x), API susceptible de bouger ; couche en plus de PowerSync, justifiée surtout par les live queries réactives.
- Pas de rôles ni d'organisation : les skills `organization-best-practices`, `two-factor-authentication-best-practices` et `create-auth` d'Emis ne s'appliquent pas à un premier jet. Seuls email + mot de passe (ou SSO existant) comptent.
- Le contenu métier d'Emis (chantiers, affaires, organigramme, matrices, rôles personnalisés dans les autres worktrees) ne s'applique pas.
- Tokens visuels d'Emis (rouge `#da291c`, rayon 0, Inter Tight) : à redéfinir pour YSL.
- Multi-environnements (`dev/preprod/prod`) avec ports dérivés et multiples worktrees : surdimensionné au démarrage.

### Points d'attention
- Plusieurs versions coexistent dans le lockfile : `better-auth` 1.4.22 (via `@better-auth/cli`) et 1.6.26 (app) ; `drizzle-orm` 0.41.0 (via better-auth) et 0.45.2 (app). Ne pas copier un `pnpm-lock.yaml` tel quel.
- `journeyapps/powersync-service:latest` et `postgres:17-alpine` : épingler les images dès le départ.
- Le catalog d'Emis est très "bleeding edge" (Vite 8/rolldown, TS 6, pnpm 11, zod 4). Compatible avec le choix "même stack", mais figer les versions au démarrage de YSL et ne mettre à jour qu'en bloc.
