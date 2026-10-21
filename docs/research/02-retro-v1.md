# Rétro-ingénierie de Courrier YSL v1

Source analysée : dépôt public `allantoons/Courrier-ysl`, branche principale, dernier commit du 2026-10-01 (89 commits, historique fait d'enchaînements « Delete index.html » / « Add files via upload », donc aucun historique de code exploitable). Clone fait dans `/tmp/courrier-ysl-v1/src`, lu uniquement, jamais exécuté.

Contenu réel du dépôt :

| Fichier | Taille | Constat |
| --- | --- | --- |
| `index.html` | 144 Ko, 2286 lignes | Une seule page : CSS, HTML, JS (ES5, `var`), annuaire, logo PNG en base64 (ligne 190, ~30 Ko) |
| `sw.js` | 1,5 Ko | Service worker, cache `courrier-ysl-v11` |
| `manifest.json` | 0,5 Ko | Références à `icon-192.png` et `icon-512.png` |
| `worker.js` | 5 Ko | Cloudflare Worker d'une ancienne version « lecture par IA Claude » : code mort, non référencé par `index.html` |
| `DEPLOY.md` | 1,9 Ko | Périmé : décrit encore le Worker IA et `LABEL_API_URL`, qui n'existe plus dans `index.html` |

Écart avec le cahier des charges : le CDC (section 6) liste `icon-192.png` et `icon-512.png` dans le dépôt, mais ils sont absents du HEAD (supprimés dans l'historique, jamais ré-ajoutés). Le manifeste et `apple-touch-icon` pointent donc vers des 404.

Règle RGPD de ce document : aucun nom ni e-mail de l'annuaire n'est reproduit.

---

## 1. Inventaire des écrans et parcours

### 1.1 Structure générale

- Entête fixe : logo (PNG base64), sous-titre « Service Courrier », date et heure du jour (rafraîchies toutes les 60 s).
- Barre d'onglets fixe en bas, 4 onglets : **Accueil**, **Nouveau**, **Historique**, **Employes** (sans accent dans le libellé).
- Un seul panneau visible à la fois (`.tab.active`). Pas de routage : pas d'URL par écran, pas de bouton retour système.
- Surcouches : fiche colis (bottom sheet), panneau CC (bottom sheet), barre d'actions de sélection, toast haut d'écran (2,8 s, vert ou rouge).
- Thème : noir `#0a0a0a`, or `#c9a84c`, polices Bebas Neue (titres) et DM Sans (texte) chargées depuis Google Fonts.
- Dialogues natifs `confirm()` : doublon, suppression, « L'e-mail a-t-il été envoyé ? », « Ouvrir l'e-mail suivant ? ».

### 1.2 Écran Accueil (« Tableau de bord »)

- 4 compteurs : « Colis aujourd'hui », « En attente » (statuts Recu + En attente), « Notifies », « Remis ». Le compteur « Remis » et « Notifies » sont cumulés sur tout l'historique, pas sur la journée.
- Liste « Colis recents » : 5 derniers colis (cartes), tap = fiche colis.
- État vide : icône colis + « Aucun colis enregistre ».

Bien : synthèse immédiate. Maladroit : « En attente » est ambigu (c'est « à notifier + à remettre »), les compteurs ne sont pas cliquables vers l'historique filtré, aucune alerte sur les colis anciens non remis.

### 1.3 Écran Nouveau (écran central)

Ordre vertical des blocs :

1. Carte « Lire l'étiquette complète » : conseil de prise de vue, boutons **Photographier l'étiquette** (`<input type=file accept=image/* capture=environment>`) et **Choisir une photo existante**. Ligne d'état de progression (« Préparation de la photo... », « Lecture du texte... NN % », « Lecture faible, nouvel essai avec la photo tournée... », « Relecture de la zone du destinataire... », « Relecture de la zone de l'expéditeur... »).
2. Carte « Scanner le code-barres » : pastille d'état, boutons **Rescanner** (après validation), lampe torche (si `track.getCapabilities().torch`), **Activer / Arreter**. Vidéo 280 px max, barre de progression des votes (4 px, or). Zone « Code detecte ».
3. Saisie manuelle du tracking (champ + bouton **OK**, Entrée valide aussi).
4. Bandeau « Colis enregistre / Autre colis pour <nom> ? » avec **Scanner suivant** et **Terminer** (visible après enregistrement).
5. Bandeau d'analyse (`aiBanner`) : message de reconnaissance, rappel « en orange : lecture incertaine », lien « Voir le texte lu par le telephone » (texte brut + diagnostic).
6. Formulaire : N Tracking *, Transporteur * (liste : DHL, DPD, FedEx, UPS, Chronopost, Colissimo, TNT, Autre), Destinataire * (autocomplétion annuaire dès 2 caractères, 6 résultats max, recherche sans accents sur prénom + nom + service), E-mail du destinataire (facultatif hors annuaire), carte « Destinataire selectionne » (nom, service, e-mail), Expéditeur, Nb colis (110 px de large), case « Ouvrir l'e-mail au destinataire après l'enregistrement » (mémorisée), Notes (« Fragile, recommande... »).
7. Boutons **Enregistrer le colis** et **Reinitialiser**.

Validation à l'enregistrement, dans cet ordre : tracking requis, doublon exact (confirm), transporteur requis, destinataire requis, e-mail valide si renseigné (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`). Après enregistrement : on vide tracking, notes, expéditeur, nombre, transporteur, mais on garde destinataire et e-mail pour enchaîner les colis du même destinataire. Le scanner est « mis en pause » (`scanPaused`) jusqu'à « Scanner suivant ».

Bien :
- Photo, scan et saisie manuelle coexistent, le résultat de chaque voie remplit le même formulaire.
- Conservation du destinataire entre deux colis (cas fréquent : plusieurs colis pour la même personne).
- Les champs douteux sont signalés, le texte brut de l'OCR est consultable (diagnostic très utile).
- Doublon détecté mais non bloquant.

Maladroit :
- L'écran est très long : trois modes de saisie empilés avant le formulaire, le bandeau de résultat est sous le scanner et on doit défiler.
- Le scanner caméra et la photo sont deux caméras distinctes, deux flux mentaux ; le scanner doit être activé à la main.
- Le champ « Notes » et « Expéditeur » ont le même poids visuel que les champs obligatoires.
- Après « Enregistrer », le bandeau « Autre colis pour X ? » est en haut de page : sur mobile il faut défiler vers le haut (le code tente `tab-new.scrollTop = 0`, inefficace car l'élément qui défile est la fenêtre).
- La bordure orange est presque toujours là (voir section 4.2) : le signal perd son sens.
- Les erreurs de lecture sont des toasts de 2,8 s, faciles à rater.
- Destinataire hors annuaire : saisie libre du nom sans lien avec une personne, aucun enregistrement dans un annuaire local.
- Aucune confirmation visuelle quand on change de transporteur manuellement alors que le tracking suit un autre format.

### 1.4 Écran Historique

- Titre + bouton **Selectionner** (devient **Annuler**).
- Champ de recherche (« Tracking, nom, transporteur... ») : recherche en minuscules sur tracking, nom, transporteur, service, expéditeur (sans normalisation d'accents, contrairement à l'annuaire).
- **Exporter l'historique** et **Importer** (CSV).
- Filtres en pastilles : Tous, Recus, Notifies, Remis, En attente.
- Cartes : transporteur + date/heure `jj/mm hh:mm`, badge de statut, nom (suffixe `xN` si plusieurs colis), ligne service - tracking - expéditeur, mention orange « · sans e-mail ».
- Mode sélection : cases rondes sur les cartes, barre fixe au-dessus des onglets : « N colis selectionné(s) », **Tout**, **Envoyer emails**, **Annuler**. « Tout » bascule entre tout sélectionner et tout désélectionner, sur les cartes visibles (filtre/recherche pris en compte).
- État vide : « Aucun resultat ».

Bien : sélection groupée + filtres + recherche, c'est le cœur de l'envoi groupé. Maladroit : pas de filtre « à notifier » préétabli (il faut filtrer « Recus » puis « Tout »), pas de tri ni de regroupement par date, pas de pagination (tout le tableau est rendu à chaque frappe), la sélection est perdue quand on change de filtre (`renderHistory` conserve `selectedIds` mais pas toujours l'affichage cohérent), pas de sélection par service.

### 1.5 Fiche colis (bottom sheet)

Contenu : transporteur (Bebas Neue), badge statut, bouton de fermeture « x », lignes Destinataire, Departement, **Email modifiable** (champ + OK avec validation), Tracking, Expediteur (si présent), Nb colis, Reception (« date longue a hh:mm »), Notes (si présentes). Actions : **Notifier par email (Outlook)**, **Marquer comme remis** (masqué si déjà remis), **Supprimer** (confirm).

Bien : e-mail corrigeable sur place (permet de compléter les hors-annuaire). Maladroit : on ne peut pas modifier tracking, transporteur, destinataire, nombre ou notes ; pas de retour arrière du statut (Remis → Notifié) ; pas de date de remise affichée alors qu'elle est stockée ; le libellé « Outlook » est faux (c'est le client mail par défaut) ; ne propose pas « Marquer notifié » manuellement (la fonction `markNotified` existe mais n'est branchée nulle part).

### 1.6 Panneau CC / regroupement (bottom sheet)

Ouvert par « Envoyer emails ». Contenu : titre « Copie (CC) », sous-titre « N colis · M e-mail(s) · K en CC », choix **Par service / Par personne** (mémorisé dans `ysl_groupMode`), aperçu « M e-mails : <libellé> : N colis · ... », recherche, **Tout CC** (bascule), liste des collègues du même service (hors destinataires principaux) avec coche ronde, boutons **Envoyer sans CC** et **Envoyer avec CC**.

Bien : aperçu du nombre d'e-mails avant envoi, regroupement par service qui réduit le volume. Maladroit : la CC n'est proposée que pour les collègues du même service issus de l'annuaire (donc rien pour un hors-annuaire), la même liste de CC est appliquée à tous les e-mails de la file, pas de CC par e-mail, l'ordre des e-mails n'est pas montré.

### 1.7 Écran « Employes » (Annuaire)

Recherche (nom, service, sans accents) + liste de cartes en lecture seule (nom, service, e-mail). Aucun ajout, modification, import ou suppression. Le CDC prévoit l'import CSV (F22 « À faire ») : non implémenté.

### 1.8 Parcours réels de bout en bout

1. Réception unitaire : Nouveau → photo → relecture des champs → Enregistrer → bandeau → « Scanner suivant » (le formulaire garde le destinataire) ou « Terminer » (reset + Accueil).
2. Notification unitaire : fiche colis → « Notifier par email » → `mailto:` → retour dans l'app → `confirm("L'e-mail a-t-il été envoyé ?")` → statut Notifie.
3. Notification groupée : Historique → Selectionner → Tout → Envoyer emails → choix regroupement + CC → file d'e-mails (voir 3.1).
4. Remise : fiche colis → « Marquer comme remis » (statut Remis + `dateRemise`).
5. Sauvegarde : Historique → Exporter (feuille de partage) ; restauration : Importer.

Statuts : `Recu`, `Notifie`, `Remis`, `En attente`. Le statut « En attente » n'est assignable nulle part dans l'UI (uniquement par import CSV) : état mort, affiché dans filtre, badge et compteur.

---

## 2. Heuristiques de parsing (base de la suite de tests)

Chaîne complète, dans `readLabel(file)` :

```
prepareImage → [decodeBarcodeFromImage(couleur) || getOcrWorker()]  (en parallèle)
→ attempt(0)  (OCR sur l'image grise)
→ si insuffisant : attempt(90) puis attempt(270)
→ si pas de nom : zoomRecipient
→ si pas d'expéditeur : zoomSender
→ applyLabelData(best)
```

`attempt(deg)` fait `worker.recognize(src, {}, {text:true, blocks:true})`, appelle `parseLabelText(text, barcode)`, garde le meilleur résultat selon `labelScore`, et renvoie « suffisant » si `tracking && (nom_lu || employe || transporteur)`.

### 2.1 Prétraitement image

| Étape | Valeur exacte |
| --- | --- |
| Chargement | `URL.createObjectURL` + `Image` ; l'orientation EXIF est laissée au navigateur (Safari moderne l'applique) |
| Détection de l'étiquette (`findLabelBox`) | miniature de 400 px (grand côté) ; pixel « blanc » si `max(r,g,b) > 150` et `(max-min)/max < 0.2` |
| Recherche de ligne | `run(rows, h, seuil = w*0.18, trou max = h*0.15)` : plus longue suite de lignes ayant au moins 18 % de pixels blancs, en tolérant des trous ; rejetée si hauteur < 15 % de h |
| Recherche de colonne | sur la bande de lignes retenue, `run(cols, w, seuil = hauteurBande*0.3, trou max = w*0.15)` ; rejetée si largeur < 15 % de w |
| Marge | `0.05 * max(w,h)` (en pixels miniature), ramenée à la taille réelle |
| Condition de recadrage | seulement si la surface du cadre est entre 5 % et 50 % de l'image (étiquette « petite », prise de loin) |
| Mise à l'échelle | `r = min(recadrée ? 2 : 1, 3000 / max(sw, sh))` : agrandit au plus x2 une étiquette recadrée, jamais une photo entière, réduit à 3000 px max (limite mémoire iPhone) |
| Gris (`toGray`) | luminance BT.601 `0.299 R + 0.587 G + 0.114 B` sur un canvas dédié |
| Rotation (`rotateCanvas`) | 90° puis 270° si besoin, canvas échangé en largeur/hauteur |
| Contraste (`autoLevels`, zones relues seulement) | étirement des niveaux 2 %-98 % ; ignoré si `hi - lo < 10` |
| Agrandissement des zones relues | `scale = min(2.5, 3000 / w)`, `imageSmoothingQuality = 'high'` |

Aucune binarisation, aucun débruitage, aucune correction de perspective, aucun redressement de l'inclinaison fine.

### 2.2 Paramètres Tesseract

```js
var TESSERACT_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
Tesseract.createWorker('fra+eng', 1, { logger: ... });   // langues fra+eng, OEM 1 (LSTM)
worker.recognize(src, {}, { text: true, blocks: true });  // sortie texte + blocs (lignes + bbox)
```

- Pas de `setParameters` : PSM par défaut (3, segmentation automatique), pas de `tessedit_char_whitelist`, pas de `user_defined_dpi`, pas de `preserve_interword_spaces`.
- Un seul worker réutilisé (`ocrWorker`), chargé à la demande depuis jsdelivr (script chargé dynamiquement, hors précache du service worker).
- Les lignes sont reconstruites à partir de `blocks[].paragraphs[].lines[]` avec `bbox {x0,y0,x1,y1}`.
- Progression : `m.status === 'recognizing text'` → pourcentage ; statut contenant « load » → message « 1re fois : téléchargement ».

### 2.3 Code-barres (photo)

```js
// decodeBarcodeFromImage(canvas) : formats restreints au tracking
POSSIBLE_FORMATS = [CODE_128, CODE_39, ITF]; TRY_HARDER = true;
new ZXing.MultiFormatReader() ; HybridBinarizer ; HTMLCanvasElementLuminanceSource
largeur de travail W = 1600 (s = min(1, 1600/largeur))
8 bandes : y = round(i * H / 9), hauteur = round(2 * H / 9), i = 0..7  (bandes qui se chevauchent à 50 %)
pour chaque bande : decode → extractTracking → on ne retient que looksLikeTracking(t)
```

Exécuté de façon synchrone dans un `setTimeout(…, 0)` (bloque le fil principal), sur l'image couleur recadrée, sans rotation. Les codes de tri sont rejetés par le filtre de format.

### 2.4 Code-barres (direct, caméra)

| Paramètre | Valeur |
| --- | --- |
| Bibliothèque | `@zxing/library@0.19.1` (UMD, unpkg), `BrowserMultiFormatReader(hints, 150)` : intervalle de 150 ms |
| Formats | `CODE_128, CODE_39, ITF, QR_CODE, DATA_MATRIX, EAN_13, EAN_8, UPC_A` |
| Hints | `TRY_HARDER = true` |
| Flux | `getUserMedia({video:{facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}}})` |
| Vote | `VOTE_THRESHOLD = 5` lectures identiques ; valide si `bestCount >= 5` ET `bestCount >= 2 * secondCount` |
| Fenêtre | les votes sont remis à zéro 2 s après la dernière lecture (`setTimeout` relancé à chaque lecture : c'est un debounce, pas une fenêtre glissante comme le commentaire le dit) |
| Longueur minimale | `code.length >= 6` |
| Retour | vibration 80 ms, remplit le tracking, déduit le transporteur, bouton **Rescanner** |
| Torche | bouton si `getCapabilities().torch`, `applyConstraints({advanced:[{torch}]})` |

### 2.5 Normalisation d'un code lu (`extractTracking`)

```js
function extractTracking(raw) {
  var c = raw.replace(/\s/g, '');
  // Codes FedEx longs (ITF/Code128 étendus) : on garde 8701 + 8 chiffres
  var fedex = /^\d{20,40}$/.test(c) ? c.match(/8701\d{8}/) : null;
  if (fedex) return fedex[0];
  if (/^1Z/i.test(c)) return c.toUpperCase();
  return c;
}
```

La règle `8701\d{8}` est marquée dans le code « à valider sur étiquettes réelles » : elle ne correspond pas au format FedEx à 12 chiffres du CDC (877974873338) et peut fabriquer un faux numéro (voir 4.2).

### 2.6 Détection du transporteur par code (`autoDetectCarrier`, ne s'applique que si la liste est vide)

```js
/^8701\d{8}$/            -> FedEx
/^1Z/                    -> UPS
/^(JJD|JWT|GM|GW)/       -> DHL
/^\d{12}$/               -> FedEx
/^\d{15}$/               -> FedEx
/^(JD|LY|RR|CP|8R)\d/    -> Colissimo
/^\d{13}$/               -> Colissimo      // faux : tout EAN-13 devient « Colissimo »
/^(CX|XD|AT|6V|AR)\d/    -> Chronopost
/^(GE|GK|GT)\d/          -> TNT
```

Aucune règle pour DHL à 10 chiffres, DPD à 14 chiffres, ni pour le format postal `[A-Z]{2}\d{9}[A-Z]{2}` : une saisie manuelle de ces numéros ne déduit pas le transporteur, contrairement à ce que le CDC (F10) annonce.

### 2.7 Détection du transporteur par texte (`findCarrierInText`, appliqué sur le texte en majuscules, ordre significatif)

```js
if (/\bUPS\b|UNITED PARCEL|\b1Z ?[0-9A-Z]{3}/.test(up))   return 'UPS';
if (/DHL|MY[DO]HL|WAYBILL|EXPRESS WORLDWIDE/.test(up))    return 'DHL';
if (/\bDPD\b|FR-DPD/.test(up))                            return 'DPD';
if (/COLISSIMO|FR-COL|LA POSTE/.test(up))                 return 'Colissimo';
if (/CHRONO|CHREDI|CONSIGNEMENT/.test(up))                return 'Chronopost';
if (/FED ?[E5]X|\bFED\.|\bTRK ?#/.test(up))               return 'FedEx';
if (/\bTNT\s+(EXPRESS|INTERNATIONAL)\b/.test(up))         return 'TNT';
return null;
```

Repli dans `parseLabelText` : si aucun transporteur et `/\b\d{4} \d{4} \d{4}\b(?! ?\d)/` dans le texte, on pose `FedEx` (mais le champ reste marqué douteux).

### 2.8 Formats de tracking validés (`TRACKING_FORMATS`, `looksLikeTracking`)

```js
var TRACKING_FORMATS = [
  /^1Z[0-9A-Z]{16}$/,           // UPS
  /^\d{10}$/,                   // DHL Express (waybill)
  /^[A-Z]{2}\d{9}[A-Z]{2}$/,    // format postal international (Chronopost...)
  /^\d[A-Z]\d{11}$/,            // Colissimo
  /^\d{14}$/,                   // DPD
  /^\d{12}$|^\d{15}$/           // FedEx
];
function looksLikeTracking(c) { return TRACKING_FORMATS.some(function(re) { return re.test(c); }); }
```

Un code-barres photo est accepté comme « source fiable » dès qu'il respecte l'un de ces gabarits, sans lien avec le transporteur détecté. Un code de 10 ou 12 chiffres quelconque (référence, téléphone, code client) passe donc.

### 2.9 Extraction du tracking dans le texte (`findTrackingInText(up, carrier)`)

Les blocs sont essayés dans l'ordre, chacun seulement si `carrier` correspond ou est inconnu :

```js
// UPS
m = up.replace(/[ \t]/g, '').match(/1Z[0-9A-Z]{16}/);

// DHL : 10 chiffres après WAYBILL (espaces tolérés, découpage 2-4-4)
m = up.match(/WAYBILL\D{0,6}(\d{2}\s?\d{4}\s?\d{4})\b/);

// Colissimo : ligne "118J 0229907975Y" -> 8J + 0229907975 + chiffre final retrouvé ailleurs
m = up.match(/\b\d?1?(\d[A-Z])\s?(\d{10})[A-Z]\b/);
last = up.match(new RegExp('[0-9A-Z]{2}\\s?' + m[2] + '\\s?(\\d)\\b'));
// résultat : m[1] + m[2] + (last ? last[1] : '')
// variante "COLIS : 8J 0229907975 9"
m = up.match(/CO?L?[I1]?S\s*:?\s*(\d[A-Z])\s?(\d{10})\s?(\d)\b/);

// DPD : séquence de 14 chiffres (espaces tolérés) par ligne, hors ligne de tri commençant par 0075
seqs = line.match(/\d[\d ]{12,22}\d/g);  // puis suppression des espaces, longueur 14, ne commence pas par 0075

// FedEx : "TRK#" ou groupes 4-4-4 isolés
m = up.match(/TRK ?#?\D{0,8}(\d{4}) ?(\d{4}) ?(\d{4})\b/) || up.match(/\b(\d{4}) (\d{4}) (\d{4})\b(?! ?\d)/);

// Postal (Chronopost, etc.) : vote entre occurrences, la version espacée pèse 1,5
re = /\b([A-Z]{2})\s?(\d{3})\s?(\d{3})\s?(\d{3})\s?([A-Z]{2})\b/g;

// Repli : si carrier connu et différent de DHL -> null (pas de numéro douteux)
// sinon : premier \b\d{12}\b|\b\d{10}\b qui n'est pas un téléphone /^0[1-9]\d{8}$/
all = up.match(/\b\d{12}\b|\b\d{10}\b/g);
```

Le repli final est la source du tracking FedEx erroné du CDC (voir 4.2) : il prend un nombre à 10 chiffres quelconque dès que le transporteur n'est pas détecté ou est DHL.

### 2.10 Destinataire

Mots-clés et repères (`findRecipientName`) :

```js
var RE_TO   = /SH[I1L!]P\s*T[O0]|DEL[I1]VER\s*T[O0]|DEST[I1]NATA[I1]RE|RECIPIENT|^\W*T[O0]\s*:/;
var RE_CO   = /SA[I1L]NT\s*LAUR|\bYSL\b/;
var RE_ADDR = /BELLECH|ECHASSE/;
// Contact : /C[O0]NTACT/  (texte après "CONTACT :" sur la ligne puis la ligne suivante)
// Retrait du libellé : L.replace(/.*?(T[O0]|DESTINATAIRE|RECIPIENT)\s*:?/i, '')
// Retrait du Contact : L.replace(/.*C[O0]NTACT\s*:?/i, '')
```

Ordre de candidats (premier qui donne un nom gagne) :
1. Pour chaque ligne qui satisfait `RE_TO` : reste de la ligne, puis lignes +1, +2, +3.
2. Pour chaque ligne `CONTACT` : reste de la ligne, puis ligne +1.
3. Pour chaque ligne société (`RE_CO`) : la ligne, +1, -1, -2, +2.
4. Pour chaque ligne adresse (`RE_ADDR`) : -1, -2, -3.

Extraction d'un nom (`nameFromLine`) : retire la société (`/\b(YVES\s+)?SAINT\s*LAURENT\b|\bYSL\b/gi`), découpe sur `[\s:;,]+`, corrige chaque mot (`fixOcrWord`), recolle les fragments, puis garde une suite de 2 ou 3 mots de nom.

Mots exclus (`NOT_NAME`) :

```js
['RUE','AVENUE','AV','BD','BOULEVARD','PLACE','PARIS','FRANCE','CEDEX','CONTACT','SHIP','TO','FROM',
 'PHONE','TEL','REF','COLIS','NUM','POIDS','WEIGHT','KG','ORIGIN','DATE','TRACKING','WAYBILL','BELLECHASSE',
 'ILE','DELIVERY','ADDRESS','SENDER','EXPEDITEUR','DESTINATAIRE','RECIPIENT','SERVICE','EXPRESS','WORLDWIDE','ITALY']
var CARRIER_WORDS = /\b(DPD|CHRONOPOST|COLISSIMO|LA POSTE|UPS|DHL|FEDEX|TNT|CAPITAL|SOCIAL|RCS|SIEGE|SLEGE|TVA)\b/i;
// toute ligne contenant un mot de CARRIER_WORDS est rejetée comme nom
```

Critère de « mot de nom » (`isNameWord`) :

```js
/^[A-ZÀ-Ý][A-Za-zÀ-ÿ'’\-]{2,}$/   // majuscule initiale, 3 lettres ou plus
&& pas dans NOT_NAME
&& /[aeiouy]/.test(norm(w))        // au moins une voyelle
&& new Set(lettres).size >= 2      // pas "EEE"
&& pas à distance de Levenshtein <= 1 de 'saint','laurent','yves','bellechasse'  // débris du nom de société
```

Particules : `['DE','DU','DA','DI','LE','LA','EL','AL','VAN','VON','DEL','DOS','DES']`, acceptées seulement entre deux mots de nom (« de la » : jusqu'à deux particules suivies d'un nom).

Règles de coupe de la suite de mots : un nom répété du bloc Contact interrompt la suite ; un mot collé répété (« AXELLELELIEVRE ») est ignoré ; à partir de 3 mots principaux, on s'arrête ; un 3e mot de moins de 4 lettres est considéré comme débris (« PEN ») ; il faut au moins 2 mots pour valider.

Corrections OCR de mots (`fixOcrWord`) :

```js
var mI = w.match(/^[|l!]([A-ZÀ-Ý]{3,})$/);                  // "|SABELLA", "lSABELLA", "!SABELLA"
if (mI) return I_NAMES.indexOf('I' + mI[1]) !== -1 ? 'I' + mI[1] : mI[1];
w = w.replace(/\|/g, ' ').trim().split(' ').pop() || '';     // le "|" sépare : on garde le dernier fragment
w = w.replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9]+$/g, '');   // ponctuation de bord
// 1 ou 2 chiffres parmi >= 3 lettres : 0->O, 1->I, 5->S, 8->B   ("EULAL1E" -> "EULALIE")
if (/^[a-zà-ÿ][A-ZÀ-Ý'’\-]{2,}$/.test(w)) w = w.toUpperCase();   // "eULALIE" -> "EULALIE"
```

Recollage de fragments (`nameFromLine`) : un mot de 2 lettres majuscules (hors particules et hors `['TO','AT','OF','BY','IN','ON','NO','NR','MR','MS','DR','ST']`) suivi d'un mot majuscule est fusionné si le résultat est un mot de nom (« EU » + « LALIE »).

Prénoms commençant par I (`I_NAMES`, utilisé par `fixInitialI` quand le « I » initial est perdu) :

```js
['ISABELLA','ISABELLE','ISABEL','ISALINE','ISAURE','ISOLDE','ISIS','ISMA','ISAAC','ISMAEL','ISRAEL','ISIDORE',
 'IRENE','IRÈNE','IRINA','IRIS','IRMA','INES','INÈS','INGRID','INGE','INDIA','ILARIA','ILENIA','ILONA','ILSE','ILAN','ILIAN',
 'ILYES','ILYAS','IMANE','IMAN','IMOGEN','IDA','IOANA','IONA','IVAN','IVANA','IVY','IZIA','IGOR','IKER','IAN','IGNACIO',
 'IBRAHIM','INGA','IRIA','ISHA','ITZEL','IVETTE','YVETTE']
```

Distance : `levenshtein1(a,b)` vrai si distance d'édition <= 1 (insertion, suppression, substitution).

Rapprochement avec l'annuaire (`matchEmployeesInText(text, strict)`) :

```js
clean = norm(text sans société).replace(/([a-z])0|0([a-z])/g, → '0' devient 'o')
hit(word) = 2 si le mot est un token ; 1 si (non strict, longueur >= 5, token à distance <= 1) ; sinon 0
score = nom && prénom ? scoreNom + scorePrénom
      : nom seul ? scoreNom / 2 : 0
// bonus : nom trouvé + initiale du prénom présente comme token -> prénom = 0.5
retient score >= 1, tri décroissant
best  = top si score >= 2.5 et strictement supérieur au 2e
exact = (top.score === 4)
candidats = 6 premiers
```

Si aucun nom n'a été lu, le matching est tenté sur tout le texte en mode strict (correspondances exactes seulement). Conséquence : un destinataire connu mais dont seul le nom de famille est lu ne sera jamais « best » (score max 1 ou 2 → candidats seulement).

Mise en forme du nom hors annuaire : `toTitle` (minuscules puis majuscule après début, espace, tiret, apostrophe).

### 2.11 Expéditeur

```js
// 1) libellé explicite, ligne contenant FROM/SHIPPER/SENDER/EXPEDITEUR, hors lignes contenant BILL
/\b(FROM|SHIPPER|SENDER|EXP[EÉ]DITEUR)\s*:?\s*(.*)$/i       // valeur après le libellé, nettoyée par cleanSender
// 2) première ligne avec forme de société, avant la ligne "SHIP TO|SAINT LAURENT" (arrêt de la recherche)
/([A-ZÀ-Ý][A-Za-zÀ-ÿ&.\-]{3,}(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ&.\-]+){0,3})\s+(SPA|S\.P\.A|SRL|SARL|SAS|GMBH|LTD|INC|CORP|LLC|BV)\b/
// ligne ignorée si elle contient un mot de CARRIER_WORDS
```

Nettoyage (`cleanSender`) :

```js
t = s.replace(/\b(ORIGIN|SHP|DATE|WEIGHT|KG)\b.*$/i, '')       // coupe à partir de ces mots
     .replace(/[^A-Za-zÀ-ÿ0-9&.\- ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
while (t.length && t[0].length < 2) t.shift();                  // débris de début de ligne
r = t.join(' ').slice(0, 60);
if (/\d{5,}|\d{3} \d{3}/.test(r)) return null;                  // un numéro, pas un nom
return (/\b[A-ZÀ-Ý][A-Za-zÀ-ÿ&.\-]{3,}/.test(r) || /\b(SPA|SRL|SARL|SAS|GMBH|LTD|INC)\b/i.test(r)) ? r : null;
```

Relecture de zone (`zoomSender`) : ancre = première ligne OCR contenant `/\bFROM\b|ORIGIN|SHIP\s*FROM|SHIPPER|EXP[EÉ]DITEUR/i` sans `BILL`. Fenêtre : `x0 = max(0, b.x0 - lh)`, `y0 = max(0, b.y0 - lh)`, largeur = min(reste, 60 % de la largeur), hauteur = min(reste, 8 x lh), où `lh = max(20, hauteur de la ligne ancre)`. Agrandie x2,5 (3000 px max), `autoLevels`, relue, puis `findSenderInText` puis recherche de forme de société.

Relecture destinataire (`zoomRecipient`) : ancre = première ligne avec `/BELLECH|ECHASSE/i`, sinon `/SA[I1L]NT\s*LAUR|\bYSL\b|SH[I1L]P\s*T[O0]|\bT[O0]\s*:/i`. Fenêtre : `x0 = max(0, b.x0 - 3 lh)`, `y0 = max(0, b.y0 - 5 lh)`, largeur jusqu'au bord droit, hauteur min(reste, 8 lh). Agrandie x2,5 (3000 px max), `autoLevels`, relue : `findRecipientName` puis, à défaut, `nameFromLine` ligne par ligne.

### 2.12 Nombre de colis (`findCountInText`)

```js
var ok = (a, t) => t >= 1 && t <= 20 && a >= 1 && a <= t ? t : null;     // 1 <= rang <= total <= 20 ; renvoie le TOTAL
m = up.match(/\b(\d{1,2})\s?[O0]F\s?(\d{1,2})\b/);                       // "1 OF 3" (UPS), 0 toléré pour O
re = /(\d{1,2})\s?\/\s?(\d{1,2})/g;                                      // "1/3", dates ignorées :
//   rejette si le caractère avant est un chiffre ou "/", si "\d/" juste avant, si "/" ou chiffre juste après
// défaut : 1  (le champ est toujours marqué douteux)
```

Le CDC cite aussi « Pièce 1/1 » : il est couvert par la règle `1/1`, il n'existe pas de règle propre au mot « Pièce ».

### 2.13 Score et critères d'arrêt

```js
labelScore(d) = (tracking ? 2 : 0) + ((nom_lu || employe) ? 2 : 0) + (transporteur ? 1 : 0) + (expediteur ? 0.5 : 0)
// suffisant : tracking && (nom_lu || employe || transporteur)  -> pas de rotation
// 90° puis 270° seulement si "insuffisant" à 0°
// relecture destinataire seulement si ni nom_lu ni employe ; relecture expéditeur seulement si pas d'expéditeur
```

### 2.14 Champs douteux (bordure orange `.field-doubt`)

`parseLabelText` part de `['expediteur', 'nb_colis']` (toujours douteux), ajoute `transporteur` si le transporteur n'a pas été trouvé dans le texte, `tracking` si le numéro ne vient pas du code-barres validé, `destinataire_nom` si le rapprochement n'est pas « exact » (score 4). Hors annuaire, le champ destinataire est toujours orange.

### 2.15 Jeux d'essai fournis par le CDC (à transformer en tests)

| Transporteur | Tracking à retrouver | Remarque |
| --- | --- | --- |
| UPS | `1ZE6344W0499230622` | `1Z` + 16 |
| DHL | `5413337112` | 10 chiffres après WAYBILL ; lu surtout par code-barres |
| FedEx | `877974873338` | 12 chiffres |
| Colissimo | `8J02299079750` | ligne OCR de type `118J 0229907975Y` + chiffre final |
| Chronopost | `HA915306631JB` | 2 lettres + 9 chiffres + 2 lettres |
| DPD | `10464000209404` | 14 chiffres, ignorer `0075…` |
| (cas négatif) | tracking faux FedEx `7185713569` | doit rester vide ou orange, jamais enregistré en silence |

Les bordereaux photographiés ne sont pas dans le dépôt : la suite de tests devra reposer sur des fixtures de texte OCR brut (champ « Voir le texte lu ») plus quelques photos anonymisées.

---

## 3. E-mail, CSV, service worker

### 3.1 Logique e-mail

Mécanisme : lien `mailto:` ouvert par `window.location.href`. Rien n'est envoyé sans geste de l'agent.

Gabarit unitaire (`buildMailto`, fiche colis ou case « ouvrir l'e-mail après l'enregistrement ») :

```
Objet : Colis <transporteur> en attente de retrait - Service Courrier

Bonjour <nom complet>,

Un colis vous est parvenu au Service Courrier.

Transporteur : <transporteur>
N de tracking : <tracking>
Expediteur : <expéditeur>                (ligne omise si vide)
Nombre de colis : <n>
Recu le : <jour semaine jj mois> a <hh:mm>
Notes : <notes>                          (ligne omise si vide)

Merci de venir le recuperer des que possible.

Cordialement,
Service Courrier - Saint Laurent
```

Gabarit groupé (`buildGroupMailto(group, cc)`), avec `n` = somme des `count` des colis du groupe, `several` = le groupe compte plus d'un destinataire :

```
Objet : (n === 1 ? "Colis <transporteur> en attente" : "<n> colis en attente de retrait")
        + (several && service ? " - <service>" : "") + " - Service Courrier"

Corps :
  si several : "Bonjour a tous,\n\n<n> colis sont arrives au Service Courrier[ pour le service <service>] :"
  sinon      : "Bonjour <nom>,\n\n" + (n === 1 ? "Un colis vous est parvenu au Service Courrier."
                                               : "<n> colis vous sont parvenus au Service Courrier.")
  puis une ligne par colis :
    "- [<nom> : ]<transporteur> | <tracking>[ (<count> colis)][ | de <expéditeur>] | <jour mois> a <hh:mm>[ (<notes>)]"
  puis "Merci de venir le recuperer des que possible." (n === 1) ou "Merci de venir les recuperer des que possible."
  puis "Cordialement,\nService Courrier - Saint Laurent"
```

Écart avec le CDC : le CDC dit « N colis en attente de retrait - Service - Service Courrier » ; en réalité le service n'est ajouté que si plusieurs personnes sont dans l'e-mail, et le cas n = 1 a un objet différent (« Colis DHL en attente »). Les textes sont en ASCII sans accents (« recuperer », « arrives », « a ») : volontaire (compatibilité), mais à corriger en UTF-8 avec encodage correct.

Mise en forme de l'URL : `mailto:` + destinataires séparés par des virgules (non encodés) ; `?subject=` encodé ; `&cc=` adresses non encodées séparées par des virgules ; `&body=` encodé. Aucun `bcc`.

Regroupement (`buildGroups`) :

```js
person = p.email || ('nom:' + norm(p.fullname));
key = (groupMode === 'dept' && p.dept) ? 'dept:' + p.dept : person;
```

- Mode « Par service » : un e-mail par service connu ; les colis sans service (hors annuaire) retombent en « par personne » (clé = adresse ou nom normalisé).
- Mode « Par personne » : un e-mail par adresse.
- Les adresses du groupe sont dédoublonnées ; les noms aussi ; un colis sans e-mail ne contribue aucun destinataire : l'e-mail s'ouvre sans « À » si aucun colis du groupe n'a d'adresse.
- Libellé de groupe : « service X (N personnes) » ou le nom.

CC : liste de collègues du même service que les destinataires du lot (hors destinataires principaux), cochables, « Tout CC » en bascule ; la liste CC choisie est la même pour tous les e-mails de la file. « Envoyer sans CC » est un bouton à part.

File d'envoi (iOS n'ouvre qu'un `mailto:` à la fois) :
1. `doSendEmails(cc)` construit `mailQueue = [{ids, url, name}]`, quitte le mode sélection, appelle `nextInQueue()`.
2. `nextInQueue()` dépile, affiche un toast « E-mail pour X (N restants) », met `pendingNotifyIds`, ouvre le `mailto:`.
3. Au retour (`visibilitychange` → visible), après 400 ms : `confirm("L'e-mail a-t-il été envoyé ?")` → les colis (hors statut Remis) passent à `Notifie`, puis, s'il reste des e-mails, `confirm("Ouvrir l'e-mail suivant ?")` sinon file vidée.

Faiblesses : confirmation par `confirm()` natif ; si l'agent répond « non » le colis reste « Recu » sans trace de la tentative ; le retour dans l'app n'est détecté que par `visibilitychange` (fragile selon que Mail s'ouvre en sheet ou en app) ; aucune limite sur la longueur de l'URL (iOS/Outlook tronquent les longs `mailto:`) ; pas de reprise de la file si l'app est tuée entre deux e-mails ; `pendingNotifyIds` et `mailQueue` ne sont pas persistés.

### 3.2 Export / import CSV

Colonnes (ordre exact) :

```
id;date_reception;date_remise;statut;transporteur;tracking;destinataire;email;departement;expediteur;nb_colis;notes
```

Export :
- Séparateur `;`, fin de ligne `\r\n`, BOM UTF-8 `﻿` en tête (accents corrects dans Excel).
- Cellule échappée par guillemets si elle contient `"`, `;`, `\n` ou `\r` (guillemets doublés).
- Neutralisation d'injection de formule : toute cellule commençant par `=`, `+`, `-` ou `@` reçoit une apostrophe en préfixe.
- Nom du fichier : `courrier-ysl-historique-AAAA-MM-JJ.csv`.
- iPhone : `navigator.share({files:[File]})` (feuille de partage : Fichiers, Mail, AirDrop) si `navigator.canShare({files})`, sinon téléchargement via `<a download>` ; l'annulation de la feuille (`AbortError`) n'est pas traitée comme une erreur.

Import :
- Texte lu par `File.text()`, BOM retiré, séparateur auto : `;` si la première ligne contient au moins autant de `;` que de `,`.
- Parseur CSV maison qui gère les guillemets, les `""`, les sauts de ligne dans une cellule, `\r\n`, et ignore les lignes vides.
- En-tête obligatoire : colonnes `tracking` et `destinataire` présentes, sinon « ce n'est pas un export de l'app ». Les autres colonnes sont optionnelles.
- L'apostrophe de neutralisation est retirée (`/^'(?=[=+\-@])/`).
- Valeurs par défaut : `id` = `Date.now() + added`, `dateReception` = maintenant, statut inconnu → `Recu` (donc un statut mal orthographié redevient « Recu » silencieusement), transporteur vide → `Autre`, `count` >= 1.
- Ligne ignorée si pas de tracking ou date invalide.
- Dédoublonnage : par `id` OU par clé `tracking|dateReception`.
- Après import : tri par date de réception décroissante, sauvegarde, rendu, toast « N colis importés, M ignorés ».
- Aucun mode « remplacer » ; aucune fusion de champs modifiés (un colis déjà présent et mis à jour dans le fichier est ignoré).

### 3.3 Service worker et cache

Fichier `sw.js`, `CACHE = 'courrier-ysl-v11'` (nom à incrémenter à la main à chaque version).

```js
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png',
  'https://unpkg.com/@zxing/library@0.19.1/umd/index.min.js'];
```

- `install` : `cache.add` de chaque fichier séparément (`Promise.all` avec `catch` vide : un échec n'empêche pas les autres, mais est silencieux) ; `skipWaiting()`.
- `activate` : supprime tous les caches dont le nom diffère ; `clients.claim()`.
- `fetch` : ignore les non-GET.
  - Navigation : réseau d'abord, copie dans le cache sous la clé `./index.html` (sans vérifier `resp.ok`), repli sur le cache hors ligne. Pas de délai maximum (timeout) : en réseau très mauvais, l'ouverture attend.
  - Autres requêtes : cache d'abord, sinon réseau + mise en cache si `resp.ok`.
- Enregistrement : `navigator.serviceWorker.register('sw.js')` au `load`, erreur ignorée.

Points non couverts : Tesseract.js (script jsdelivr chargé dynamiquement par balise `<script>`, donc requête `no-cors` à réponse opaque, jamais mise en cache car `resp.ok` est faux pour une réponse opaque), le coeur WASM et le worker Tesseract (chargés depuis le CDN par le worker), les fichiers de langue `fra`/`eng` (gérés par Tesseract.js dans IndexedDB, hors du contrôle du SW), la police Google Fonts (CSS importé, fichiers de police via cache-first au premier passage). Le CDC annonce « OCR mis en cache après usage / utilisable en mode avion » : ce comportement n'est pas garanti par le code et n'a pas été vérifié sur iPhone (critère d'acceptation « mode avion » toujours ouvert).

Manifeste : `display: standalone`, `orientation: portrait`, fond et thème `#0a0a0a`, `start_url: "./"`, deux icônes (absentes du dépôt). Pas de `id`, de `scope`, d'icône `maskable`, de `lang`.

### 3.4 Stockage

`localStorage`, clés : `ysl_parcels` (tableau JSON complet réécrit à chaque modification), `ysl_autoMail` (`'1'`/`'0'`), `ysl_groupMode` (`'dept'`/`'person'`). Modèle de colis : `id` (`Date.now()`), `dateReception` (ISO), `dateRemise` (ISO ou `null`), `status`, `carrier`, `tracking`, `fullname`, `email`, `dept`, `sender`, `count`, `notes`.

### 3.5 Annuaire embarqué (structure uniquement)

- Tableau JS `EMPLOYEES` en dur dans `index.html`, lignes 436 à 537.
- Volume : 101 entrées, 20 services (de 3 à 9 personnes par service).
- Champs par entrée : `id` (entier de 1 à 101), `nom`, `prenom`, `email`, `dept`.
- Un seul domaine d'e-mail d'entreprise pour toutes les entrées.
- Sert à : autocomplétion, rapprochement avec le nom lu par OCR, choix du regroupement par service, liste CC, écran « Employes ».
- Le dépôt étant public, ces données (réelles ou non) sont lisibles par n'importe qui et dans tout l'historique git.

---

## 4. Bugs, dettes et risques constatés

### 4.1 Sécurité, vie privée, conformité

1. **Annuaire de 101 personnes dans le code et l'historique d'un dépôt public.** Le retirer du dernier commit ne suffit pas (historique git, forks, caches). Prévoir purge d'historique ou nouveau dépôt, et un import de l'annuaire réel hors du code.
2. **Données de colis en clair dans `localStorage`** (noms, e-mails, expéditeurs) : pas de chiffrement, pas de durée de conservation, pas de purge, suppression d'un colis seulement unitaire. Safari peut aussi purger le stockage d'une PWA non utilisée (iOS efface les données de site après une période d'inactivité pour les sites hors écran d'accueil) : risque de perte silencieuse de l'historique.
3. **Scripts tiers non verrouillés** : ZXing (unpkg) en balise bloquante dans `<head>` sans `integrity` ni `crossorigin` ; Tesseract (jsdelivr) chargé sans SRI ; polices Google : fuite d'adresse IP vers des tiers et dépendance réseau. Si unpkg est indisponible au premier lancement, la page se charge mais `ZXing` est indéfini.
4. **Dépôt GitHub personnel** (compte personnel, Pages publique) utilisé pour un outil d'entreprise, avec nom et logo de la marque sans accord documenté.
5. **`worker.js` et `DEPLOY.md` périmés** : documentent un envoi de photos d'étiquettes (noms, adresses) à l'API Anthropic via Cloudflare, ce qui contredit la promesse « la photo n'est jamais envoyée » du CDC. Le code n'appelle plus ce Worker, mais le dépôt public en garde la trace et la procédure. À ne pas reprendre ; à clarifier dans la communication DPO.
6. Échappement HTML : fait via `esc()` dans les rendus (bon point), mais `data-email="' + e.email + '"` dans `renderCCList` n'est pas échappé (valeurs de l'annuaire embarqué, donc risque faible aujourd'hui, réel dès qu'un annuaire sera importé). Les noms issus de l'OCR sont insérés avec `esc()` ou `textContent`.
7. Aucune protection par code ou verrouillage applicatif ; l'historique est lisible par quiconque débloque le téléphone.

### 4.2 Bugs fonctionnels et fiabilité

1. **`user-scalable=no, maximum-scale=1.0`** dans la balise viewport : bloque le zoom (accessibilité, WCAG 1.4.4). Déjà identifié dans le CDC.
2. **Tracking FedEx faux `7185713569`.** 10 chiffres : il ne correspond à aucun format FedEx du code (12/15) mais satisfait `/^\d{10}$/` (DHL) et le repli final de `findTrackingInText` (`\b\d{10}\b`, actif quand le transporteur est absent ou DHL). Il a donc dû entrer par ce repli ou par un code-barres de référence accepté par `looksLikeTracking`. Cause racine : aucun contrôle croisé transporteur/format, et un repli « numéro quelconque » alors que le CDC dit « champ vide plutôt que numéro douteux ». Ajouter un test de non-régression.
3. **`extractTracking` règle FedEx `8701\d{8}`** : un code numérique de 20 à 40 chiffres est réduit à 12 chiffres commençant par 8701, sans lien prouvé avec le format réel (le tracking FedEx testé du CDC est `877974873338`). Source possible de numéros inventés, et `autoDetectCarrier` ne reconnaît le transporteur FedEx sur cette règle que si ce faux format est produit.
4. **`autoDetectCarrier` : `^\d{13}$` → Colissimo** : un EAN-13 (produit, UPC) devient « Colissimo ». À l'inverse, DHL 10 chiffres, DPD 14 chiffres et format postal ne déduisent rien.
5. **`looksLikeTracking` trop permissif** pour un code-barres de photo : tout nombre de 10, 12, 14 ou 15 chiffres est « fiable » même s'il s'agit d'un code client ou de tri non filtré (seul `0075…` est exclu et uniquement dans le texte DPD). Il est ensuite affiché sans bordure orange.
6. **Orange quasi permanent** : `expediteur` et `nb_colis` sont toujours douteux, `tracking` l'est dès qu'il ne vient pas du code-barres, destinataire dès que le score n'est pas 4. Le signal ne discrimine plus un vrai doute ; et à l'inverse, un code-barres faux n'est jamais orange.
7. **Rapprochement annuaire fragile** : dépend de `EMPLOYEES` en dur ; un vrai salarié absent de l'annuaire (limite n°1 du CDC) reste « hors annuaire », sans e-mail ; un homonyme partiel (nom seul) n'est jamais sélectionné automatiquement.
8. **Prénoms en I codés en dur** : liste fermée de 55 prénoms ; tout autre prénom en I perdu par l'OCR ne sera pas rétabli.
9. **Marqueurs de destinataire propres à Saint Laurent** (`SAINT LAURENT`, `YSL`, `BELLECH`, `ECHASSE`) codés dans les regex : correct pour l'usage, mais le même mécanisme gère les variantes OCR (`SA[I1L]NT`) sans test.
10. **Texte vertical non lu** (bande latérale Colissimo, Chronopost, DPD) : l'expéditeur n'est lu que 2 fois sur 6 ; les rotations 90°/270° s'appliquent à toute l'image, pas aux bandes.
11. **Barres de code bloquantes** : `decodeBarcodeFromImage` tourne sur le fil principal (8 décodages x ZXing sur 1600 px) ; l'interface se fige pendant l'analyse, et Tesseract s'exécute en parallèle dans un Worker mais avec une image 3000 px, lourd en mémoire sur iPhone.
12. **Bloc de vote du scanner** : le commentaire annonce une « fenêtre glissante », le code fait un debounce de 2 s ; si l'agent bouge, les votes repartent à zéro. L'objet `scanVotes` n'est pas borné.
13. **Détection de doublon** : comparaison stricte `p.tracking === tracking` (pas de normalisation : casse, espaces, tirets) ; le test est fait avant la validation des autres champs ; seul le dernier doublon est cité.
14. **Identifiant `Date.now()`** : collision possible à l'import (`Date.now() + added`) ou si deux enregistrements tombent dans la même milliseconde.
15. **`saveParcels` sans `try/catch`** : un quota dépassé lève une exception non gérée après modification de l'état en mémoire (`parcels.unshift` déjà fait) : l'écran affiche un colis qui n'est pas sauvegardé.
16. **Statut « En attente » inatteignable** ; `markNotified` jamais appelée (code mort) ; fonction `resumeScanner` vide aussi le tracking mais pas le transporteur ; variables `existing`/`list.previousSibling` inutiles dans `renderCCList`.
17. **Pas de gestion d'erreur d'import partiel** : une ligne invalide est ignorée sans détail ; un statut inconnu est écrasé en `Recu`.
18. **Confirmations d'envoi par `confirm()`** : bloquant, mal intégré en PWA standalone, et la double question « envoyé ? » puis « suivant ? » alourdit le parcours. Le commentaire du code dit « jamais de popup » mais la fonction en utilise trois.
19. **Aucun lien entre e-mail et colis après envoi** : on ne sait pas quand, ni dans quel lot, un colis a été notifié (pas de `dateNotification`, pas d'identifiant de lot).
20. **Icônes absentes du dépôt** : manifeste et `apple-touch-icon` en 404 ; l'écran d'accueil iOS affiche une vignette générique.
21. **Service worker** : navigation mise en cache sans vérifier `resp.ok` (une page d'erreur remplace `./index.html` hors ligne) ; échecs de précache silencieux ; OCR hors ligne non garanti (voir 3.3) ; aucune notification de mise à jour (skipWaiting immédiat : l'onglet ouvert garde l'ancien JS jusqu'au rechargement).
22. **Accessibilité** : zoom bloqué, contrastes (texte `#888` sur fond noir, bordure orange comme seul indicateur), absence de `<label for>` liés (labels sans `for`), boutons de fermeture « x » sans `aria-label`, bottom sheets sans `role="dialog"` ni gestion du focus, cases rondes sans rôle checkbox, toast sans `aria-live`.
23. **Texte sans accents** dans l'interface et les e-mails (« Employes », « Selectionner », « Recu le », « arrives »), incohérent avec les parties accentuées du même écran.
24. **Performance** : rendu complet de la liste à chaque frappe, aucune virtualisation, `parcels` entier relu/réécrit à chaque changement ; le logo base64 alourdit le HTML de 30 Ko et empêche sa mise en cache indépendante.
25. **Architecture** : un fichier de 2286 lignes, ES5 global, aucune modularité, aucun test automatisé, aucune version de schéma pour les données locales, aucune CI. `DEPLOY.md` demande d'incrémenter le cache à la main (et mentionne `v2` alors que la version est `v11`).
26. Dialogue « Doublon » affiche le nom du colis existant : bon, mais ne propose pas d'ouvrir le colis existant.

### 4.3 Performance et mesures déclarées

- Durée de lecture : 5 à 7 s (ordinateur de test), 15 à 25 s avec rotation ; iPhone non mesuré (cible CDC : < 15 s).
- Premier chargement : ~4 Mo de langues (fra + eng) téléchargées depuis le CDN de Tesseract.
- Taux de réussite déclaré : tracking 6/6, destinataire 6/6 selon le CDC (dont un bordereau DPD sans nom imprimé), expéditeur 2/6 ; code-barres rarement lu sur photo (1 sur 5). Tous ces chiffres sont issus d'un émulateur Chrome, pas d'un iPhone.

---

## 5. À reprendre / à améliorer / à abandonner

### 5.1 À reprendre (bonnes idées validées)

- **Tout sur le téléphone, sans serveur ni IA payante** : OCR Tesseract.js (fra+eng) + ZXing, zéro envoi de photo.
- **Code-barres d'abord, texte ensuite** ; format de tracking strict plutôt qu'un numéro douteux.
- **Prétraitement** : niveaux de gris, 3000 px max (mémoire iOS), recadrage automatique de l'étiquette quand elle est petite, étirement de contraste 2 %-98 %.
- **Relecture ciblée agrandie x2,5** autour de l'ancre destinataire (BELLECH/SAINT LAURENT) puis expéditeur (FROM/SHIPPER) quand le premier passage échoue.
- **Nouvel essai à 90° puis 270°** si ni tracking ni nom ; score de qualité pour choisir la meilleure rotation.
- **Vote de lecture du scanner direct** (5 lectures concordantes + majorité 2x) : évite les mauvaises lectures ITF ; reprendre le principe, avec un seuil documenté.
- **Correctifs OCR** : chiffre pour lettre, mot coupé, I lu `|`, particules, nom répété du bloc Contact, anti-débris du nom de société (Levenshtein 1).
- **Rapprochement annuaire pondéré** (nom 2, prénom 2, tolérance Levenshtein 1 à partir de 5 lettres, candidats proposés) et mode strict quand aucun nom n'est lu.
- **Diagnostic « Voir le texte lu »** (taille, recadrage, rotation retenue, code-barres, texte brut) : indispensable pour les tests terrain et la création de fixtures.
- **Champs douteux en orange** (idée) : à recalibrer.
- **Parcours d'enchaînement** : conservation du destinataire entre deux colis ; détection de doublon non bloquante.
- **Envoi groupé** : choix par service ou par personne mémorisé, aperçu du nombre d'e-mails, CC limitée aux collègues du service, file d'e-mails un par un, confirmation au retour, statut Notifié posé seulement après confirmation.
- **Gabarit d'e-mail** : une ligne par colis, nom du destinataire si e-mail multi-personnes, nombre réel de colis (somme des `count`).
- **CSV** : séparateur `;` + BOM, neutralisation d'injection de formule, import sans doublon par id ou `tracking|date`, partage via la feuille de partage iOS.
- **Service worker** : réseau d'abord pour la page, cache d'abord pour le reste, précache tolérant aux échecs, purge des anciens caches.
- **Échappement systématique** (`esc`) et `norm` (minuscules, sans accents) pour toutes les recherches.
- **Barre d'onglets basse**, bottom sheets, saisie manuelle toujours disponible, lampe torche.

### 5.2 À améliorer

- Un seul écran de capture : photo/scan/manuel unifiés, résultat de lecture en tête, champs obligatoires séparés des facultatifs.
- Validation du tracking **par transporteur** (format + cohérence avec le transporteur détecté) ; aucun repli « numéro à 10 ou 12 chiffres quelconque » ; test de non-régression pour `7185713569`.
- Confiance par champ réelle : orange uniquement quand le doute est fondé (code-barres seul, écart de format, nom sous le score exact) ; pas d'orange par défaut sur expéditeur et nombre.
- Autoriser le zoom ; viewport sans `user-scalable=no` ; labels, `aria`, focus, contrastes, `aria-live` pour les toasts.
- Stockage **IndexedDB** avec version de schéma, gestion de quota, demande de stockage persistant (`navigator.storage.persist()`), durée de conservation et purge des colis remis, export automatique rappelé.
- Annuaire **hors code** : import CSV stocké localement, édition, ajout hors annuaire mémorisé ; plus aucune donnée nominative dans le dépôt.
- Historique de notification : `dateNotification`, lot d'envoi, nombre de tentatives ; statuts explicites, réversibles, sans « En attente » mort.
- E-mails : UTF-8 avec accents, objet harmonisé avec le CDC, CC par e-mail, gestion de la longueur d'URL, sauvegarde de la file en cours, remplacement des `confirm()` par une feuille intégrée.
- Dédoublonnage normalisé (casse, espaces) et ouverture du colis existant.
- Lecture des bandes verticales : rotation ciblée d'une bande latérale (90°/270°) avant relecture.
- Lecture photo : exécution du décodage code-barres hors fil principal (Worker), orientation EXIF explicite, sous-échantillonnage progressif plutôt qu'un seul canvas 3000 px.
- Définir un format TNT et élargir les formats à partir d'au moins 10 bordereaux réels par transporteur.
- PWA : icônes dans le dépôt (192, 512, maskable, apple-touch), `id` et `scope` du manifeste, hébergement local des bibliothèques et des polices (versionnées, avec SRI ou inclusion au build), précache de Tesseract (coeur, worker, langues) et test en mode avion sur iPhone.
- Service worker : vérifier `resp.ok` avant d'écraser la page en cache, délai maximum réseau, message « nouvelle version disponible », version de cache dérivée du build.
- Tests automatisés : jeux de textes OCR (section 2.15 et regex de la section 2) ; mesures sur iPhone réel ; CI.
- Mettre à jour la documentation de déploiement et supprimer les traces de la piste IA/Worker.

### 5.3 À abandonner

- L'**annuaire en dur** dans le HTML et tout dépôt public pour héberger ces données.
- Le **Worker Cloudflare / API IA** (`worker.js`, `DEPLOY.md` section 2) : hors périmètre « sans service payant » et envoi de photos à un tiers.
- `user-scalable=no` / `maximum-scale=1.0`.
- `localStorage` comme unique stockage et le tableau complet réécrit à chaque changement.
- Le **repli « premier nombre à 10 ou 12 chiffres »**, la règle `8701\d{8}`, la règle `\d{13}` → Colissimo et plus généralement les déductions de transporteur par longueur seule.
- Les `confirm()` natifs et les libellés « Outlook » en dur.
- Un seul fichier `index.html` de 2300 lignes avec le logo en base64, le nom de cache incrémenté à la main, les scripts bloquants non versionnés et sans SRI.
- Les libellés sans accents et les e-mails en ASCII.
- Le statut « En attente » tel quel et la fonction `markNotified` inutilisée.
- La confiance affichée « orange partout ».
