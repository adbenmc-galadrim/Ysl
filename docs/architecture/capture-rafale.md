# Capture en rafale : flux caméra, lot en cours, colis brouillon

Ticket YSL-23 (F02, lot L1). Un appui = un colis : la caméra reste ouverte pendant tout le
lot, l'agent n'attend ni confirmation ni lecture entre deux colis. Fondé sur le verdict du
spike S1 ([`docs/spikes/S1-camera-rafale.md`](../spikes/S1-camera-rafale.md)) : la rafale
dans le viseur, sur un flux unique, est le mode principal ; la photo native reste le repli.

## Un seul flux caméra (`apps/web/src/features/camera/`)

- `stream.ts` : `cameraStream`, singleton de module. Un seul `getUserMedia` par session
  d'app (`facingMode: environment`, 4032 × 3024 idéal) ; l'écran Scan lui confie son
  `<video>` (`attach`), le lui rend en partant (`detach`) **sans fermer le flux** : iOS
  redemande l'autorisation à chaque nouveau `getUserMedia` (S1). Au retour au premier plan
  (`visibilitychange`, `pageshow`), la vidéo est relancée ; le flux n'est rouvert que si la
  piste est `ended`. États : `idle`, `starting`, `live`, `denied`, `blocked`
  (`useCameraState`). `denied` est un refus (`NotAllowedError`, `SecurityError`) : la
  sortie passe par Réglages ; `blocked` est tout autre échec (pas de caméra, occupée).
  `cameraPermission()` lit `navigator.permissions` sans déclencher la boîte iOS.
- `capture.ts` : `grabFrame` (`ImageCapture.grabFrame`, repli `createImageBitmap(video)`),
  `encodePhoto` (JPEG, grand côté 1 600 px, qualité 0,8 : §6.6), `fitWithin`.
- `entry.ts` : le drapeau `courrier.camera.explained` (`localStorage`) et `cameraEntry` :
  l'écran d'explication ne se montre qu'une fois par appareil, jamais si la permission est
  déjà `granted`.

## Autorisation et refus (YSL-29, `routes/_authenticated/scan.tsx`)

Trois écrans se relaient avant le viseur, dessinés dans `@repo/ui`
(`screens/demarrage/camera-permission-screen.tsx`) :

1. **Autoriser la caméra** : au premier lancement, avant tout `getUserMedia`, parce que la
   boîte d'iOS arrive sans contexte. « Autoriser » pose le drapeau et attache la vidéo (ce
   qui ouvre la caméra) ; « Importer une photo à la place » pose le drapeau, passe en
   **repli** et ouvre le sélecteur de fichier.
2. **La caméra est bloquée** : dès que l'état est `denied`, plein écran, avec les étapes
   Réglages (la dernière cite `PUBLIC_APP_NAME`). « J'ai réautorisé, réessayer » rappelle
   `getUserMedia` ; « Une photo » et « Au clavier » passent en repli.
3. **Le viseur** (`ScanScreen`) : en repli, la caméra ne se rouvre jamais seule (un nouvel
   appel redemanderait l'autorisation), l'encart `blocked` porte « Caméra non activée /
   Activer la caméra » (`idle`), « Caméra refusée » (`denied`) ou « iOS a bloqué la
   caméra » (`blocked`), toujours avec « Importer une photo ».

Le repli est l'état d'un écran, pas de l'appareil : rouvrir Scan refait le chemin normal,
et « Réessayer » ou « Activer la caméra » le lève, de sorte qu'un nouveau refus remontre
l'écran plein et ses étapes. Le choix de l'encart est une fonction pure (`notice.ts`,
`cameraReading`).

« Au-dessus du routeur » (§6.4) : le routeur n'a pas d'onglets persistants (chaque écran
est une route), le flux survit donc dans le singleton, pas dans un composant.

## Le pipeline d'un appui (`routes/_authenticated/scan.tsx`)

1. Une place dans la file de décodage (`DecodeQueue`, **2 en vol** au plus : un bitmap de
   12 Mpx pèse ~48 Mo) ; au-delà, l'appui attend la fin de la plus ancienne lecture. La
   place couvre toute la lecture d'un appui, seconde passe comprise : jamais plus de deux
   images pleine résolution vivantes.
2. `grabFrame` en pleine résolution, un clone pour la photo et une éventuelle seconde passe.
3. Le lot ouvert (ou un nouveau), la photo encodée et écrite dans OPFS, puis le **brouillon**
   (`draft_parcel`, `reading: 'pending'`) : le compteur monte avant toute lecture.
4. Décodage dans le Worker (`@repo/barcode`), cascade par défaut (arrêt dès qu'un code est
   lu). Si le suivi lu désigne un transporteur dont les symboles attendus manquent
   (`CARRIER_FORMATS` : UPS → MaxiCode ; FedEx → PDF417 ; Colissimo, Chronopost, DPD →
   Aztec ; DHL Express, DHL Paket, Deutsche Post → Data Matrix ; La Poste → Data Matrix
   seul), une **seconde passe** `expect` relit le clone jusqu'à les trouver.
5. Le brouillon reçoit le résultat (`read` / `unreadable` / `failed`, transporteur, suivi,
   symboles bruts) ; l'écran affiche les champs lus (sauf si le brouillon a été annulé
   entre-temps), le panneau « Dernier ajouté » suit la base (`useLiveQuery`).
6. Une fois la place rendue, l'OCR (`@repo/ocr`, voir `ocr.md`) relit le JPEG stocké et
   dépose ses lignes et le nom supposé sur le brouillon ; le champ Destinataire se met à
   jour si l'écran montre encore ce colis. « Terminer » n'attend pas cette étape.

Le Worker (`features/scan/decoder.ts`) et la liste des lectures en vol (`reader.ts`) vivent
au niveau du module, comme la caméra : une lecture en vol quand l'agent quitte l'écran se
termine et atterrit dans son brouillon, et « Terminer » l'attend même après un retour sur
l'écran. À l'ouverture d'un lot repris après une relance de l'app, les brouillons restés
`pending` sont relus depuis leur photo (`recoverPending`), ou marqués `failed` sans photo.

Le suivi vient de `@repo/contract/tracking` (`trackingsInBarcode` puis `validateTracking`
sur chaque code : le plus sûr gagne, un code rejeté ne compte pas) ; les champs structurés
des codes 2D viennent de `@repo/contract/codes` ; le nom lu vient d'un code 2D structuré
(`readName`), sinon l'OCR le suppose (`ocrName`, affiché avec un « ? »).

### Coût mesuré du décodage (banc Mac, Node, étiquette synthétique UPS 3 000 × 4 000)

| Variante                     | Total  | Passes                                                 |
| ---------------------------- | ------ | ------------------------------------------------------ |
| cascade par défaut           | 17 ms  | `whole-1600` (Code 128 lu)                             |
| `expect` Code 128 + MaxiCode | 286 ms | `whole-1600` 17 ms, `whole-2400` 36 ms, `tiles` 233 ms |
| `thorough`                   | 281 ms | les mêmes trois passes                                 |

`thorough` coûte ce que coûtent les tuiles pleine résolution : ~270 ms sur le Mac, soit
0,8 à 1,4 s attendus sur l'iPhone (S2 : × 3 à × 5). La rafale ne l'utilise pas : le
décodage tourne en arrière-plan, la cadence des appuis ne dépend que de la capture
(≈ 250 ms, S1) et de la borne de 2 lectures en vol. La seconde passe `expect` ne se joue
que pour les transporteurs à code 2D utile. `thorough` reste pour la revue de lot
(YSL-33) ou le banc (YSL-27), quand le temps ne compte plus.

## La saisie manuelle (`features/scan/typed.ts`, F04)

Une étiquette illisible ne bloque pas le lot : la touche clavier de la barre d'outils, ou
« Saisir le numéro » sur l'avis « Aucun code lu », ouvre la feuille « Saisir le numéro »
(`SaisieManuelleSheet` de `@repo/ui`, posée en `fixed` à côté de l'écran : la vidéo reste
montée). Le pavé est dédié, jamais le clavier système ; sa touche « ABC » bascule sur les
lettres que portent UPS (`1Z…`), Colissimo (`8J…`), Chronopost ou La Poste.

- Le verdict s'affiche **en direct** sous le champ, par `validateTracking` sans contexte :
  `sure` → « Format FedEx reconnu » ; `to-verify` → « Format DHL Express probable » (clé
  juste, contexte absent) ou « Plusieurs formats possibles » ; clé fausse → « Clé de
  contrôle incorrecte » ; rien tant qu'aucun format ne reconnaît le numéro (l'état normal en
  cours de frappe).
- **Rien n'est refusé** : le numéro saisi fait foi (§4.5, saisie de l'agent = 1,00). Le
  transporteur est celui du verdict : désigné par un format et sa clé (`sure`), ou par le
  format seul quand la clé n'est pas un critère (`to-verify` : Chronopost, La Poste, GLS,
  DHL sans contexte, TNT) ; un format inconnu n'en désigne aucun. Un numéro mal tapé peut
  ainsi passer pour le format sans clé de même longueur (une FedEx à un chiffre près lit
  « Format GLS probable, ou clé incorrecte », comme un vrai Chronopost face à la clé S10,
  §4.6) : l'indication le dit, et l'agent ou la revue de lot tranche. Sans transporteur,
  le colis sortira en « À compléter ».
- Sans avis à l'écran, la saisie crée un **brouillon sans photo** (`typeDraft`,
  `reading: 'typed'`, `photoId: null`) ; tant que l'avis « Aucun code lu » est affiché,
  la touche clavier comme le bouton de l'avis **complètent le brouillon illisible** en
  place (`updateDraft`, la photo reste), jamais un second colis. Un brouillon `typed` est réglé
  d'emblée : la reprise après relance ne le relit pas.

## Le lot en cours (`features/batch/store.ts`, schéma Dexie version 2)

Deux tables locales, **sans outbox** : `draft_batch` (`id, startedAt`) et `draft_parcel`
(`id, batchId, createdAt, trackingNorm`). Un seul lot à la fois, et un lot brouillon n'est
jamais « fermé » : il disparaît à la promotion. Rouvrir `/scan` reprend donc le lot laissé
là (compteur, dernier ajouté).

- **Annuler** (`undoLast`) retire le dernier brouillon et sa photo.
- **Terminer** (`finishBatch`) écrit en une transaction, par `commitLocal`, une ligne `batch`
  et une ligne `parcel` par brouillon (`recu` avec transporteur, suivi **et** nom lu par un
  code 2D ; un nom seulement supposé par l'OCR laisse le colis en `a_completer` ;
  `receivedAt` = instant de l'appui,
  `receivedBy` = agent), rattache les photos
  (`photo.parcelId`), supprime les brouillons et renvoie à la liste des colis. Un lot vide
  ne laisse rien. La revue de lot (YSL-33) s'insérera entre Terminer et cette promotion.
- La croix ferme l'écran sans toucher au lot.

Pendant le lot, le bandeau de mise à jour est retenu (`holdUpdates`, F47 : « jamais pendant
un lot »).

## Ce qui attend d'autres tickets

Doublon dans le lot et en base (YSL-37, l'index `trackingNorm` des brouillons est posé),
choix du transporteur à la main quand le format est ambigu (revue de lot, YSL-33), champs
des codes 2D (YSL-25), torche (YSL-29), photo native
`capture` et import multiple (YSL-30), liste du lot et revue (YSL-33), synchronisation des
lignes promues (YSL-28), bip et flash à la capture (§6.6).
