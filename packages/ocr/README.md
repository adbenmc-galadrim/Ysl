# @repo/ocr

OCR sur le téléphone (YSL-26) : PaddleOCR **PP-OCRv6 tiny** en WebAssembly par `onnxruntime-web` et `ppu-paddle-ocr`, la configuration retenue par le spike S3 (`docs/spikes/S3-ocr.md`), avec **Tesseract.js v7** (`fra` + `eng`, tessdata_fast) en repli derrière la même interface. Tout tourne dans un Web Worker, une photo à la fois, sessions préchauffées ; pas de WebGPU, pas de cloud (D9).

## Exports

| Export                | Contenu                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `@repo/ocr`           | Moteurs et fonctions pures : `PaddleEngine`, `TesseractEngine`, `prepare`, `fitWithin`, `toLine`, types `OcrLine`, `OcrBox`… |
| `@repo/ocr/worker`    | `OcrReader`, le client du Web Worker, et les types `OcrResult`, `OcrEngineInfo`.                                             |
| `@repo/ocr/recipient` | `recipientFromLines` seule, pour le fil principal : sans tirer les moteurs ni leurs dépendances.                             |
| `@repo/ocr/vite`      | Plugin `ocrVite()`, à poser dans `plugins` de la config Vite de l'app.                                                       |

## Modèles

Les modèles ne sont pas dans le dépôt : `pnpm --filter @repo/ocr models` les télécharge dans `models/` (ignoré par git) avec leur URL et leur sha256 épinglés (`scripts/fetch-models.ts`, PP-OCRv6 tiny depuis Hugging Face, `fra`/`eng` depuis `tessdata_fast`). La tâche turbo `models` les fournit avant `build` et `dev` de l'app ; en CI (`lint`, `check-types`, `test`), rien n'est téléchargé.

| Fichier                                         | Poids  |
| ----------------------------------------------- | ------ |
| `paddle/det.onnx`                               | 1,8 Mo |
| `paddle/rec.onnx`                               | 4,5 Mo |
| `paddle/dict.txt`                               | 27 ko  |
| `ort-wasm-simd-threaded.wasm`                   | 14 Mo  |
| `ort-wasm-simd-threaded.mjs` (glue des threads) | 24 ko  |
| `tesseract/fra.traineddata`                     | 1,1 Mo |
| `tesseract/eng.traineddata`                     | 4,1 Mo |
| `tesseract-core-simd-lstm.wasm.js`              | 3,9 Mo |

Les deux binaires (`ort-wasm-simd-threaded.wasm`, `tesseract-core-simd-lstm.wasm.js`) viennent de `node_modules`, pas de `models/`. Tous sont importés en `?url` et passent dans les assets fingerprintés de l'app ; seules les langues Tesseract sont publiées sous un chemin stable (`ocr/tesseract/<lang>.traineddata`), parce que tesseract.js compose lui-même ce chemin.

Les gros fichiers (modèles ONNX, binaire onnxruntime, cœur et langues Tesseract) ne sont **pas** dans le précache du service worker : `readerAssetUrls(base)` (`@repo/ocr/assets`) les liste, et l'app les télécharge au premier lancement dans son cache `courrier-models` avec une barre de progression (écran Préparation hors ligne, YSL-35) ; le service worker les sert ensuite depuis ce cache (`runtimeCaching` `CacheFirst` dans `apps/web/vite.config.ts`). Les petits (dictionnaire, glue `.mjs` des threads, worker tesseract.js) restent précachés.

## Usage dans le navigateur

```ts
import { OcrReader } from '@repo/ocr/worker';

const reader = new OcrReader();
await reader.warmup(); // charge et préchauffe le moteur ; { engine, threads, loadMs, fallbackReason? }
const { lines, engine, timings, wasmHeapBytes } =
  await reader.recognize(photoBlob);
reader.dispose();
```

- `recognize(blob)` traite une photo à la fois : les appels suivants attendent la réponse du précédent. Le Worker décode le blob avec son orientation EXIF, le réduit à 1 600 px de grand côté (`MAX_SIDE`) et rend les lignes (`text`, `box`, `score`) dans ce repère, avec `width`/`height` de l'image préparée et `sourceWidth`/`sourceHeight` de la photo.
- Le Worker charge Paddle au premier appel ; si Paddle ne démarre pas (session refusée, WASM refusé, mémoire), il passe à Tesseract et le dit dans `fallbackReason`. `reader.engine` donne le moteur en place.
- `dispose()` termine le Worker et rejette les lectures en attente. Une erreur du Worker, ou un silence au-delà de `timeoutMs` (60 s par défaut, `DEFAULT_TIMEOUT_MS`), rejette aussi les lectures en attente et remplace le Worker au prochain appel.
- `wasmHeapBytes` est une borne basse du pic mémoire (les tas WASM du Worker), pas le pic.

## Config Vite de l'app

```ts
import { ocrVite } from '@repo/ocr/vite';

export default defineConfig({
  plugins: [ocrVite()],
  worker: { format: 'es' },
});
```

`ocrVite()` :

- résout `onnxruntime-web` vers `onnxruntime-web/wasm`, le binaire CPU seul (14 Mo) : sans l'alias, `ppu-paddle-ocr/web` tirerait le binaire WebGPU (28 Mo) et les chemins WASM ne correspondraient plus. La condition `onnxruntime-web-use-extern-wasm` garde la glue `ort-wasm-simd-threaded.mjs` en fichier séparé (`?url`) : les threads sont des Workers qui chargent cette glue par URL, et si elle était fondue dans le bundle du Worker OCR, ils rechargeraient tout le Worker OCR et la première inférence ne répondrait jamais. nginx doit donc servir `.mjs` en JavaScript ;
- pose COOP `same-origin` / COEP `require-corp` en dev et en preview par middleware (les 304 compris : `preview.headers` les saute et WebKit refuse alors un deuxième Worker). Sans isolation, le WASM reste monothread ; en production, nginx les pose (`apps/web/nginx/isolation.conf`) ;
- sert les langues Tesseract en dev et les émet au build sous `ocr/tesseract/`.

Les threads WASM vont jusqu'à 4 (`MAX_WASM_THREADS`) quand la page est `crossOriginIsolated`, 1 sinon.

## Tests

`pnpm --filter @repo/ocr test` : fonctions pures (`fitWithin`, `toLine`, `recipientFromLines`, `once`) et client du Worker avec un faux Worker (file sérielle, repli annoncé, recréation après plantage ou délai dépassé). L'inférence réelle ne se joue pas en Node : elle se vérifie dans l'app (Chromium Playwright) et sur l'iPhone.
