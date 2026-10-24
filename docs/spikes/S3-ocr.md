# Spike S3 · OCR sur l'iPhone

Ticket YSL-12. Cahier des charges v2, §4.2 et §10.1 ; rapport
[`04-ocr-ia-embarquee`](../research/04-ocr-ia-embarquee.md), §1 et §5. Vérifier que
PaddleOCR tient en mémoire et en temps sur l'iPhone, sinon basculer sur Tesseract v7.
Prototype : [`apps/spike-ocr`](../../apps/spike-ocr).

| Critère      | Seuil                                                   |
| ------------ | ------------------------------------------------------- |
| Temps        | p95 ≤ 5 s par photo                                     |
| Mémoire      | pic < 250 Mo                                            |
| Stabilité    | aucun plantage sur 50 photos d'affilée                  |
| Destinataire | ≥ 90 % dans le top 3, avant apprentissage               |
| Sinon        | plan B Tesseract v7 par zones ; cloud exclu au MVP (D9) |

## Ce que mesure le prototype

- **7 configurations** : PP-OCRv5 mobile (latin), PP-OCRv6 tiny et PP-OCRv6 small, chacun
  en WebGPU et en WASM (`onnxruntime-web`, 4 threads), et Tesseract.js v7 (`fra` + `eng`)
  en WASM. Une configuration chargée à la fois, dans un Web Worker, une photo à la fois.
- **Préparation** : orientation EXIF, réduction à 1 600 px de grand côté.
- **Temps** par photo (préparation, OCR, total) ; p50, p95, max par série.
- **Mémoire** : le tas WASM vu par l'app. C'est une borne basse : il ne compte ni la
  mémoire GPU ni le reste de la page. Le vrai pic se lit dans l'inspecteur web de Safari.
- **Plantage** : la série en cours est notée avant chaque photo ; une série non close est
  signalée au rechargement.
- **Destinataire** : chaque ligne OCR, seule ou avec la suivante, est rapprochée d'un
  annuaire fictif de 120 noms (homonymes proches compris) ; juste si le bon nom est dans
  le top 3. **Expéditeur** : juste si le texte OCR le contient à moins de 15 % de
  distance d'édition. Ni gabarit de transporteur, ni ancres, ni codes 2D : c'est l'OCR
  seul.

## Banc sur le Mac (corpus, 23/10/2026)

Tout le corpus (96 synthétiques, 143 web, 5 réelles), WebKit 26.5 sur un M5. Les temps du
Mac ne valent pas pour l'iPhone ; l'exactitude, si.

| Configuration   | Destinataire top 3 | Expéditeur |                   Tas WASM max |
| --------------- | -----------------: | ---------: | -----------------------------: |
| PP-OCRv6 tiny   |               70 % |       58 % | 241 Mo (WASM), 100 Mo (WebGPU) |
| PP-OCRv6 small  |               63 % |       57 % | 887 Mo (WASM), 338 Mo (WebGPU) |
| Tesseract v7    |               66 % |       46 % |                          68 Mo |
| PP-OCRv5 mobile |               60 % |       46 % |  430 Mo (WASM), 58 Mo (WebGPU) |

- WebGPU et WASM donnent exactement la même exactitude ; WebGPU est 2 à 3 fois plus
  rapide sur le Mac.
- Tesseract lit le mieux le destinataire des étiquettes web (91 %, contre 74 % au mieux
  pour Paddle), mais pas l'expéditeur.
- Points faibles communs : DPD (8 à 38 %) et DHL Express (0 à 54 %).

## Appareil

iPhone du test, Safari 27.0.1 (l'agent utilisateur annonce toujours `iPhone OS 18_7`), en
onglet et en navigation privée ; `crossOriginIsolated`, WebGPU (adaptateur `apple`),
4 cœurs annoncés, 4 threads WASM.

## Protocole

1. Ouvrir https://ysl.shinseo.fr/spike-ocr/ dans Safari.
2. Pour chaque configuration : recharger la page, lancer « Pack synthétique, 50
   premières », laisser finir ; un plantage s'affiche au rechargement.
3. Exporter le JSON.

Non fait : le pic mémoire dans l'inspecteur web (iPhone non branché au Mac) et la série
sur de vraies photos de la photothèque (pas de colis sous la main).

## Résultats sur l'iPhone (23/10/2026)

50 photos du pack synthétique par série.

| Configuration            | Issue             |    p50 |    p95 |    max | Tas WASM max | Destinataire top 3 | Expéditeur |
| ------------------------ | ----------------- | -----: | -----: | -----: | -----------: | -----------------: | ---------: |
| PP-OCRv6 tiny · WASM     | 50/50             | 630 ms | 770 ms | 840 ms |       171 Mo |               76 % |       62 % |
| PP-OCRv6 tiny · WebGPU   | 50/50             | 677 ms | 769 ms | 791 ms |        50 Mo |               76 % |       62 % |
| Tesseract v7 · WASM      | 50/50             | 272 ms | 392 ms | 414 ms |        59 Mo |               70 % |       54 % |
| PP-OCRv5 mobile · WASM   | 50/50             | 938 ms | 1,32 s | 1,42 s |       302 Mo |               52 % |       44 % |
| PP-OCRv6 small · WASM    | 50/50             | 1,46 s | 1,77 s | 1,96 s |       312 Mo |               60 % |       44 % |
| PP-OCRv5 mobile · WebGPU | plantage, photo 1 |      – |      – |      – |            – |                  – |          – |
| PP-OCRv6 small · WebGPU  | plantage, photo 1 |      – |      – |      – |            – |                  – |          – |

- Chargement du modèle : 1,6 à 2,4 s pour Paddle, 0,5 s pour Tesseract ; préchauffage
  0,1 à 1,5 s.
- Les deux plantages WebGPU arrivent après un chargement et un préchauffage réussis, sur
  la première vraie photo : Safari tue l'onglet. v5 mobile WebGPU a planté deux fois de
  suite.
- Sur v6 tiny, WebGPU n'apporte rien : même exactitude, temps équivalents (677 ms contre
  630 ms en WASM). Le prototype ne détecte pas un placement partiel des nœuds sur le
  processeur ; c'est une explication possible.
- La préparation (EXIF, 1 600 px) coûte moins de 25 ms.

## Verdict

**Go pour PP-OCRv6 tiny en WASM**, plan B Tesseract v7.

- **Temps** : tenu, et de loin : p95 de 0,8 s pour v6 tiny, 0,4 s pour Tesseract.
- **Stabilité** : tenue en WASM sur les 5 configurations ; **WebGPU écarté**, il tue
  l'onglet sur v5 mobile et v6 small et ne gagne rien sur v6 tiny.
- **Mémoire** : non mesurée au sens du critère. Borne basse : v6 tiny 171 Mo, Tesseract
  59 Mo, sous le seuil ; v5 mobile (302 Mo) et v6 small (312 Mo) le dépassent déjà,
  écartés.
- **Destinataire** : **non atteint** par l'OCR seul (76 % au mieux sur la synthèse, 70 %
  sur tout le corpus). L'écart se comble par la chaîne complète : codes 2D d'abord,
  gabarits et ancres ensuite.

## Conséquences

- **YSL-26 (OCR sur le téléphone)**, livré dans `packages/ocr`
  (`docs/architecture/ocr.md`) : PP-OCRv6 tiny en WASM, sessions préchauffées,
  pas de WebGPU. Reprendre de `apps/spike-ocr` le worker, l'hébergement des modèles
  (URL et sha256 épinglés), COOP/COEP et la sonde de mémoire. Garder Tesseract v7 comme
  repli derrière la même interface.
- **Exactitude** : le destinataire passe d'abord par les codes 2D (YSL-25 : Aztec GeoPost,
  PDF417 FedEx, MaxiCode UPS portent le destinataire), puis par l'OCR guidé par le
  gabarit du transporteur et les ancres (`DESTINATAIRE`, `SHIP TO`…). Viser DPD et
  DHL Express en priorité.
- **YSL-27 (banc d'essai)** : partir du banc Mac du spike (`pnpm --filter @repo/spike-ocr
bench`) pour mesurer la chaîne complète, pas l'OCR seul.
- **À vérifier dans YSL-26** : le vrai pic mémoire (inspecteur web, iPhone branché) et
  les temps sur de vraies photos d'iPhone (12 à 48 Mpx, HEIC), dont le décodage coûte
  plus que les JPEG du pack ; un test en PWA installée.
- **D9 (cloud)** : rien dans ces mesures ne justifie de rouvrir l'OCR dans le cloud.
- **Retrait** : supprimer `apps/spike-ocr` une fois YSL-26 livré ; procédure dans son
  README.
