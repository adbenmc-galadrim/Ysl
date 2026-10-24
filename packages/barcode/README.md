# @repo/barcode

Lecteur de codes-barres 1D et 2D (Code 128, Data Matrix, QR, MaxiCode, etc.) fondé sur `zxing-wasm`, partagé par l'app web, les tests Node et le futur banc de mesure. Le `.wasm` est auto-hébergé : le CDN par défaut de `zxing-wasm` n'est jamais utilisé.

## Exports

| Export                 | Contenu                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `@repo/barcode`        | Fonctions pures et types : `readSymbols`, `initZxing`, `decodeSource`, `planTiles`, `readTiles`, `readMaxiCode`… |
| `@repo/barcode/worker` | `BarcodeDecoder`, le client du Web Worker de décodage.                                                           |
| `@repo/barcode/node`   | `initZxingNode`, qui charge le `.wasm` depuis `node_modules` (tests, scripts).                                   |
| `@repo/barcode/vite`   | Plugin `withoutCdn`, à poser dans `worker.plugins` de Vite.                                                      |

## Usage dans le navigateur

```ts
import { BarcodeDecoder } from '@repo/barcode/worker';

const decoder = new BarcodeDecoder();
const bitmap = await createImageBitmap(file, {
  imageOrientation: 'from-image',
});
const { symbols, steps, totalMs } = await decoder.decode(bitmap);
decoder.dispose();
```

- `decode(bitmap, { thorough?, expect? })` traite une image à la fois : les appels suivants attendent la réponse du précédent. `expect` (liste de formats) arrête la cascade dès qu'ils sont tous lus ; c'est la seule forme d'`enough` qui passe par `postMessage`. Le `bitmap` est transféré au Worker, qui le ferme.
- `dispose()` termine le Worker et rejette les lectures en attente. Une erreur du Worker rejette aussi les lectures en attente ; le Worker est recréé au prochain appel.
- Côté Vite, le Worker est chargé par `new Worker(new URL('./decode.worker.ts', import.meta.url), { type: 'module' })` et la config doit contenir :

```ts
import { withoutCdn } from '@repo/barcode/vite';

export default defineConfig({
  worker: { format: 'es', plugins: () => [withoutCdn()] },
});
```

## La cascade

`decodeSource(source, { enough?, thorough? })` joue des passes de plus en plus coûteuses et s'arrête dès que `enough(symbols)` est vrai (par défaut : au moins un symbole lu) :

1. `whole-1600` : image entière réduite à 1 600 px de grand côté ;
2. `whole-2400` : réduite à 2 400 px (seulement si le grand côté dépasse 1 600 px) ;
3. `tiles` : tuiles en pleine résolution, avec recouvrement ;
4. `maxicode` : recadrage et redressement du MaxiCode (sautée si un MaxiCode est déjà lu).

`thorough: true` joue toutes les passes (diagnostic, banc) ; `enoughFormats(formats)` construit le prédicat « tous ces formats sont lus ». Chaque passe lit jusqu'à 8 symboles. Les positions sont ramenées au repère de l'image d'origine.

`RasterSource` (`{ width, height, raster(maxSide) }`) abstrait la source des pixels : le Worker la construit sur un `ImageBitmap` avec un `OffscreenCanvas`, les tests sur un tableau de pixels.

## Dans Node

```ts
import { decodeSource, readSymbols } from '@repo/barcode';
import { initZxingNode } from '@repo/barcode/node';

await initZxingNode();
const symbols = await readSymbols({ data, width, height });
```

## Limites

- Une image à la fois dans le Worker (mémoire de Safari sur iPhone).
- Un canvas ne dépasse pas 16,7 Mpx : au-delà, l'image est réduite avant lecture.
- Le MaxiCode doit être net ; la perspective (photo de biais) n'est pas corrigée.
- `BarcodeDetector` n'est jamais utilisé (absent d'iOS).
