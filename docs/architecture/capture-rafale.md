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

## Photo native et import de la photothèque (YSL-30, F03)

Quand le flux ne vient pas, la photo reste possible par les sélecteurs du système, qui ne
demandent rien à Safari. Deux `<input type="file">` vivent **hors des écrans**, montés une
seule fois (un sélecteur ouvert depuis un écran qui se démonte perdrait son `change`) :

- **`capture="environment"`** : l'appareil photo d'iOS, une photo. C'est ce que fait
  l'**obturateur** dès que la caméra ne filme pas — refus, panne, ou repli choisi
  (`shutter.ts`, `shutterMode` : `grab` en `live`, `native` en `denied` / `blocked` / `idle`
  en repli, `none` pendant l'activation pour ne pas ouvrir l'appareil par-dessus le flux
  qui arrive). « Une photo » de l'écran « La caméra est bloquée » l'ouvre aussi.
- **`multiple`** : la photothèque, plusieurs photos à la fois. C'est « Importer une photo »
  partout (barre d'outils, encarts, écran d'explication).

Chaque fichier choisi suit **le pipeline d'un appui** ci-dessous, dans l'ordre choisi : la
file de décodage le fait attendre sa place avant de décoder l'image, de sorte que l'import
de dix photos n'en tient jamais plus de deux en mémoire. Une photo du téléphone (12 à
48 Mpx, HEIC transcodé en JPEG par Safari tant que `accept` ne cite pas `image/heic`) est
lue redressée (`imageOrientation: 'from-image'`, S1) puis **ramenée au grand côté du flux**
(4 032 px, `read-file.ts`) avant d'entrer dans la file : le lecteur a été dimensionné pour
le flux, et un bitmap de 48 Mpx pèserait ~190 Mo. Le JPEG stocké reste à 1 600 px.

« Au-dessus du routeur » (§6.4) : le routeur n'a pas d'onglets persistants (chaque écran
est une route), le flux survit donc dans le singleton, pas dans un composant.

## Lampe et guidage de prise de vue (YSL-31, F05 et F07)

**La lampe** (`features/camera/torch.ts`, état `torch` de `cameraStream`) n'existe que si la
piste la propose : `track.getCapabilities().torch` (`torchCapability` → `none` sinon, et le
carré « Lampe » de la barre est **caché**, `ScanScreen.torch={false}`). Elle s'allume par
`applyConstraints({ advanced: [{ torch: true }] })`, la forme qu'iOS accepte (rapport 04,
WebKit 280970) ; le carré passe en blanc (`torchOn`, `aria-pressed`). L'état est relu dans
`getSettings().torch` à chaque ouverture du flux et au retour au premier plan : iOS éteint
la lampe quand l'app passe derrière, et le carré suit la piste plutôt que la mémoire de
l'app. Un refus d'`applyConstraints` laisse l'état tel que la piste le dit. Quitter l'écran
Scan (`detach`) éteint la lampe : le flux reste ouvert pour la session, mais aucun autre
écran n'a de carré pour l'éteindre.

**Le cadre** est le `Viewfinder` de `CameraViewport` (quatre coins : blancs en recherche,
jaunes pour un doublon, rouges quand rien n'a été lu), posé depuis YSL-23.

**Flou et reflet** sont mesurés **sur la photo prise**, pas sur le flux : en rafale l'agent
appuie sans regarder l'écran, et une analyse à chaque image coûterait pendant le décodage.
Juste après `grabFrame` (ou la lecture du fichier importé), `frameQuality` dessine une
vignette de 640 px (canvas 2D, quelques millisecondes) et `assessFrame` en tire deux
mesures :

- **netteté** : variance du laplacien de la luminance rapportée à la variance de la
  luminance (la part du contraste portée par les bords, indépendante de la scène) ; sous
  `BLUR_BELOW` (0,25), rien n'a de bord. Mesuré sur les photos d'iPhone du corpus, à
  640 px : nettes, 0,59 à 1,1 ; floutées de σ = 4 px (sur 4 032, où zxing ne lit déjà plus
  4 étiquettes sur 5), 0,17 à 0,31 ; σ = 8 px, 0,02 à 0,04. Un flou qui défait le lecteur
  se voit donc sur la vignette, de justesse : la mesure ne sait pas nommer un flou léger ;
- **reflet** : part des pixels saturés (luminance ≥ 250) dans la moitié centrale de
  l'image ; au-delà de `GLARE_ABOVE` (12 %), une tache brûlée couvre l'étiquette. Sur les
  photos d'iPhone du corpus, le papier reste sous 240 (l'exposition le garde) : seul un
  reflet spéculaire sature. Un scan au papier blanc pur importé de la photothèque passe
  cette barre à tort (le conseil « Reflet » s'affiche si le scan est aussi illisible).

Le verdict (`glare` prime sur `blurry` : la tache brûlée aplatit aussi les bords autour
d'elle) ne sert qu'**à l'encart « Aucun code lu »** (`unreadableReading`) : « Reflet sur
l'étiquette. Inclinez légèrement le colis. » (« …ou éteignez la lampe. » si elle était
allumée à l'appui : F07, déconseillée sur les étiquettes plastifiées), « Photo floue. Tenez
l'iPhone immobile et rapprochez-vous. », sinon le conseil générique. Rien n'est stocké sur
le brouillon ; le nom lu par l'OCR, s'il arrive, remplace l'encart comme avant.

**Reste à vérifier sur un vrai iPhone** (PWA installée) : que le carré « Lampe » apparaît
(`getCapabilities().torch`) et allume réellement la lampe ; qu'après un verrouillage ou un
passage sur une autre app, le carré repasse sombre au retour ; que la lampe sur une
étiquette plastifiée mène à « Reflet… ou éteignez la lampe » quand rien n'est lu, et une
photo bougée à « Photo floue… » ; le coût de la mesure dans la cadence de la rafale.

## Le pipeline d'un appui (`routes/_authenticated/scan.tsx`)

1. Une place dans la file de décodage (`DecodeQueue`, **2 en vol** au plus : un bitmap de
   12 Mpx pèse ~48 Mo) ; au-delà, l'appui attend la fin de la plus ancienne lecture. La
   place couvre toute la lecture d'un appui, seconde passe comprise : jamais plus de deux
   images pleine résolution vivantes.
2. `grabFrame` en pleine résolution (ou la photo importée, lue après l'attente de la
   place), la mesure de netteté et de reflet (`frameQuality`, vignette 640 px sur le fil
   principal), un clone pour la photo et une éventuelle seconde passe.
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

## Les doublons (`features/batch/duplicates.ts`, F10)

Un colis scanné deux fois ferait deux notifications. Dès que la lecture d'un brouillon
pose un `trackingNorm` (code lu ou numéro saisi, normalisé par `normalizeTracking` :
majuscules, sans espaces, tirets ni points), `findDuplicate` cherche le même numéro :

- d'abord un brouillon **plus ancien** du lot (seul le plus jeune des deux est le
  doublon : deux lectures du même code qui aboutissent ensemble ne se retirent pas l'une
  l'autre) ;
- sinon le colis **le plus récent** de la table `parcel` qui le porte et n'est pas
  supprimé : un lot antérieur de cet appareil (un colis n'y entre qu'à Terminer), ou
  un colis arrivé par `sync.pull` d'un autre appareil.

L'alerte est **non bloquante** (cahier P1.4) : le cadre passe en jaune, le bandeau dit
« Déjà dans ce lot » (nom, transporteur, 4 derniers chiffres, heure du premier scan) ou
« Déjà reçu le 23 octobre » / « Déjà remis hier » (destinataire résolu par l'annuaire ou
le contact, sinon le nom lu), et l'avis du bas « Ce colis n'a pas été ajouté une
deuxième fois » offre deux sorties :

- **Voir le colis** : les champs du colis d'origine prennent la place de l'alerte, sans
  quitter la rafale : ses codes rejoués par `toScanReading` pour un brouillon du lot,
  transporteur, suivi et destinataire (`parcelFields`) pour un colis déjà reçu (la fiche
  colis attend YSL-48). Regarder, c'est renoncer à l'ajout : le doublon et sa photo sont
  abandonnés ; le rescanner rouvre l'alerte.
- **Ajouter quand même** : le brouillon rejoint le lot tel quel, ses codes à l'écran, et
  la passe texte (OCR) qu'il a manquée pendant la retenue repart, hors du travail du lot.

Tant que l'alerte est là, le brouillon est **retenu** (`holdDraft`) : retiré de
`draft_parcel` (compteur et « Dernier ajouté » ne le comptent plus) mais sa photo reste,
pour qu'il revienne intact (`restoreDraft`, même identifiant). Toute autre sortie de
l'alerte (capture suivante, nouvelle saisie, Annuler, la croix, Terminer, fermeture de
l'écran) l'abandonne avec sa photo (`dropHeld` : le balayage des orphelins ne retire que les
fichiers sans ligne `photo`). Un numéro saisi sur un brouillon illisible compte à partir
de l'instant de la saisie : une lecture arrivée entre-temps est son original. Un
brouillon sans numéro n'est jamais un doublon ; la
reprise d'une lecture après relance (`recoverPending`) ne fait pas le contrôle, faute
d'écran pour l'alerte. Le serveur n'impose rien : « Ajouter quand même » rend la clé
non unique par construction, l'index `parcel_tracking_norm_idx` n'est pas unique et
`sync.push` ne répond jamais 409 pour un colis.

## Colis en plusieurs pièces et même destinataire (`features/batch/pieces.ts`, `recipient.ts`, F20 et F11)

Un envoi livré en plusieurs cartons porte sur chacun un code 2D qui annonce « 2/3 »
(`ParsedCode.pieces`, UPS, FedEx, DPD, GS1 ; F20, §4.6 du cahier). Pour le lot, c'est
**un seul colis** : « Même numéro : pièces regroupées en un colis. »

- À la lecture, `readDraft` écrit sur le brouillon (`pieceOf`)
  `pieces = { total, read: [n], key, photoIds: [] }`. La **clé** est le numéro d'expédition du code
  (`reference` : shipment ID UPS, GS1 401/402) préfixé du transporteur, sinon le numéro de
  suivi normalisé (DHL Express, Chronopost impriment le même numéro sur chaque carton). Un
  « 1/1 » (tout MaxiCode UPS) n'est pas un colis en plusieurs pièces ; les n/N lus par
  l'OCR (« 1 OF 3 ») attendent YSL-41.
- La pièce suivante : `findPieceGroup` cherche un brouillon **plus ancien** du lot de même
  clé ; si son indice n'y est pas encore, `attachPiece` l'ajoute aux indices lus, range la
  photo dans `pieces.photoIds` et supprime le brouillon de la pièce (le compteur ne bouge
  pas). L'écran montre « Colis en 3 pièces » avec les pastilles numérotées et le panneau
  « Pièce 2 sur 3 lue » ; tant qu'il manque une pièce, « La 3e pièce manque : enregistrer
  2 sur 3 » ferme le panneau (le colis est déjà enregistré tel quel). Pas d'Annuler sur
  une pièce : le colis entier s'annule par la fenêtre de 5 s de son premier carton.
- Même clé et **indice déjà lu**, ou même numéro sans n/N d'un côté : doublon F10
  (`findDuplicate` reçoit `piece`), l'original est le brouillon du colis. Une pièce d'un
  colis d'un lot antérieur (le 3e carton arrive le lendemain) passe par « Déjà reçu hier »
  et « Ajouter quand même » : rattacher une pièce à un colis déjà synchronisé est reporté.
- À Terminer, `parcel.pieceN` = pièces **reçues** (`read.length`), `pieceTotal` = annoncé ;
  toutes les photos (`photoIdsOf`) pointent le colis. Annuler, Abandonner et l'abandon d'un
  brouillon retenu effacent aussi les photos des pièces (`deleteDraftPhotos`).

**Même destinataire que le précédent** : sous les champs lus, quand aucun code de
l'étiquette ne nomme le destinataire et que le brouillon **juste avant** dans le lot a un
nom (lu par un code, sinon supposé par l'OCR : `previousNamed`), un bouton copie ce nom
dans `readName` (`copyRecipient`). C'est une correction de l'agent (§4.3, rang 9) : le
champ devient sûr, le colis sort en `recu`, et l'OCR qui atterrit ensuite ne touche que
`ocrName`. Un numéro saisi au pavé n'a pas de panneau de champs, donc pas de bouton.

## Le lot en cours (`features/batch/store.ts`, schéma Dexie version 2)

Deux tables locales, **sans outbox** : `draft_batch` (`id, startedAt`) et `draft_parcel`
(`id, batchId, createdAt, trackingNorm` ; `pieces` non indexé, absent des brouillons
d'avant YSL-38). Un seul lot à la fois, et un lot brouillon n'est
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

Choix du transporteur à la main quand le format est ambigu (revue de lot, YSL-58), liste
du lot et revue (YSL-58), n/N par l'OCR, poids, service et référence à l'écran (YSL-41),
bip et flash à la capture (YSL-39, §6.6), capture automatique sur image nette (F06,
lot L3). Pièces d'un colis : le regroupement ne joue qu'à la lecture dans l'écran Scan,
pas à la reprise après relance (`recoverPending` écrit `pieces` sans regrouper : un envoi
relu en trois cartons après une relance donne trois colis « 1 sur 3 ») ; les numéros de
suivi des cartons 2 à N disparaissent avec leur brouillon quand ils diffèrent du premier
(UPS), donc un de ces cartons relu dans un lot suivant ne déclenche plus « Déjà reçu » ;
rattacher une pièce à un colis déjà synchronisé ; « Même destinataire » après « Ajouter
quand même ».
