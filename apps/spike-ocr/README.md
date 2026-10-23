# @repo/spike-ocr — spike S3 : OCR sur l'iPhone (YSL-12)

Prototype jetable : quels moteurs OCR tournent sur l'iPhone, à quelle vitesse, avec quelle
mémoire et quelle exactitude. Pas de serveur, pas de cloud : tout se passe dans le navigateur.

En production : https://ysl.shinseo.fr/spike-ocr/. L'image de `apps/web` génère le pack de
photos, télécharge les modèles, construit le spike, et nginx le sert sous `/spike-ocr/`
(`apps/web/Dockerfile`, `apps/web/nginx.conf`).

## En local

```sh
pnpm --filter @repo/spike-ocr assets     # pack synthétique + modèles + runtime (une fois)
pnpm --filter @repo/spike-ocr build
pnpm --filter @repo/spike-ocr preview    # http://127.0.0.1:3106/spike-ocr/
pnpm --filter @repo/spike-ocr dev        # idem, avec `assets` joué avant
pnpm --filter @repo/spike-ocr tailnet    # HTTPS pour l'iPhone, via Tailscale
```

`assets` écrit dans `public/` (ignoré par git) : `corpus/` (96 étiquettes synthétiques et leur
vérité terrain, générées par `@repo/corpus`, graine fixe), `models/` (modèles et données
Tesseract, URL et sha256 épinglés dans `scripts/fetch-models.ts`), `runtime/` (copie des
fichiers `.wasm` / `.mjs` d'onnxruntime-web et du cœur Tesseract). Aucun appel à un CDN à
l'exécution. Les photos web et réelles du corpus ne sont jamais servies.

L'isolation cross-origin (COOP `same-origin`, COEP `require-corp`) est posée par Vite
(dev et preview, 304 compris) et par nginx. Sans elle, le WASM reste monothread.

## Les 7 configurations

| Configuration                           | Détection                        | Reconnaissance                                       | Dictionnaire             |
| --------------------------------------- | -------------------------------- | ---------------------------------------------------- | ------------------------ |
| PP-OCRv5 mobile (latin) · WebGPU / WASM | `PP-OCRv5_mobile_det_infer.onnx` | `latin_PP-OCRv5_mobile_rec_infer.onnx`               | `ppocrv5_latin_dict.txt` |
| PP-OCRv6 tiny · WebGPU / WASM           | `PP-OCRv6_tiny_det.onnx`         | `PP-OCRv6_tiny_rec.onnx`                             | `ppocrv6_tiny_dict.txt`  |
| PP-OCRv6 small · WebGPU / WASM          | `PP-OCRv6_small_det.onnx`        | `PP-OCRv6_small_rec.onnx`                            | `ppocrv6_dict.txt`       |
| Tesseract.js v7 · fra+eng · WASM        | —                                | `fra.traineddata`, `eng.traineddata` (tessdata_fast) | —                        |

Les modèles Paddle viennent du dépôt Hugging Face `snowfluke/ppu-paddle-ocr-models` (révision
épinglée) via `ppu-paddle-ocr/web`. Le v5 « mobile » est la variante latine, dont le
dictionnaire couvre les accents français. Une seule configuration est chargée à la fois ; un
worker neuf est créé pour chaque série.

Choix à connaître :

- Une configuration WebGPU qui échoue (adaptateur absent, session refusée, délai de 90 s) est
  un **résultat** (« échec du chargement ») ; il n'y a aucun repli vers WASM.
- onnxruntime-web sert le même binaire (`jsep`) aux deux backends : « WASM » désigne le
  fournisseur d'exécution CPU de ce binaire.
- Les fichiers de langue Tesseract sont les modèles « fast » (légers) ; les « best » pèsent
  quatre fois plus.
- Le tas WASM est lu en suivant les `WebAssembly.Memory` du worker (et de celui de Tesseract,
  par `public/tesseract-probe.js`). C'est une borne basse du pic mémoire, pas le pic.

## Mesures et exactitude

Par photo : préparation (décodage avec orientation EXIF, réduction à 1 600 px de grand côté
sur `OffscreenCanvas`), détection + reconnaissance, total, tas WASM. Le chargement du modèle et
le préchauffage (une inférence à blanc) sont hors des statistiques. Par série : p50, p95 (rang
le plus proche), max, échecs exclus des temps.

- **Destinataire** : chaque ligne OCR et chaque paire de lignes consécutives est rapprochée
  (distance d'édition sur sous-chaîne, ordre prénom/nom inversé accepté) d'un annuaire fictif
  de 120 entrées (destinataires distincts du corpus, complétés de noms inventés dont des
  homonymes à une lettre). Juste si la vérité est dans le top 3 (score ≥ 0,6).
- **Expéditeur** : juste si la vérité, normalisée (majuscules, sans accents, ponctuation ni
  espaces), se retrouve dans le texte OCR à une distance d'édition ≤ 15 % de sa longueur.
- Les étiquettes dont le champ vaut `null` sortent du dénominateur de ce champ ; une photo en
  échec compte comme fausse.
- Sans gabarit transporteur ni ancre (c'est YSL-26).

Un plantage est détecté au rechargement : la série en cours est écrite dans `localStorage`
(`spike-ocr:run`) avant chaque photo ; une série non close est signalée « plantage ou onglet
tué à la photo n de la configuration X », et ses photos déjà mesurées sont conservées.

## Protocole iPhone

1. Ouvrir https://ysl.shinseo.fr/spike-ocr/ dans Safari ; noter `crossOriginIsolated`, WebGPU,
   l'adaptateur, les threads, le modèle d'iPhone.
2. Brancher l'iPhone au Mac, Safari › Développement › (iPhone) › la page, onglet Timeline,
   piste mémoire en enregistrement.
3. Pour chacune des 7 configurations : recharger la page, choisir la configuration et « Pack
   synthétique, 50 premières », lancer ; noter le pic mémoire de la Timeline ; la série doit
   finir sans plantage.
4. Recommencer la meilleure configuration Paddle et Tesseract sur 10 à 20 vraies photos
   importées de la photothèque (elles ne quittent pas l'iPhone : seuls temps, mémoire et
   plantages comptent).
5. « Exporter le JSON » (AirDrop vers le Mac) et le renvoyer, avec les pics mémoire notés.

## Banc sur le Mac

```sh
pnpm --filter @repo/spike-ocr bench                      # tout le corpus, WebKit et Chromium
pnpm --filter @repo/spike-ocr bench --limit 10 --browsers webkit --configs tesseract-v7-wasm
```

Options : `--corpus` (défaut `~/goinfre/ysl/tmp/corpus`, avec `synthetic/`, `web/`, `real/`),
`--out` (défaut `~/goinfre/ysl/tmp/spike-ocr`), `--browsers`, `--configs`, `--sources`,
`--limit` (par source), `--no-build`. Le banc construit l'app, la sert en preview sur le port
3106, passe toutes les photos par la page (comme l'import de la photothèque) pour chaque
navigateur et chaque configuration, puis écrit `banc-mac.md` et `banc-mac.json`. Les photos
réelles HEIC sont converties en JPEG par `sips` ; leur texte n'est pas conservé. Chromium est
lancé en mode « nouveau headless » avec `--enable-unsafe-webgpu --use-angle=metal` pour avoir
un vrai adaptateur WebGPU. Les temps du Mac ne valent pas pour l'iPhone : seule l'exactitude
compte.

## Retrait

Supprimer `apps/spike-ocr` ; dans `apps/web/Dockerfile`, retirer l'installation des polices
(`apt-get`), `--filter @repo/spike-ocr...`, `&& pnpm --filter @repo/spike-ocr assets && pnpm
--filter @repo/spike-ocr build` et le `COPY` du `dist` du spike ; dans `apps/web/nginx.conf`,
retirer le bloc `/spike-ocr/` ; dans `pnpm-workspace.yaml`, retirer `protobufjs` et
`tesseract.js` de `allowBuilds` ; dans `.gitignore`, retirer les trois lignes
`apps/spike-ocr/public/…`. Puis `pnpm install` pour le lockfile.

Restent en place : `playwright` au catalog de `pnpm-workspace.yaml` (aussi utilisé par
`packages/ui`) et les `exports` de `packages/corpus` (`./schema`, `./random`, `./identities`),
sans effet une fois le spike retiré.

Le spike partage l'origine de l'app : ses clés `localStorage` sont préfixées `spike-ocr:`.
