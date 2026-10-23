# Spike S4 · stockage et mises à jour

Prototype jetable du spike S4 (cahier des charges v2, §10.1) : Dexie et OPFS dans une PWA
installée sur iPhone (mode avion, app tuée, verrouillage pendant une écriture,
`persist()`), et détection d'une nouvelle version sans réinstaller. Le protocole et les
résultats sont dans
[`docs/spikes/S4-stockage-mises-a-jour.md`](../../docs/spikes/S4-stockage-mises-a-jour.md).

À supprimer quand la base locale (YSL-22) et la PWA installable (YSL-15) de l'app sont
livrées.

## Lancer

En production : https://ysl.shinseo.fr/spike-storage/. L'image de `apps/web` construit le
spike et nginx le sert sous `/spike-storage/` (`apps/web/Dockerfile`, `apps/web/nginx.conf`).

Publier une nouvelle version sans nouveau commit (la version est l'heure du build) :

```sh
gh workflow run deploy.yml --ref prod -f force=true
curl -s https://ysl.shinseo.fr/spike-storage/version.json
```

En local :

```sh
pnpm --filter @repo/spike-storage build
pnpm --filter @repo/spike-storage preview   # http://127.0.0.1:3103/spike-storage/
pnpm --filter @repo/spike-storage tailnet   # https://<mac>.<tailnet>.ts.net/spike-storage/
```

Le service worker et l'installation PWA exigent HTTPS (ou `127.0.0.1`).

Le spike partage l'origine de l'app : base Dexie `spike-storage`, dossier OPFS
`spike-storage`, journal dans la clé `localStorage` `spike-storage:journal`. Son service
worker ne contrôle que `/spike-storage/`.

Pour le retirer (le rapport dans `docs/spikes/` reste) : supprimer `apps/spike-storage` ; dans `apps/web/Dockerfile`, retirer
`--filter @repo/spike-storage...` de l'installation, `&& pnpm --filter @repo/spike-storage build`
et le `COPY` du `dist` du spike ; dans `apps/web/nginx.conf`, retirer les deux blocs
`/spike-storage/`. Puis `pnpm install` pour le lockfile. Sur les iPhone de test, supprimer
l'icône Spike S4.
