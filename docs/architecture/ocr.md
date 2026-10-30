# OCR sur le téléphone : PaddleOCR en WASM, Tesseract en repli

Ticket YSL-26 (F17, lot L1). Le destinataire et l'expéditeur ne sont souvent que dans le
texte imprimé : après les codes-barres, chaque photo passe par un OCR neuronal, sur
l'iPhone, sans cloud (D9). Fondé sur le verdict du spike S3
([`docs/spikes/S3-ocr.md`](../spikes/S3-ocr.md)) : **PP-OCRv6 tiny en WASM**, WebGPU
écarté (il tue l'onglet sur les autres modèles et ne gagne rien sur celui-ci), Tesseract v7
gardé en plan B derrière la même interface.

## Le package `@repo/ocr` (`packages/ocr/`)

- `engines/` : une interface `OcrEngine` (`load`, `recognize(canvas)`, `dispose`) et deux
  moteurs. `PaddleEngine` charge les trois fichiers du modèle (détection, reconnaissance,
  dictionnaire) et les confie à `ppu-paddle-ocr/web` (post-traitement DB et CTC inclus) sur
  le fournisseur `wasm` d'`onnxruntime-web` ; un repli de session est une erreur, pas un
  silence. `TesseractEngine` enveloppe `tesseract.js` (`fra` + `eng`, tessdata_fast, LSTM
  seul). Les deux rendent des lignes `{ text, box, score }`.
- `engines/prepare.ts` : décodage avec l'orientation EXIF, réduction à **1 600 px** de grand
  côté (`MAX_SIDE`, la taille mesurée au spike), canevas de préchauffage.
- `worker/ocr.worker.ts` : un Worker ES, **une photo à la fois**. Au premier message il
  charge Paddle et joue une inférence à blanc (sessions préchauffées) ; si Paddle ne démarre
  pas sur l'appareil, il passe à Tesseract et le dit (`fallbackReason`). Chaque résultat
  porte les temps (préparation, OCR) et une borne basse du pic mémoire (les tas WASM du
  Worker, `wasmHeapBytes`).
- `worker/client.ts` : `OcrReader`, le client côté page, sur le modèle de `BarcodeDecoder` :
  file sérielle, `warmup()` pour charger avant la première photo, Worker recréé après un
  plantage, `dispose()`.
- `recipient.ts` : `recipientFromLines`, le nom du destinataire lu par l'OCR seul : la ligne
  qui suit une ancre (`DESTINATAIRE`, `SHIP TO`, `DELIVER TO`, `CONSIGNEE`, `À :`…) ou le
  reste de cette ligne, si elle ressemble à un nom de personne (2 à 4 mots en lettres, sans
  chiffre, sans forme juridique ni mot de voie, civilités retirées) ; jamais au-delà d'une
  ancre d'expéditeur ; `null` plutôt qu'une supposition sans ancre.
- `sender.ts` : `senderFromLines`, le nom de l'expéditeur (société ou personne, 1 à 6 mots,
  au moins trois lettres, sans ligne d'adresse, de téléphone ni de référence) sous une
  ancre d'expéditeur (`EXPÉDITEUR`, `EXP`, `FROM`, `SHIPPER`, `SENDER`, `SHIP FROM`,
  `ABSENDER`, `RETURN ADDRESS`, `RETOUR`), jamais au-delà d'une ancre de destinataire.
- `blocks.ts` : ce que les deux lecteurs partagent (repli des accents, ancres, listes de
  mots de voie et de formes juridiques, découpe des lignes).
- `vite.ts` : `ocrVite()`, tout ce que la config Vite de l'app doit savoir (voir plus bas).

## Les modèles

Hors du dépôt : `pnpm --filter @repo/ocr models` (`scripts/fetch-models.ts`) télécharge dans
`packages/ocr/models/` PP-OCRv6 tiny (Hugging Face, révision épinglée) et `fra`/`eng`
(`tessdata_fast`, commit épinglé), chaque fichier vérifié par son sha256, trois tentatives.
La tâche turbo `models` les fournit avant `build` et `dev` de `@repo/web`
(`apps/web/turbo.json`) et le `Dockerfile` la joue avant le build ; la CI (`lint`,
`check-types`, `test`) ne télécharge rien.

Dans l'app, les fichiers sont importés en `?url` : assets fingerprintés. Les gros (modèles
ONNX, binaire d'onnxruntime, cœur et langues Tesseract) ne sont **pas** dans le précache du
service worker : `readerAssetUrls()` (`@repo/ocr/assets`) les liste, l'app les télécharge au
premier lancement dans son cache `courrier-models` avec une progression par fichier (écran
Préparation hors ligne, `apps/web/src/features/offline`), et une route `CacheFirst` du
service worker les sert depuis ce cache. Seuls les petits (`dict.txt`, glue `.mjs` des
threads, worker tesseract.js) restent précachés.

| Fichier                                  |  Poids |
| ---------------------------------------- | -----: |
| `ort-wasm-simd-threaded.wasm` (CPU seul) |  14 Mo |
| `rec.onnx` + `det.onnx` + `dict.txt`     | 6,3 Mo |
| `tesseract-core-simd-lstm.wasm.js`       | 3,9 Mo |
| `eng.traineddata` + `fra.traineddata`    | 5,2 Mo |

Soit ≈ 30 Mo téléchargés à la préparation, en plus du précache (budget §5.4 : 30 à 55 Mo code et modèles compris).
Seules les langues Tesseract sortent sous un chemin stable (`ocr/tesseract/<lang>.traineddata`,
émises par le plugin) parce que tesseract.js compose lui-même ce chemin.

## Ce que `ocrVite()` règle

- `onnxruntime-web` → `onnxruntime-web/wasm` (alias) : le binaire CPU seul, 14 Mo au lieu
  des 28 Mo du binaire WebGPU que `ppu-paddle-ocr/web` tirerait par défaut.
- Condition `onnxruntime-web-use-extern-wasm` : la glue `ort-wasm-simd-threaded.mjs` reste
  un fichier à part (`?url`). Les threads WASM sont des Workers qui chargent cette glue par
  URL ; fondue dans le bundle du Worker OCR, ils rechargeaient tout le Worker OCR et la
  première inférence ne répondait jamais (vu au build de preview). nginx sert donc `.mjs`
  en JavaScript dans `/assets/` (WebKit refuse un module en `octet-stream`).
- COOP `same-origin` / COEP `require-corp` en dev et en preview, par middleware (les 304
  compris) : sans isolation, un seul thread. En production, `nginx/isolation.conf`.
- Threads : `min(4, hardwareConcurrency)` quand la page est `crossOriginIsolated`, 1 sinon.

## Dans l'écran Scan (`apps/web`)

Après la lecture des codes (`readDraft`), et hors de la place de la `DecodeQueue` (qui borne
les bitmaps 12 Mpx), `readText` (`features/scan/text.ts`) passe au Worker OCR le **JPEG
déjà stocké** (1 600 px : aucune image supplémentaire en mémoire). Le brouillon reçoit
`ocrLines` (toutes les lignes, dans le repère de l'image de travail), `ocrName` et
`ocrState` (`pending`, `done`, `failed`, et `skipped` quand il n'y a rien à lire : numéro
saisi à la main, photo absente ou impossible à ouvrir). L'OCR se joue même quand le Worker
des codes a échoué : la photo, elle, est valide. Un échec de l'OCR ne touche jamais
`reading` : les codes ont déjà dit ce qu'ils pouvaient. Ces lignes vivent sur le brouillon
le temps du lot : « Terminer » ne promeut que `readName` dans `parcel` ; le diagnostic
F22, le banc YSL-27 et YSL-46 les consommeront avant la promotion ou lui ajouteront une
colonne. Le texte n'entre pas dans le
travail que « Terminer » attend (`trackWork`) : le lot se ferme sur les codes, et un Worker
muet au-delà de 60 s (`DEFAULT_TIMEOUT_MS`) est remplacé.

Deux noms, deux confiances (§4.3, §4.4) :

- `readName` : le destinataire qu'un **code 2D structuré** nomme (rang 1, 0,97) ; il
  s'affiche tel quel et compte pour promouvoir le colis en `recu`.
- `ocrName` : le nom que l'OCR **suppose** (rang 7, 0,40) ; il s'affiche avec un « ? »
  (« Camille Morel ? ») dans le champ Destinataire, avec un statut d'attention, et dans
  « Dernier ajouté » ; sans aucun code lu, ce champ est le seul affiché. Il ne promeut
  rien : le colis sort en `a_completer` tant qu'un agent ou l'annuaire (YSL-46) ne l'a pas
  confirmé.

Le Worker OCR est préchauffé à l'ouverture de l'écran Scan et gardé pour la session, comme
la caméra et le Worker des codes. À la reprise d'un lot (`recoverPending`), les brouillons
dont les codes ont atterri mais pas le texte sont relus par l'OCR seul.

## Mesures (Chromium Playwright sur le Mac, build de preview, étiquettes synthétiques)

| Étape                               |     Mesure |
| ----------------------------------- | ---------: |
| Chargement + préchauffage de Paddle |      0,4 s |
| OCR d'une photo (4 threads)         | 170–240 ms |
| Tas WASM après trois photos         |     170 Mo |

Sur l'iPhone, S3 a mesuré 630 ms médians et 770 ms au p95 par photo pour cette
configuration, tas 171 Mo. Restent à vérifier sur un vrai iPhone (inspecteur web branché) :
le vrai pic mémoire, le temps sur des photos HEIC de 12 à 48 Mpx importées de la
photothèque, et le comportement en PWA installée.

## Ce qui attend d'autres tickets

Orientation globale et redressement de perspective (§4.2, étapes 4 et 5), gabarits de
transporteur et ancres positionnées, rapprochement avec l'annuaire et trois suggestions
(YSL-46), banc de mesure de la chaîne complète (YSL-27), écran « Voir ce qui a été lu »
(F22), gabarit du bloc expéditeur par transporteur et adresse de l'expéditeur (seul le nom
est lu, YSL-40).
