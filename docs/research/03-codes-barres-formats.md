# 03 - Codes-barres, formats de suivi et extraction structurée des bordereaux

> Recherche menée le 21/10/2026 pour **Courrier YSL** (PWA iPhone Safari, hors ligne, service courrier Saint Laurent, 37 rue de Bellechasse, Paris).
> Objectif : tirer le **maximum d'informations fiables d'une photo de bordereau** en s'appuyant d'abord sur les codes-barres (2D structurés, 1D validés par clé de contrôle), et ne laisser à l'OCR que ce que les codes ne portent pas.

## Légende de fiabilité

Chaque affirmation porte une étiquette :

| Étiquette | Signification |
|---|---|
| **[OFFICIEL]** | Lu dans un document du transporteur, de l'organisme de normalisation (GS1, UPU) ou de l'éditeur de la bibliothèque. |
| **[SECONDAIRE]** | Documentation tierce sérieuse : fabricant de logiciel d'étiquetage, bibliothèque open source maintenue, Wikipédia. |
| **[VÉRIFIÉ]** | Algorithme réimplémenté et testé pendant cette recherche (script Python jetable) sur les exemples publiés par la source. Tous les tests indiqués sont passés. |
| **[DÉDUIT]** | Raisonnement de ma part à partir des sources, sans confirmation explicite. À valider sur de vraies étiquettes. |
| **[NON TROUVÉ]** | Aucune source fiable trouvée : il faut traiter le cas comme inconnu. |

---

## 0. Ce qu'il faut retenir

1. **Les codes 2D structurés contiennent le destinataire, pas l'expéditeur.** UPS MaxiCode, FedEx PDF417 et DPD Aztec portent l'adresse du destinataire, le code postal, le pays, le service, le tracking, le poids et souvent le « colis n sur N ». L'**expéditeur** n'y figure en clair que dans des cas limités : bloc expéditeur DPD (obligatoire seulement hors UE), AI GS1 4310-4319 (« return to »), et pas du tout chez UPS ni FedEx Ground. En revanche, **UPS, FedEx Ground et DPD y mettent un numéro de compte expéditeur.** La clé pour l'expéditeur est donc un **dictionnaire appris localement** (n° de compte vers nom de l'expéditeur), alimenté par les corrections de l'utilisateur (voir §4.5).
2. **MaxiCode (UPS) est le point dur.** Les bibliothèques gratuites (zxing-cpp/zxing-wasm et @zxing/library) ne le lisent que sur une image « pure » : symbole droit, non déformé, binarisé et entouré de blanc [OFFICIEL, README zxing-wasm et code source]. Sur une photo d'iPhone, il faut donc **détecter, recadrer et redresser** le MaxiCode nous-mêmes avant de le décoder, ou passer par un SDK payant (Dynamsoft, Scandit).
3. **La clé de contrôle élimine la plupart des faux positifs d'OCR.** UPS 1Z (mod 10), FedEx 12 chiffres (mod 11 pondéré 3-1-7), FedEx Ground « 96 » et SSCC (mod 10 pondéré 3-1), UPU S10 (mod 11 pondéré 8-6-4-2-3-5-9-7), Colissimo domestique (mod 10 pondéré 3-1), DPD (ISO 7064 MOD 37,36), DHL Express (mod 7), TNT (mod 11, pondération S10) : tous ont été réimplémentés et testés sur les exemples des sources [VÉRIFIÉ].
4. **BarcodeDetector n'est pas disponible sur iOS en 2026.** Le bug WebKit 281848 est toujours ouvert ; l'API reste derrière un drapeau et ne détecte rien même activée sur iOS 18. **Bibliothèque recommandée : zxing-wasm 3.1.x** (lecture multi-codes, PDF417, Data Matrix, Aztec, MaxiCode pur), éventuellement via le polyfill `barcode-detector`.
5. **Fusion :** 2D structuré, puis 1D validé par clé, puis OCR guidé par zones et validé, puis saisie. Les sources se recoupent entre elles : le tracking du 2D doit égaler celui du 1D, et le code postal du 2D doit correspondre à l'adresse lue par OCR. Un score de confiance par champ (§4) décide de l'affichage et des demandes de confirmation.

---

## 1. Formats de numéros de suivi et clés de contrôle

### 1.1 Tableau de synthèse

| Transporteur / format | Forme | Longueur | Clé de contrôle | Fiabilité |
|---|---|---|---|---|
| **UPS 1Z** | `1Z` + 6 alnum (compte expéditeur) + 2 alnum (service) + 7 alnum (colis) + 1 chiffre | 18 | mod 10, poids 1/2 sur les 15 caractères après `1Z`, lettres converties | Format [SECONDAIRE], algo [VÉRIFIÉ] |
| UPS Waybill / Mail Innovations | `[AHJKTV]` + 9 chiffres + 1 chiffre | 11 | mod 10 (même règle) | [SECONDAIRE] |
| **FedEx Express** | 12 chiffres (dont la clé) | 12 | mod 11 puis mod 10, poids 3-1-7 | [SECONDAIRE] + [VÉRIFIÉ] |
| FedEx Ground (affiché) | 15 chiffres | 15 | mod 10, poids 3-1 | [SECONDAIRE] |
| **FedEx Ground « 96 »** (code-barres) | `96` + SCNC(2) + service(3) + expéditeur(7) + colis(7) + clé | 22 | mod 10, poids 3-1 sur les 14 derniers chiffres de données | **[OFFICIEL]** + [VÉRIFIÉ] |
| FedEx 34 chiffres (Express et GSN) | … + **12 derniers chiffres = n° de suivi** | 34 | mod 11 sur les 12 derniers chiffres | [OFFICIEL] (guide code-barres FedEx) + [VÉRIFIÉ] |
| SSCC-18 (GS1 AI 00) | `00` + extension + préfixe GS1 + série + clé | 18 (+ AI) | mod 10 GS1, poids 3-1 | **[OFFICIEL]** (FedEx et GS1) + [VÉRIFIÉ] |
| **DHL Express waybill** | 10 chiffres | 10 | mod 7 sur les 9 premiers (`clé = n mod 7`) | Format [OFFICIEL] (dhl.com), algo [SECONDAIRE] + [VÉRIFIÉ] sur 2 exemples |
| DHL Express pièce (licence plate) | `JJD` + chiffres (ex. `JJD0099999999`), ou `JVGL…` chez eCommerce | 13 à 21+ | pas de clé connue | [SECONDAIRE] |
| DHL routage | `2L` + pays + code postal + `+` + bloc produit | variable | - | [SECONDAIRE] (spécification DHL Freight) |
| **UPU S10** (La Poste international, Colissimo international, EMS, recommandés internationaux, postes étrangères) | 2 lettres + 8 chiffres + clé + 2 lettres pays (ex. `RB123456785GB`) | 13 | mod 11, poids 8-6-4-2-3-5-9-7 ; 10 donne 0 et 11 donne 5 | **[OFFICIEL]** (UPU S10) + [VÉRIFIÉ] |
| **Colissimo domestique** (ID13) | 2 caractères (code produit, ex. `6A`, `6C`, `9V`) + 10 chiffres + clé | 13 | mod 10, poids 3-1 sur les 10 chiffres | **[OFFICIEL]** (La Poste) + [VÉRIFIÉ] |
| Colissimo 1D « enrichi » | `%` + CP(7) + `11` + ID13 sans clé (12) + service(3) + pays(3) | 28 | clé de l'ID13 à recalculer | **[OFFICIEL]** |
| La Poste lettre suivie / recommandée | 1 chiffre + 1 lettre + 11 chiffres (ex. `3Y00432154789`), ou 14 chiffres | 13 à 15 | [NON TROUVÉ] | Format [OFFICIEL] (aide.laposte.fr) |
| **DPD** | dépôt(4) + 2 chiffres + série(8), puis 1 caractère de clé | 14 + 1 | ISO/IEC 7064 MOD 37,36 (alphanumérique) | **[OFFICIEL]** (DPD Parcel Label Spec 2.4.1) + [VÉRIFIÉ] |
| DPD code-barres | `%` + CP(7) + tracking(14) + service(3) + pays(3) | 28 | MOD 37,36 sur les 27 caractères sans `%` (texte en clair uniquement) | **[OFFICIEL]** + [VÉRIFIÉ] |
| **GLS** | 11 chiffres + 1 clé ; « TrackID » alphanumérique (6 ou 8 caractères selon les sources) | 12 | algorithme [NON TROUVÉ] officiellement | [SECONDAIRE], sources contradictoires |
| **TNT** | 9 chiffres (8 + clé), parfois `GE` + 9 chiffres + `WW` | 9 / 13 | mod 11 avec les poids S10 | [SECONDAIRE] (paquet PyPI) ; format 9 chiffres [OFFICIEL] (tnt.com) |
| **Chronopost** | 2 lettres + 9 chiffres + 2 lettres (ex. `XX123456789FR`) ; 15 caractères depuis l'étranger | 13 / 15 | S10 probable | [SECONDAIRE] ; clé [DÉDUIT] |
| **Amazon Logistics** | `TB[ACM]` + 12 chiffres | 15 | aucune | [SECONDAIRE] (données US ; formats France [NON TROUVÉ]) |
| **Mondial Relay** | 8, 10 ou 12 chiffres ; suivi nécessitant aussi le code postal | 8 à 12 | [NON TROUVÉ] | [SECONDAIRE] |
| **Colis Privé** | - | - | - | [NON TROUVÉ] |
| Coursiers (Stuart, Coursier.fr, etc.) | aucun standard | - | - | - |

Base de référence open source réutilisable telle quelle : **`jkeen/tracking_number_data`** (fichiers JSON `couriers/*.json` contenant expressions régulières, groupes nommés, paramètres de clé et numéros de test valides et invalides), avec ses portages JS/TS (`ts-tracking-number`). Les paramètres ci-dessous en sont tirés quand aucune source officielle n'existe [SECONDAIRE].

### 1.2 Pseudo-code des clés de contrôle

Toutes ces fonctions ont été testées pendant la recherche [VÉRIFIÉ] :

```ts
// Normalisation : majuscules, suppression des espaces, des tirets et des points.
// Avant toute validation, appliquer en plus des corrections de confusion OCR
// dans les positions où seuls des chiffres sont attendus :
// O→0, I/l→1, Z→2, S→5, B→8, G→6.
const norm = (s: string) => s.toUpperCase().replace(/[\s.\-]/g, "");

// ── UPS 1Z ──────────────────────────────────────────────────────────────
// Sur les 15 caractères après "1Z" : un chiffre vaut lui-même, une lettre
// vaut (code ASCII - 63) mod 10 (A=2, B=3, …). Un caractère sur deux,
// à partir du 2e (index 1, 3, 5… en base 0), est multiplié par 2.
// Clé = (10 - somme mod 10) mod 10.
function upsValid(t: string): boolean {
  if (!/^1Z[0-9A-Z]{15}[0-9]$/.test(t)) return false;
  let sum = 0;
  [...t.slice(2, 17)].forEach((c, i) => {
    const v = /\d/.test(c) ? +c : (c.charCodeAt(0) - 63) % 10;
    sum += i % 2 === 1 ? v * 2 : v;
  });
  return (10 - (sum % 10)) % 10 === +t[17];
}
// Tests : 1Z5R89390357567127 ✔, 1Z879E930346834440 ✔, 1Z5915806855587736 ✔

// ── FedEx Express 12 chiffres ───────────────────────────────────────────
// Poids 3,1,7 répétés sur les 11 premiers chiffres (lus de gauche à droite :
// 3,1,7,3,1,7,3,1,7,3,1), puis clé = somme mod 11 mod 10.
function fedex12Valid(t: string): boolean {
  if (!/^\d{12}$/.test(t)) return false;
  const w = [3,1,7,3,1,7,3,1,7,3,1];
  const s = w.reduce((a, wi, i) => a + wi * +t[i], 0);
  return (s % 11) % 10 === +t[11];
}
// Tests : 986578788855 ✔, 794808390594 ✔ (exemple du guide FedEx)

// ── GS1 mod 10 : SSCC-18, FedEx Ground 96, Colissimo ID13 ──────────────
// Positions numérotées de droite à gauche, la clé étant en position 1.
// Les chiffres en positions paires (2, 4, …) sont multipliés par 3,
// les impaires (3, 5, …) par 1. Clé = (10 - somme mod 10) mod 10.
function mod10w31(data: string): number {
  let s = 0;
  [...data].reverse().forEach((c, i) => (s += +c * (i % 2 === 0 ? 3 : 1)));
  return (10 - (s % 10)) % 10;
}
// SSCC : mod10w31(17 chiffres après l'AI 00) === 18e chiffre.
//   Exemple FedEx : 00012345000000002 → 7 ✔
// FedEx Ground « 96 » (22 chiffres) : la clé (22e) porte seulement sur
//   les chiffres 8 à 21, soit expéditeur(7) + colis(7).
//   Exemple FedEx : 9611020 9876543 1234567 → 2 ✔
// Colissimo ID13 : la clé porte sur les 10 chiffres après le code produit.
//   Exemple La Poste : 9V 0000148195 → 2 ✔
// FedEx Ground 15 chiffres affichés : même règle (jkeen) [SECONDAIRE].

// ── UPU S10 (et TNT 9 chiffres) ─────────────────────────────────────────
function s10Check(d8: string): number {
  const w = [8,6,4,2,3,5,9,7];
  let c = 11 - (w.reduce((a, wi, i) => a + wi * +d8[i], 0) % 11);
  return c === 10 ? 0 : c === 11 ? 5 : c;
}
const s10Valid = (t: string) =>
  /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(t) && s10Check(t.slice(2, 10)) === +t[10];
// Tests : RB123456785GB ✔, EB000717618HK ✔
// TNT : /^\d{9}$/ et s10Check(t.slice(0, 8)) === +t[8]
//   Exemples du paquet : 18392825 → 2, 48025347 → 0.

// ── DHL Express 10 chiffres ─────────────────────────────────────────────
const dhlExpressValid = (t: string) =>
  /^\d{10}$/.test(t) && Number(t.slice(0, 9)) % 7 === +t[9];
// Tests : 3318810025 ✔, 8487135506 ✔
// ATTENTION : avec seulement 7 valeurs de clé possibles, environ 1 suite
// aléatoire de 10 chiffres sur 7 passe le test. Ce n'est donc PAS un
// discriminant suffisant : exiger aussi un contexte (logo DHL, mot
// « WAYBILL », présence d'un code JJD).

// ── DPD : ISO/IEC 7064 MOD 37,36 (alphanumérique) ───────────────────────
function iso7064_37_36(s: string): string {
  const A = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", M = 36;
  let cd = M;
  for (const ch of s) {
    cd += A.indexOf(ch);
    if (cd > M) cd -= M;
    cd *= 2;
    if (cd > M) cd -= M + 1;
  }
  cd = M + 1 - cd;
  if (cd === M) cd = 0;
  return A[cd];
}
// Tests de la spécification DPD : "123AB" → X ✔, "ABC987" → E ✔
// Tracking 14 chiffres : 09980000020033 → F ✔
// Code-barres 28 caractères sans le % : 008182709980000020033350276 → C ✔
```

Taux de faux positifs théoriques sur une chaîne aléatoire du bon format [DÉDUIT] : environ 1/10 pour les clés mod 10, environ 1/11 pour S10, 1/7 pour DHL et 1/36 pour DPD. **Le format seul (préfixe, longueur, alphabet) combiné à la clé** ramène le bruit OCR à un niveau acceptable. Exception : DHL 10 chiffres et Mondial Relay, pour lesquels il faut du contexte.

### 1.3 Détails par transporteur

**UPS** [SECONDAIRE, jkeen + Algorithm::CheckDigits M10_011]
- Regex : `^1Z(?<shipper>[0-9A-Z]{6})(?<service>[0-9A-Z]{2})(?<package>[0-9A-Z]{7})(?<check>\d)$`.
- Les 6 caractères `shipper` sont le **numéro de compte UPS de l'expéditeur**, également présent dans le MaxiCode. C'est une clé stable pour apprendre l'expéditeur.

**FedEx** [OFFICIEL : *FedEx Ground Bar Code & Label Layout Specification* FY04 ; *FedEx Ground Barcode Modifications*]
- Code-barres « 96 » (UCC/EAN-128, 22 chiffres de données) : `96` (AI) + SCNC `11|12|13` + classe de service (3) + ID expéditeur FedEx Ground (7) + n° de colis (7) + clé.
- Code-barres 34 chiffres (GSN) : `9622 0015 6 (000 123 4567) 1 00 7948 0839 0594` correspond à `TRK# 7948 0839 0594`. **Les 12 derniers chiffres sont le n° de suivi Express** [OFFICIEL].
- SCNC 12 signifie « code 96 accompagné d'un PDF417 », de SCAC `RPSB` ; SSCC accompagné d'un PDF417 a pour SCAC `RPSC` [OFFICIEL]. Ces valeurs dans le 2D identifient FedEx Ground.
- Le document date de 2004 (révisions ultérieures). Les étiquettes Express internationales (le cas courant à Paris) suivent la *Express Thermal Label spec*, qui confirme un PDF417 (14 colonnes au maximum) et un code ASTRA de 34 chiffres, sans en publier le contenu [OFFICIEL pour l'existence ; contenu NON TROUVÉ].

**DHL** [OFFICIEL dhl.com pour le format ; SECONDAIRE pour le reste]
- Express : « 10 digits numerical only », ou numéro commençant par `000`, `JJD01`, `JJD00`, `JVGL`… Sur l'étiquette Express, le code du haut est le **WAYBILL** (10 chiffres) et celui du bas commence par **(J)JD**, la licence plate ISO 15459 de la pièce (identifiant de données `J`) [OFFICIEL, dhlexpress.be].
- Code de routage : identifiant `2L` (ASC MH10), puis pays, code postal, `+` et un bloc produit/options de 8 chiffres (exemple Freight : `BE3500+11000002123456`). La variante GS1 utilise l'AI `403` [SECONDAIRE, spécification DHL Freight]. Il fournit le **code postal et le pays du destinataire sans OCR** [DÉDUIT : supposé identique sur les étiquettes Express].

**UPU S10 / La Poste / Colissimo international / Chronopost**
- Indicateur de service (1re lettre) : `C` colis, `E` EMS, `L` lettre suivie, `R` recommandé, `V` valeur déclarée, `U` autres. Les 2 dernières lettres désignent le pays de l'opérateur émetteur [OFFICIEL via Wikipédia, qui cite la norme UPU S10-12].
- Un recommandé international reçu de l'étranger a la forme `RR123456785DE`, et la clé S10 s'applique.

**Colissimo domestique** [OFFICIEL, note « GeoLabel national 2.1 » et documentation du Web Service d'affranchissement, avril 2022]
- Codes produit (2 premiers caractères de l'ID13) : `6A` Domicile sans signature, `6C` avec signature, `9L`/`9V` (anciens contrats), `6H`/`9H` bureau de poste, `6M`/`9M` relais/consigne, `8R` retour, `6G`/`6V` Flash, `8Q`/`7Q`/`9W`/`7U` Outre-mer, `5R`/`7R` retours. À l'international : `CA`, `CB`, `EY`, `CF`, `CM`, `CG`, `CI`, `CQ`, `EX`, au format S10.
- Code-barres 1D (Code 128) : `%` + code postal de destination sur 7 caractères + `11` + code produit + 10 chiffres + service (3) + pays ISO numérique (3). Exemple : `%0010000116C0000148195802250`. Pour retrouver l'ID13 : extraire les caractères 11 à 22 puis calculer la clé. Le 1D donne donc **sans OCR** : tracking, code postal de destination, pays et code service.
- Le préfixe `%` est le « tag d'identification Geopost », le même que chez DPD : l'étiquette Colissimo suit le format GeoLabel du groupe GeoPost/DPDgroup [OFFICIEL]. L'étiquette porte aussi un **Aztec** dont le contenu n'est pas publié [NON TROUVÉ]. Il suit probablement la structure DPD (§2.4) [DÉDUIT].

**La Poste (lettres suivies et recommandées)** [OFFICIEL, aide.laposte.fr]
- Formats : `\d[A-Z]\d{11}` (ex. `3Y00432154789`) ou `\d{14}` (ex. `87000000000000`). Le préfixe « SD » imprimé devant ne fait pas partie du numéro.
- **Dans le Data Matrix La Poste, les 14 chiffres de suivi occupent les caractères 9 à 22 de la chaîne lue.** C'est directement exploitable.
- Les préfixes spécifiques aux recommandés (1A, 2C…) et leur clé : [NON TROUVÉ] dans une source officielle.

**DPD** [OFFICIEL, *DPD Parcel Label Specification 2.4.1*, 19/01/2021]
- Tracking `DDDD X1 X2 LLLLLLLL P` : dépôt, deux chiffres de catégorie, série de 8 chiffres, puis clé MOD 37,36. Un numéro n'est pas réutilisé avant 6 mois (9 mois en contre-remboursement).
- Code 128 : `%` + `PPPPPPP` (CP) + `TTTTTTTTTTTTTT` (tracking) + `SSS` (service) + `CCC` (pays ISO numérique). La clé n'apparaît qu'en clair sous le code-barres : `PPPP PPP TTTT TTTT TTTT TT SSS CCC D`.

**GLS** [SECONDAIRE ; documentation ShipIT pour les codes 2D]
- 11 chiffres plus 1 clé. La clé n'influe pas sur le suivi (ShippyPro). Algorithme exact [NON TROUVÉ] : **ne pas rejeter un numéro GLS sur la clé**, seulement l'utiliser pour monter la confiance si elle passe en mod 10 pondéré 3-1 [DÉDUIT, à tester sur de vraies étiquettes].

**TNT** (FedEx) [OFFICIEL tnt.com pour les 9 chiffres ; SECONDAIRE pour la clé] : 9 chiffres = 8 + clé mod 11 avec les poids S10. Ce sont les mêmes 9 chiffres que dans la forme `GE#########WW` [DÉDUIT].

**Amazon, Mondial Relay, Colis Privé, coursiers** : pas de clé connue. Il faut s'appuyer sur le logo, le contexte OCR (« Mondial Relay », « Colis Privé ») et le format. Ce sont des candidats à confiance plafonnée (§4).

---

## 2. Codes 2D et contenu structuré

### 2.1 Enveloppe commune : ISO/IEC 15434 et ANSI MH10.8.3

UPS, FedEx et DPD utilisent la même syntaxe [OFFICIEL : FedEx Ground spec, DPD spec, manuel Silver Bay] :

```
[)>␞ 01␝ vv  champ1␝champ2␝…␝champN ␞ [07␝ …données propriétaires… ␞] ␄
 │    │   │                                                        └ EOT 0x04 (fin de message)
 │    │   └ version : "96" (ANSI MH10.8.3 de 1996) chez UPS/FedEx, "02" chez DPD
 │    └ format 01 = transport ; 03 = segments X12 ; 05 = AI GS1 ; 07 = format libre
 └ en-tête « [)> » + RS (0x1E)
GS = 0x1D (séparateur de champ) ; FS = 0x1C ; US = 0x1F (sous-champ, DPD)
```

Règles utiles au parseur :
- un champ vide garde son séparateur (`␝␝`) ;
- la **position** du champ donne son sens, pas une étiquette ;
- zxing-wasm signale ces contenus par `contentType === "ISO15434"` [OFFICIEL] ;
- les caractères de contrôle sont conservés dans `bytes` et dans `text`.

Champs du format 01 (transport) pour UPS et FedEx, dans l'ordre :

| # | Champ | Format |
|---|---|---|
| 1 | Code postal destinataire (préfixé par `vv` = `96`) | an 5-9 |
| 2 | Pays destinataire, ISO 3166 numérique (250 = France, 840 = USA) | n3 |
| 3 | Classe de service (transporteur) | an 1-3 |
| 4 | **Tracking** | an 1-20 |
| 5 | **SCAC** (code transporteur : `UPSN`, `RPSB`/`RPSC` FedEx Ground, `GEOP` DPD) | an 2-4 |
| 6 | N° de compte / ID expéditeur | an 1-7 |
| 7 | Jour julien de prise en charge | n3 |
| 8 | ID d'expédition (référence de l'expéditeur) | an 1-30 |
| 9 | **Colis n/N** (`1/3`) | n1-4/n1-4 |
| 10 | **Poids** (livres chez UPS/FedEx US) | r 1-8 |
| 11 | Validation adresse (Y/N) | a1 |
| 12 | **Adresse destinataire** (ligne 1) | an 1-35 |
| 13 | **Ville destinataire** | an 1-35 |
| 14 | **État ou province** | a2 |

### 2.2 UPS : MaxiCode (ISO/IEC 16023, modes 2 et 3)

[SECONDAIRE : manuel Silver Bay Software, BarcodeFAQ/IDAutomation, Canon, Wikipédia. Le *Guide to Bar Coding with UPS* officiel n'est diffusé que par les commerciaux UPS ; NON TROUVÉ en ligne.]

- **Message primaire** (anneau central, très robuste) : code postal + pays + classe de service. Mode 2 si le code postal est numérique (US), mode 3 s'il est alphanumérique (international).
- **Message secondaire** : `[)>␞01␝96` puis tracking, `UPSN`, n° expéditeur, jour julien, ID d'expédition, `n/N`, poids, Y/N, adresse, ville, état, `␞␄`. Il est limité à environ 84 caractères, d'où des adresses souvent tronquées.
- Après décodage, les bibliothèques **reconstruisent la chaîne complète** (primaire réinséré après `96`). Exemple réel (IDAutomation/BarcodeFAQ, Tampa FL) :

```
[)>␞01␝96336091062␝840␝002␝1Z14647438␝UPSN␝410E1W␝195␝␝1/1␝␝Y␝135 Reo␝TAMPA␝FL␞␄
  vv=96, CP=336091062 │ pays 840 │ service 002 │ tracking court │ SCAC │ n° expéditeur │ jour 195 │ 1/1 │ addr │ ville │ état
```

- **Le champ tracking du MaxiCode n'est PAS le 1Z complet** : il vaut `1Z` + 7 caractères du n° de colis + la clé (10 caractères). **Reconstruction : `1Z` + n° expéditeur (champ 6) + 2 derniers chiffres de la classe de service + `tracking.slice(2)`**. Sur l'exemple : `1Z` + `410E1W` + `02` + `1464743` + `8` = `1Z410E1W0214647438`, **validé par la clé UPS** (et `…03…` échoue). [DÉDUIT puis VÉRIFIÉ sur un exemple. La clé rend la reconstruction auto-vérifiable : on ne garde le résultat que si `upsValid` est vrai.]
- **MaxiCode « compressé »** : depuis 2001, UPS utilise une compression **propriétaire** (DLL UPS) pour faire tenir l'adresse complète [SECONDAIRE, Silver Bay]. Sur ces étiquettes, la partie adresse décodée peut être illisible. On garde alors CP, pays, service, tracking, n/N et poids, et l'adresse vient de l'OCR [DÉDUIT : proportion d'étiquettes concernées inconnue, à mesurer sur le terrain].
- Le **poids est en livres** sur les étiquettes US (« rounded up to the next pound »). Pour les envois internationaux, l'unité est à vérifier : comparer avec le texte « KG »/« LBS » lu par OCR [DÉDUIT].
- Pour Saint Laurent Paris (destinataire) : le pays doit valoir `250` et le CP `75007` (mode 3, padding possible). **C'est un contrôle de cohérence gratuit.**

### 2.3 FedEx : PDF417 (ISO/IEC 15438)

[OFFICIEL : *FedEx Ground Label Layout Specification*, enveloppes 01 et 03]

- **Enveloppe 01** (obligatoire, en premier) : les 14 champs du tableau §2.1. CP limité à 5 chiffres ou 6 caractères alphanumériques, tracking de 15 chiffres (Ground) ou 20 (SSCC), SCAC `RPSB`/`RPSC`, poids en livres décimal (`145.05`), « container n of x ».
- **Enveloppe 03** (segments X12, séparateurs FS/GS/US) :
  - `N1␝ST␝<raison sociale destinataire>` (obligatoire) ;
  - `N2` (complément de nom) ;
  - `N3` (adresse lignes 2 et 3) ;
  - `N4␝ville␝état␝CP␝pays` ;
  - `G61␝DC␝<nom contact>␝AD␝<téléphone>` (obligatoire) ;
  - `NTE␝DEL␝AAAAMMJJ` (date certaine) ;
  - `L11` (références client, n° d'origine en retour).
- **Destinataire complet** (société, contact, téléphone, adresse) : oui. **Expéditeur** : non, seulement l'ID expéditeur en 01. En tiers payant, l'enveloppe 03 ajoute des données de facturation.
- FedEx **Express** (international, le cas le plus fréquent à Paris) : le PDF417 existe [OFFICIEL] mais son contenu n'est pas public [NON TROUVÉ]. Il est probablement en `[)>␞01␝96…` également [DÉDUIT]. Le parseur doit être tolérant : détecter l'enveloppe et mapper les champs par position seulement si le SCAC ou la forme du tracking concordent.

### 2.4 DPD (et probablement Colissimo et Chronopost) : Aztec (ISO/IEC 24778)

[OFFICIEL : *DPD Parcel Label Specification 2.4.1*, §4.4 et annexe 11.7]

Aztec en Latin-1, 1 000 caractères au maximum. Structure : `[)>␞01␝02` (bloc ISO), puis `␞07␝` et des blocs GeoPost (`STD`, `S01` à `S05`), sous-champs séparés par US. Champs utiles :

| Bloc | Champs (noms de la spécification) | Intérêt pour nous |
|---|---|---|
| ISO | `DestZipCode`, `DestCountryCode`, `ServiceCode`, **`ParcelNumber`** (14), `SCAC`=`GEOP`, **`CustAccNumber`** (compte expéditeur), `JDPickup`, `ConsCustRef1` (référence), **`RangInNumber`** (`001/003` = colis n/N), **`DeclaredWeight`**, `RecStreet`, `RecTown`, `RecState`, **`RecCompName1`** | tracking, destinataire, n/N, poids, référence |
| STD | **`RecContact`** (nom du destinataire), `RecCompName2` (service/département), `RecContactPho1/2`, `RecNotifMob`, `RecNotifEMail`, `RecAdd2/3`, **`TotalWeight`**, **`NotifSenderComp`** et **`NotifSenderContact`** (société et contact expéditeur pour la notification), `SendParcelRef`, `RecParcelRef`, `ContDescr` (description du contenu) | **nom de la personne destinataire**, étage/service, **expéditeur** |
| S01 | **`SendCompName`, `SendStreet`, `SendTown`, `SendZipCode`, `SendCountryCode`, `SendPhone`, `Contact`** | **adresse complète de l'expéditeur. Obligatoire seulement hors UE**, facultative sinon |
| S02 | contre-remboursement (montant, devise) | - |
| S03 | douane (TVA, valeur, incoterm, articles) | - |
| S05 | `PERSNAME`, `PERSFLOOR`, `PERSBUILDUNG`, `PERSDEPARTMENT` (livraison personnalisée : nom, étage, bâtiment, service), `MPSID` (expédition multi-colis), `ODEPOT`, `ONAME1`, `OSTREET`… (origine) | destinataire très précis, **origine** |

**DPD est le transporteur dont le 2D est le plus riche, et le seul à prévoir des champs expéditeur.** Ils ne sont garantis que hors UE ; ailleurs, ils ne sont remplis que si le logiciel d'expédition le fait.

Colissimo (« tag Geopost » `%`, même 1D que DPD) et Chronopost (filiale du groupe) impriment eux aussi un Aztec [OFFICIEL pour Colissimo]. Ils utilisent **probablement la même structure** [DÉDUIT, NON VÉRIFIÉ]. Le parseur DPD est à essayer en premier sur tout Aztec commençant par `[)>␞01␝02`.

### 2.5 GLS : deux Data Matrix

[SECONDAIRE : documentation ShipIT (GLS), résumée par la recherche ; spécification octet par octet NON TROUVÉE]

- Data Matrix ECC 200, Latin-1, 127 caractères au maximum, 18×18 mm minimum.
- **Le code primaire** (à gauche) identifie l'unité de transport et contient le routage, le produit et le service. **Le code secondaire** (à droite) contient **toutes les données d'adresse du destinataire**. La documentation indique que les codes 2D portent « routing, product, service, shipper and consignee address information ».
- La disposition des champs n'étant pas publique, il faut l'extraire en relevé terrain : photographier 5 à 10 étiquettes GLS reçues et décoder les deux Data Matrix pour cartographier les champs [À FAIRE].

### 2.6 GS1 : GS1-128, GS1 DataMatrix et GS1 QR (Scan4Transport)

[OFFICIEL : dictionnaire de syntaxe GS1 ; GS1 Scan4Transport]

Identifiants d'application (AI) utiles quand un expéditeur étiquette lui-même ses colis (logistique de marques, pharma, etc.) :

| AI | Contenu | Format |
|---|---|---|
| `00` | **SSCC** (identifiant unique du colis) | N18 + clé mod 10 |
| `401` / `402` | n° de consignation (GINC) / d'expédition (GSIN) | X..30 / N17 + clé |
| `403` | code de routage | X..30 |
| `410` | GLN du lieu de livraison | N13 |
| `420` / `421` | **CP de livraison** (national / avec pays ISO numérique) | X..20 / N3+X..9 |
| `3300`-`3305` | **poids brut en kg** (le dernier chiffre de l'AI donne la position de la virgule) | N6 |
| `4300`-`4309` | **destinataire** : société, nom, adresse 1 et 2, quartier, ville, région, pays (alpha-2), téléphone, coordonnées GPS | X..35 à X..70, encodage pourcent |
| `4310`-`4319` | **adresse de retour** (« return to »), en pratique **souvent l'expéditeur** : société, nom, adresse, ville, CP, pays, téléphone | idem |
| `4320` | description du service | X..35 |
| `4321`-`4326` | marchandises dangereuses, dépôt autorisé, **signature requise**, fenêtres de livraison, date de remise | N1 / dates |
| `4330`-`4333` | températures min et max | - |
| `90`, `91`-`99` | données internes de l'entreprise | X..30 / X..90 |

zxing-wasm signale ces contenus par `contentType === "GS1"`. En mode texte HRI, les AI sont restitués entre parenthèses, ce qui les rend faciles à parser.

### 2.7 Ce qu'on obtient sans OCR

| Champ | UPS (MaxiCode + 1D) | FedEx Ground (PDF417 + 96) | FedEx Express | DHL Express | DPD (Aztec + 1D) | Colissimo (1D + Aztec) | La Poste (Data Matrix) | GLS (2 Data Matrix) | GS1 Scan4Transport |
|---|---|---|---|---|---|---|---|---|---|
| Tracking | ✅ (reconstruit et validé) | ✅ | ✅ (34 chiffres → 12) | ✅ (waybill + JJD) | ✅ | ✅ (1D) | ✅ (car. 9-22) | ✅ (primaire) | ✅ (SSCC) |
| Transporteur | ✅ `UPSN` | ✅ `RPSB`/`RPSC` | ✅ format | ✅ format | ✅ `GEOP` + `%` | ✅ `%` + `11` | ✅ | ✅ | ❌ (lié au préfixe GS1) |
| CP et pays destinataire | ✅ | ✅ | ? | ✅ (`2L`) | ✅ | ✅ (1D) | ? | ✅ | ✅ 420/421 |
| Nom/société destinataire | ❌ | ✅ (03 : N1, G61) | ? | ❌ | ✅ (`RecCompName1`, `RecContact`, `PERSNAME`) | ? [DÉDUIT ✅] | ❌ | ✅ | ✅ 4300/4301 |
| Adresse destinataire | ⚠️ (tronquée ou compressée) | ✅ | ? | ❌ | ✅ | ? | ❌ | ✅ | ✅ |
| **Expéditeur** | ❌ (n° de compte seulement) | ❌ (ID seulement) | ? | ❌ | ⚠️ (S01 hors UE ; `NotifSender*` ; compte) | ? | ❌ | ⚠️ (« shipper » cité) | ⚠️ 4310+ |
| Colis n/N | ✅ | ✅ | ? | ❌ (texte) | ✅ | ❌ | - | ? | ❌ |
| Poids | ✅ (lb aux US) | ✅ (lb) | ? | ❌ | ✅ | ❌ | - | ? | ✅ 330n |
| Service | ✅ (code) | ✅ (code) | ? | ✅ (bloc produit `2L`) | ✅ (code) | ✅ (code) | - | ✅ | ⚠️ 4320 |
| Référence | ⚠️ (ID d'expédition) | ⚠️ (03 L11) | ? | ❌ | ✅ (`ConsCustRef1`, `SendParcelRef`) | ? | - | ? | ⚠️ 91-99 |
| Date | ⚠️ (jour julien de prise en charge) | ⚠️ (jour julien) | ? | ❌ | ⚠️ (jour julien) | ❌ | - | ? | ⚠️ 4324-4326 |

Légende : ✅ présent et documenté ; ⚠️ partiel ou conditionnel ; ❌ absent ; ? inconnu (non publié).

**Conclusion clé.** En décodant les 2D, on obtient **sans OCR** le tracking, le transporteur, le code postal et le pays du destinataire, le service et, selon le transporteur, le nom ou la société du destinataire, le n/N et le poids. **L'expéditeur reste majoritairement une affaire d'OCR**, avec deux renforts :
- le n° de compte expéditeur (UPS champ 6 et caractères 3 à 8 du 1Z, FedEx Ground ID expéditeur, DPD `CustAccNumber`), associé à un dictionnaire appris (§4.5) ;
- les blocs expéditeur DPD et GS1 quand ils sont présents.

Le **destinataire interne** (la personne chez Saint Laurent) vient du 2D chez FedEx (G61), DPD (`RecContact`, `PERSNAME`) et GLS, et de l'OCR ailleurs.

---

## 3. Bibliothèques de décodage pour Safari iOS (état en octobre 2026)

| Solution | Version / date | Formats utiles | MaxiCode | Multi-codes | Hors ligne | Licence / prix | Verdict |
|---|---|---|---|---|---|---|---|
| **zxing-wasm** (Sec-ant, portage WASM de zxing-cpp) | **3.1.6** (19/10/2026), zxing-cpp 3.1.1 | Code 128/GS1-128, Code 39/93, ITF, EAN/UPC, DataBar, **PDF417** (y compris Compact et Micro), **Data Matrix**, **Aztec**, QR | ✅ **image pure uniquement** (droit, non déformé, binarisé, bordure blanche) | ✅ `maxNumberOfSymbols` (255 par défaut) | ✅ (WASM auto-hébergé, ~1,04 Mio pour le lecteur seul) | Apache-2.0, gratuit | **Recommandé** |
| `barcode-detector` (polyfill Sec-ant) | 3.2.3 (19/10/2026) | API BarcodeDetector standard, construite sur zxing-wasm | idem | ✅ | ✅ | MIT | Option d'interface si l'on veut coder « au standard » |
| BarcodeDetector natif | - | - | - | - | - | - | ❌ **Absent sur iOS.** Bug WebKit 281848 « Shape Detection API doesn't work on iOS » toujours NEW (dernier commentaire en juillet 2026) ; derrière un drapeau, sans détection, même activé sur iOS 18 et 26 |
| @zxing/library (JS pur) | 0.23.0 (29/04/2026) | 1D, QR, Data Matrix, Aztec, PDF417, MaxiCode | ✅ pur uniquement (« MaxiCode reader effectively always assumes PURE_BARCODE ») | partiel (`GenericMultipleBarcodeReader`) | ✅ | Apache-2.0 | Plus lent que le WASM, moins tolérant. Non recommandé |
| @undecaf/zbar-wasm | 0.11.0 (05/2024) | 1D, QR **uniquement** | ❌ | ✅ | ✅ | LGPL | ❌ Pas de PDF417, Data Matrix ni Aztec |
| **Dynamsoft Barcode Reader JS** | v11 | tous, y compris **MaxiCode**, PDF417, Data Matrix, Aztec, GS1 Composite | ✅ (détecteur réel) | ✅ | licence de type « per scan » ; hors ligne à négocier | ~**1 371 $/an pour 10 000 scans** (revendeur ComponentSource, v11) | Plan B si MaxiCode est indispensable et que la piste maison échoue |
| **Scandit Web SDK** | - | tous, y compris **MaxiCode** (à activer explicitement ; disponibilité « selon votre contrat ») | ✅ (non pris en charge en MatrixScan) | ✅ | à négocier | sur devis | Haut de gamme, coûteux |
| **STRICH** | - | 1D, PDF417, QR, Data Matrix, Aztec | ❌ (aucune mention) | ✅ | **hors ligne en option** des offres Business et Enterprise ; sinon vérification de licence en ligne | ~99 $/mois (Basic), 249 $/mois (Pro), 5 000 $/an (Enterprise) d'après Capterra | ❌ pour UPS |

**Options zxing-wasm à utiliser** [OFFICIEL, documentation ReaderOptions] : `tryHarder: true`, `tryRotate: true`, `tryInvert: true`, `tryDownscale: true` (avec `downscaleFactor` et `downscaleThreshold`), `tryDenoise: true` (expérimental, aide les 2D abîmés), `binarizer` (`LocalAverage` par défaut, essayer `GlobalHistogram` en second passage), `returnErrors: true` (récupérer les codes à clé fausse pour le diagnostic), `formats` restreint (accélère), `isPure: true` (uniquement pour le recadrage MaxiCode).

Le `ReadResult` expose notamment `bytes` (brut), `text`, `format`, `symbologyIdentifier` (`]C1` = GS1-128, `]d2` = GS1 DataMatrix…), `position` (4 coins, utile pour localiser les zones OCR), `rotation`, `contentType` (`GS1`, `ISO15434`…) et `sequenceSize/Index` (append structuré).

### 3.1 Recommandations de mise en œuvre [DÉDUIT de la documentation et de l'expérience v1]

1. **Décoder sur la photo pleine résolution** (`<input type="file" accept="image/*" capture="environment">`, 12 Mpx) plutôt que sur des images vidéo `getUserMedia` (720p à 1080p, auto-focus capricieux en PWA standalone ; plusieurs bugs WebKit et Apple Forums signalés sur iOS 17 et 18). Une étiquette 4×6" occupe ainsi des milliers de pixels, ce que demandent le PDF417 et le MaxiCode.
2. **Stratégie multi-passes dans un Web Worker** (aucun blocage de l'interface ; WASM chargé une seule fois et mis en cache par le Service Worker pour le hors ligne) :
   1. Passe 1 : image entière réduite à environ 2 000 px, tous formats, `maxNumberOfSymbols: 16`.
   2. Passe 2 : pleine résolution découpée en **tuiles de 50 % avec 25 % de recouvrement**. Elle récupère les petits codes et réduit l'effet du flou local.
   3. Passe 3 sur les zones où un code est attendu mais absent (on sait d'après le premier code lu à quel transporteur on a affaire) : agrandissement ×1,5 à ×2, contraste local (CLAHE) et autre binariseur.
   4. Arrêt anticipé dès que tous les codes attendus pour ce transporteur sont lus.
3. **MaxiCode « maison »** [DÉDUIT, à prototyper] :
   1. Détecter l'œil central (6 anneaux concentriques noir/blanc). Le chercher dans la zone attendue (UPS : quart haut gauche de l'étiquette, à gauche du bloc de routage) par transformée de Hough sur des cercles ou par recherche de motifs radiaux.
   2. Estimer la taille (symbole d'environ 28×27 mm, 33 rangées de 30 hexagones) et l'orientation grâce aux 6 motifs d'orientation autour de l'œil.
   3. Redresser par homographie (OpenCV.js ou code maison) vers une image de 30×33 modules, binarisée et entourée de blanc.
   4. Appeler `readBarcodes(image, { formats: ["MaxiCode"], isPure: true })`.
   5. Repli : décodage réussi du primaire seul, ou abandon. L'OCR prend alors le relais pour le CP, et le 1Z vient du Code 128.

   Un MaxiCode non lu n'empêche pas d'avoir le tracking : **l'étiquette UPS porte aussi le 1Z en Code 128**.
4. **Contrôler les coûts** : charger le WASM à la demande (`prepareZXingModule`), le pré-cacher à l'installation de la PWA, et limiter `formats` après détection du transporteur.
5. **Banc d'essai indispensable** : constituer dès maintenant un corpus de 100 à 200 photos réelles d'étiquettes reçues au 37 Bellechasse (avec accord de l'entreprise, données floutées pour le dépôt). Mesurer le taux de lecture par format et par transporteur, puis comparer zxing-wasm seul, zxing-wasm avec détecteur MaxiCode maison, et une version d'essai de Dynamsoft.

---

## 4. Stratégie de fusion recommandée

### 4.1 Pipeline

```
Photo pleine résolution
  ├─► [A] Décodage codes-barres (zxing-wasm, multi-passes, Worker)
  │      ├─ 2D structurés → parseurs dédiés : ISO 15434 (UPS/FedEx/DPD), GS1 AI, La Poste DM, GLS
  │      └─ 1D → classifieur de formats (regex jkeen + clés §1.2)
  ├─► [B] Identification du transporteur = vote (SCAC du 2D, format du tracking, logo/mots-clés OCR)
  ├─► [C] OCR guidé par zones (gabarit par transporteur ; positions issues de result.position des codes)
  │      └─ sur chaque candidat : regex de format + clé + correction de confusions O/0, I/1, S/5, B/8
  ├─► [D] Fusion par champ + score de confiance + recoupements
  └─► [E] Interface : champs ≥ seuil pré-remplis ; champs < seuil surlignés pour confirmation ; saisie
```

### 4.2 Ordre de priorité des sources (par champ)

| Rang | Source | Confiance de base |
|---|---|---|
| 1 | Champ issu d'un **2D structuré** décodé (Reed-Solomon intégré : un décodage réussi est quasi certainement exact) **et** cohérent avec la structure attendue | 0,97 |
| 2 | Tracking issu d'un **1D** dont le format est reconnu **et la clé transporteur valide** | 0,95 |
| 3 | Valeur déduite d'un code (pays via code ISO numérique, transporteur via SCAC ou préfixe, tracking UPS reconstruit puis validé) | 0,93 |
| 4 | 1D sans clé transporteur connue (Mondial Relay, Amazon, GLS) mais au format reconnu. La symbologie Code 128 a sa propre clé interne, donc la lecture est fiable ; c'est l'attribution du format qui l'est moins. | 0,85 |
| 5 | **OCR dans la zone attendue + format + clé valide** | 0,85 |
| 6 | OCR dans la zone attendue + format valide (pas de clé disponible) | 0,65 |
| 7 | OCR hors zone, ou sans validation de format | 0,40 |
| 8 | Valeur par défaut, historique ou dictionnaire | 0,30 à 0,90 selon le cas (§4.5) |
| 9 | Saisie manuelle | 1,00 (vérité de référence, réinjectée dans l'apprentissage) |

### 4.3 Ajustements (bonus et malus)

- **Recoupement concordant entre deux sources indépendantes** (ex. tracking du 2D = tracking du 1D ; CP du 2D = CP lu par OCR dans le bloc « SHIP TO » ; n/N du 2D = « 1 OF 3 » lu par OCR) : confiance = `1 - (1-c1)(1-c2)`, plafonnée à 0,99.
- **Contradiction** : garder la source de rang supérieur, appliquer un malus de 0,15 et **marquer le champ pour vérification**.
- **Cohérence métier** :
  - destinataire attendu à Paris : CP `75007` et pays `250`/`FR`. Un 2D qui indique autre chose est soit une réexpédition, soit une erreur de parseur, ce qui donne un malus et un drapeau ;
  - nom du destinataire présent dans l'**annuaire interne** des collaborateurs : bonus de 0,10 (correspondance approximative de type Jaro-Winkler au-dessus de 0,92) ;
  - poids plausible (0,01 à 70 kg ; conversion en livres si le code est d'origine US) ;
  - n ≤ N.
- **Transporteur** : vote pondéré entre le SCAC du 2D (1,0), le format et la clé du tracking (0,9), le logo ou un mot-clé OCR (0,6) et la mise en page (0,4). Si deux transporteurs sont à égalité, poser la question.

### 4.4 Règles par champ (synthèse)

| Champ | Source n° 1 | Repli | Contrôle |
|---|---|---|---|
| Tracking | 1D validé par clé, ou 2D | OCR + clé | égalité 1D/2D ; unicité sur 6 mois dans la base |
| Transporteur | SCAC / format | logo OCR | vote |
| Destinataire (personne) | 2D (FedEx G61, DPD `RecContact`/`PERSNAME`, GLS, GS1 4301) | OCR du bloc « SHIP TO / À / DESTINATAIRE » | annuaire interne |
| Service ou étage interne | 2D DPD `RecCompName2`/`PERSDEPARTMENT`/`PERSFLOOR` | OCR (« Attn », « c/o », « Service ») | liste des services Saint Laurent |
| **Expéditeur** | DPD S01/`NotifSender*`, GS1 4310+ | **dictionnaire n° de compte → expéditeur** (§4.5), puis OCR du bloc « FROM / EXPÉDITEUR / SHIP FROM » | dictionnaire des expéditeurs déjà vus (correspondance approximative) |
| Colis n/N | 2D (UPS, FedEx, DPD) | OCR « 1 OF 3 », « 1/3 », « Colis 1 sur 3 » | n ≤ N ; regroupement par n° d'expédition |
| Poids | 2D | OCR « KG/LBS » | plage plausible |
| Service | 2D (code) avec table de libellés | OCR (« EXPRESS SAVER », « 2ND DAY »…) | - |
| Référence | 2D (DPD `ConsCustRef1`, UPS ID d'expédition, FedEx L11) | OCR « REF » | - |
| Date | **horodatage de la prise de vue** (date de réception = donnée métier principale) | jour julien du 2D (date d'expédition) | - |

### 4.5 Apprentissage local de l'expéditeur (forte valeur ajoutée) [DÉDUIT, recommandation]

L'expéditeur est le champ que la v1 ratait. Plusieurs codes portent un **identifiant de compte expéditeur stable** :
- UPS : caractères 3 à 8 du 1Z, ou champ 6 du MaxiCode ;
- FedEx Ground : ID expéditeur (chiffres 8 à 14 du « 96 ») ;
- DPD : `CustAccNumber` ;
- éventuellement le préfixe d'entreprise GS1 du SSCC.

Recommandation :
1. Créer une table IndexedDB `expediteurs(transporteur, compte) → {nom, adresse, dernièreVue, nbVues}`.
2. À chaque validation par l'opérateur, associer le compte décodé à l'expéditeur confirmé.
3. Au scan suivant, si le compte est connu, **pré-remplir l'expéditeur avec une confiance de 0,90** (0,95 au-delà de 3 confirmations), sans OCR.
4. En l'absence de compte : correspondance approximative entre le texte OCR du bloc expéditeur et cette table (les mêmes maisons, fournisseurs et agences reviennent sans cesse).

### 4.6 Seuils d'interface (à calibrer sur le corpus)

- confiance ≥ 0,90 : pré-rempli, sans mise en évidence ;
- 0,60 ≤ confiance < 0,90 : pré-rempli et **surligné** (« à vérifier ») ;
- confiance < 0,60 : champ vide, avec la meilleure suggestion proposée en liste.

Le tracking et le destinataire sont **obligatoires** : l'enregistrement est impossible tant qu'ils n'ont pas atteint 0,90 ou été confirmés.

---

## 5. Points ouverts et vérifications terrain à prévoir

1. Corpus réel : mesurer le taux de lecture des MaxiCode UPS photographiés, avec et sans détecteur maison. **Décision Dynamsoft (achat ou non)** en fonction du résultat.
2. Confirmer sur de vrais MaxiCode la règle de reconstruction du 1Z (vérifiée sur un seul exemple public) et la fréquence du MaxiCode « compressé ».
3. Décoder des Aztec Colissimo et Chronopost pour confirmer la structure GeoPost/DPD.
4. Décoder des Data Matrix GLS (primaire et secondaire) et La Poste pour cartographier les champs.
5. Relever le contenu des PDF417 FedEx Express internationaux et des éventuels 2D DHL Express.
6. Collecter des numéros Mondial Relay, Colis Privé, Amazon France et Chronopost pour fiabiliser les regex et tester l'hypothèse S10 chez Chronopost.
7. Vérifier l'algorithme GLS (11+1) sur de vrais numéros.

---

## 6. Sources

**Normes et organismes**
- UPU S10 (PDF officiel) : https://upu.int/UPU/media/upu/files/postalSolutions/programmesAndServices/standards/S10-12.pdf
- S10 sur Wikipédia (algorithme et indicateurs) : https://en.wikipedia.org/wiki/S10_(UPU_standard)
- MaxiCode sur Wikipédia (ISO/IEC 16023, modes 2 et 3) : https://en.wikipedia.org/wiki/MaxiCode
- Dictionnaire de syntaxe GS1 (AI 00, 401-403, 410-421, 330n, 4300-4333) : https://github.com/gs1/gs1-syntax-dictionary
- GS1 Scan4Transport : https://www.gs1.org/docs/barcodes/GSCN_18-207_Scan4Transport.pdf ; https://www.gs1.org/articles/new-gs1-scan4transport-pilot-report-details-learning-and-recommendations-pilots-conducted-2021
- Registre ISO/IEC 15459 des agences émettrices (AIM) : https://www.aimglobal.org/wp-content/uploads/2026/06/Register-IAC-15459-2-20260616.pdf

**Transporteurs (officiels)**
- DPD Parcel Label Specification 2.4.1 (tracking, MOD 37,36, Code 128, Aztec ISO 15434) : https://esolutions.dpd.com/dokumente/DPD_Parcel_Label_Specification_2.4.1_EN.pdf
- FedEx Ground Bar Code & Label Layout Specification (archivée sur le wiki jkeen) : https://github.com/jkeen/tracking_number_data/files/9955465/FedEx_Ground_Label_Layout_Specification.pdf
- FedEx Ground Barcode Modifications (GSN, 34 chiffres) : https://github.com/jkeen/tracking_number_data/files/9955462/barcode_guide.pdf
- FedEx Express Thermal Label : https://github.com/jkeen/tracking_number_data/files/9955463/Express_Thermal_Label.pdf
- Colissimo, note « format GeoLabel national 2.1 » (1D enrichi, clé ID13, Aztec) : https://www.colissimo.entreprise.laposte.fr/sites/default/files/2021-03/note-format-GeoLabel-national_2.1_ELA.pdf
- Colissimo, Web Service d'affranchissement (codes produit), avril 2022 : https://www.colissimo.entreprise.laposte.fr/sites/default/files/2022-04/DT_Flexibilite_Expedition_Web_Service_Affranchissement_202204_FR.pdf
- La Poste, formats des courriers suivis et Data Matrix : https://aide.laposte.fr/contenu/ou-trouver-le-numero-de-mon-courrier-suivi
- DHL, formats d'identifiants de suivi : https://dhl.com/pl-en/home/tracking/id-labels.html
- DHL Express ou eCommerce (WAYBILL, (J)JD) : https://www.dhlexpress.be/en/support/how-can-i-tell-the-difference-between-a-dhl-express-and-a-dhl-ecommerce-label
- DHL Freight label definition (routage 2L) : https://www.dhl.com/content/dam/dhl/global/dhl-freight/documents/posted-documents/glo-freight-label-definition.pdf
- GLS ShipIT (Barcodes Primary2D, Secondary2D) : https://shipit-download.gls-group.eu/webservices/3_1_9/doxygen/WS-REST-API/classeu_1_1glsgroup_1_1fpcs_1_1datatypes_1_1soap_1_1v1_1_1shipmentprocessing_1_1_barcodes.html ; https://shipit.gls-group.eu/webservices/2_9_12/doxygen/WS-SOAP-API/soap_custom_label_generation.html
- TNT, n° de consignation à 9 chiffres : https://www.tnt.com/express/en_gb/site/support.html

**Secondaires (formats, clés, MaxiCode)**
- jkeen/tracking_number_data (regex et paramètres de clé) : https://github.com/jkeen/tracking_number_data ; implémentation des clés : https://github.com/jkeen/tracking_number/blob/main/lib/tracking_number/checksum_validations.rb ; wiki : https://github.com/jkeen/tracking_number_data/wiki
- ts-tracking-number (portage TS) : https://github.com/rjbrooksjr/ts-tracking-number
- Algorithm::CheckDigits M10_011 (UPS) : https://www.metacpan.org/pod/Algorithm::CheckDigits::M10_011
- Neodynamic, clé DHL AWB mod 7 : https://www.neodynamic.com/Products/Help/BarcodeWPF5.0/html/M_Neodynamic_WPF_BarcodeUtils_GetDhlAwbChecksum.htm
- Paquet PyPI modulus11 (clé TNT) : https://pypi.org/project/modulus11/0.1/
- Silver Bay Software, manuel MaxiCode (structure UPS, compression propriétaire) : https://www.silverbaytech.com/files/maxicode/maxi_api.pdf
- BarcodeFAQ / IDAutomation, exemple MaxiCode UPS : https://www.barcodefaq.com/2d/maxicode/
- Canon, formats MaxiCode UPS : https://oip.manual.canon/USRMA-0976-zy-OP-enUS/contents/devu-barcode_prt-usg_fmat.html
- ingridhq/maxicode (exemple de chaîne UPS) : https://github.com/ingridhq/maxicode
- ShippyPro, clé GLS : https://help.shippypro.com/en/articles/4900547-how-to-connect-gls-poland-to-shippypro
- paketda.de (GLS, clés allemandes) : https://www.paketda.de/firmenkunden/gls-paketaufkleber.html ; https://www.paketda.de/firmenkunden/paket-pruefziffern.html
- Formats Chronopost, Mondial Relay et La Poste (agrégateurs) : https://parcelsapp.com/fr/carriers/chronopost-france ; https://parcelsapp.com/fr/carriers/mondial-relay ; https://www.packlink.com/fr-FR/suivi-envois/mondial-relay/ ; https://www.trackingmore.com/tracking-status-detail-id-239.html

**Bibliothèques et navigateurs**
- zxing-wasm (README, formats, note MaxiCode) : https://github.com/Sec-ant/zxing-wasm ; ReaderOptions : https://sec-ant.github.io/zxing-wasm/docs/interfaces/full.ReaderOptions.html ; ReadResult : https://sec-ant.github.io/zxing-wasm/docs/interfaces/full.ReadResult.html
- zxing-cpp (« MaxiCode : partial read support » ; `MCReader.cpp` « only works with effectively 'pure' barcodes ») : https://github.com/zxing-cpp/zxing-cpp ; https://github.com/zxing-cpp/zxing-cpp/blob/master/core/src/maxicode/MCReader.cpp
- barcode-detector (polyfill) : https://github.com/Sec-ant/barcode-detector
- @zxing/library (MaxiCodeReader, mode PURE) : https://github.com/zxing-js/library/blob/master/src/core/maxicode/MaxiCodeReader.ts
- zbar-wasm : https://github.com/undecaf/zbar-wasm
- Bug WebKit 281848 (Shape Detection API absente sur iOS) : https://bugs.webkit.org/show_bug.cgi?id=281848 ; Apple Forums : https://developer.apple.com/forums/thread/767761
- Caméra en PWA iOS : https://firt.dev/notes/pwa-ios/ ; https://developer.apple.com/forums/thread/769203 ; https://bugs.webkit.org/show_bug.cgi?id=275527
- Dynamsoft (symbologies) : https://www.dynamsoft.com/barcode-reader/barcode-types/ ; prix revendeur : https://www.componentsource.com/product/barcode-reader/prices
- Scandit (symbologies) : https://docs.scandit.com/supported-symbologies.html ; MatrixScan sans MaxiCode : https://docs.scandit.com/6.28.10/sdks/ios/matrixscan/intro/
- STRICH : https://strich.io/faq/ ; prix : https://www.capterra.com/p/10020686/STRICH/
