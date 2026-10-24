# Spike S2 · codes-barres

Prototype jetable du spike S2 (cahier des charges v2, §10.1) : zxing-wasm mesuré sur le
corpus d'étiquettes par un banc d'essai Node, et une PWA iPhone qui compare le viseur et la
photo native sur les mêmes colis. Le protocole et les résultats sont dans
[`docs/spikes/S2-codes-barres.md`](../../docs/spikes/S2-codes-barres.md).

À supprimer quand la lecture des codes-barres de l'app (YSL-20) est livrée ; `src/decode/`
est la base à reprendre.

## Lancer

En production : https://ysl.shinseo.fr/spike-barcode/. L'image de `apps/web` construit le
spike et nginx le sert sous `/spike-barcode/` (`apps/web/Dockerfile`, `apps/web/nginx.conf`).

En local :

```sh
pnpm --filter @repo/spike-barcode build
pnpm --filter @repo/spike-barcode preview   # http://127.0.0.1:3105/spike-barcode/
pnpm --filter @repo/spike-barcode tailnet   # https://<mac>.<tailnet>.ts.net/spike-barcode/
```

`getUserMedia` et l'installation PWA exigent HTTPS : depuis le Mac, l'iPhone passe par
`tailscale serve`. Arrêter le partage : `tailscale serve --https=443 off`.

Le `.wasm` de zxing est servi par le spike lui-même (`dist/assets/`) : aucune requête vers
un CDN. Le journal est dans la clé `localStorage` `spike-barcode:journal`.

## Banc d'essai

```sh
pnpm --filter @repo/spike-barcode bench \
  --corpus ~/goinfre/ysl/tmp/corpus \
  --private ~/goinfre/ysl/tmp/corpus/real \
  --out ~/goinfre/ysl/tmp/spike-barcode
```

Le corpus se génère avec `@repo/corpus` (voir son README). `--limit <n>` et
`--variants a,b` restreignent le banc. Les photos HEIC sont converties par `sips` dans
`<out>/cache/`. Sorties : `results.json`, `results.md` (tableaux du rapport) et
`contents-2d.json`, qui contient les contenus bruts des codes, donc des données
personnelles : `--out` doit rester hors du dépôt. Le banc ne fait pas partie de
`pnpm test`.

## Retirer le spike

Supprimer `apps/spike-barcode` ; dans `apps/web/Dockerfile`, retirer
`--filter @repo/spike-barcode...` de l'installation, `&& pnpm --filter @repo/spike-barcode build`
et le `COPY` du `dist` du spike ; dans `apps/web/nginx.conf`, retirer les deux blocs
`/spike-barcode/`. Puis `pnpm install` pour le lockfile.

Le lecteur vit désormais dans `packages/barcode` : jusqu'à son retrait, le spike ne sert plus que de banc de mesure et de PWA de test sur iPhone.
