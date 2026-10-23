# Spike S2 · codes-barres

Ticket YSL-11 (cahier des charges v2, §10.1 S2). Mesurer zxing-wasm sur le corpus
d'étiquettes (`@repo/corpus`, YSL-5) et relever le contenu réel des codes 2D. Prototype :
[`apps/spike-barcode`](../../apps/spike-barcode) : un banc d'essai Node sur le corpus et une
PWA iPhone qui compare le viseur et la photo native sur les mêmes colis.

| Critère  | Seuil                                                                           |
| -------- | ------------------------------------------------------------------------------- |
| Tracking | lu par code-barres sur ≥ 90 % du corpus (base : étiquettes web et réelles)      |
| 2D       | contenu des Aztec, Data Matrix, PDF417 et MaxiCode relevé, structure documentée |
| Mode     | taux par format et par transporteur, en viseur et en photo native               |
| MaxiCode | avec et sans recadrage maison                                                   |
| Sinon    | photo native par défaut pour les transporteurs à 2D ; MaxiCode : piste gratuite |

D11 : MaxiCode lu par le meilleur outil **gratuit**, mélange possible, pas de Dynamsoft
payant. Le repli « essai de Dynamsoft » du §10.1 ne s'applique plus.

## Base du critère

Le corpus compte 244 étiquettes : 96 de synthèse, 143 du web, 5 photos réelles du service.
Le critère se compte sur les étiquettes **web et réelles dont le tracking est connu**
(130). La synthèse, dont les codes sont générés propres, est donnée à part comme témoin :
elle vérifie le lecteur, pas la difficulté réelle.

Une étiquette compte comme lue quand le tracking de sa vérité terrain se retrouve dans le
contenu d'au moins un code (`src/decode/match.ts`) : en clair, sans séparateurs, sans sa
clé de contrôle (Colissimo dans l'Aztec), ou recomposé (UPS dans le MaxiCode).

## Lecteur

zxing-wasm 3.1.6 (zxing-cpp en WebAssembly), `.wasm` **auto-hébergé** : le chargement par
défaut depuis jsDelivr est neutralisé à l'exécution et au build. Options : `tryHarder`,
`tryRotate`, `tryInvert`, `tryDownscale`, 15 formats (1D, PDF417, Aztec, Data Matrix, QR,
MaxiCode). `BarcodeDetector` est ignoré : absent sur iOS (§6).

Stratégie de lecture, les mêmes étapes dans le banc et dans le Worker de la PWA :

1. image entière réduite à 1 600 px, puis 2 400 px ;
2. tuiles pleine résolution de 2 048 px, recouvrement 512 px, chaque tuile sous la limite
   de 16,7 Mpx d'un canvas Safari ; symboles lus deux fois dédoublonnés ;
3. MaxiCode recadré : zxing ne lit le MaxiCode que sur une image « pure » (symbole seul,
   droit, centré). Le recadrage maison cherche l'œil de bœuf (anneaux concentriques), en
   estime la taille et la rotation, puis extrait un carré redressé et rééchantillonné lu en
   mode pur.

Le banc arrête la cascade dès que le tracking attendu est lu, ce que l'app ne peut pas
savoir : ses taux sont un meilleur cas. La PWA enchaîne toutes les étapes par défaut
(« Toutes les étapes ») et affiche tous les codes lus, pour que le test iPhone mesure la
même chose sans connaître le tracking.

## Résultats du banc (corpus, 23/10/2026)

Mac, Node, un fil. Les temps comparent les variantes entre elles ; ceux de l'iPhone sont à
mesurer avec la PWA. Commande et sorties : voir le README du spike.

### Taux de tracking lu

| Variante                                        | Web + réelles         | Synthèse (témoin) |
| ----------------------------------------------- | --------------------- | ----------------- |
| Entière 1 600 px                                | 88 / 130 (67,7 %)     | 85 / 96 (88,5 %)  |
| Entière 2 400 px                                | 90 / 130 (69,2 %)     | 85 / 96 (88,5 %)  |
| Pleine résolution                               | 90 / 130 (69,2 %)     | 85 / 96 (88,5 %)  |
| Tuiles                                          | 89 / 130 (68,5 %)     | 85 / 96 (88,5 %)  |
| **Cascade** (viseur simulé, 3024×4032 JPEG 0,8) | **92 / 130 (70,8 %)** | 87 / 96 (90,6 %)  |
| Sans les spécimens des guides PDF               | 71 / 93 (76,3 %)      | —                 |
| Sur les étiquettes où un code au moins est lu   | 92 / 106 (86,8 %)     | —                 |
| Photos réelles seules                           | 5 / 5                 | —                 |

**Critère non atteint sur le corpus : 70,8 % pour 90 % visés.** Les échecs se répartissent
ainsi (38 étiquettes) :

- **Spécimens des guides PDF** (Colissimo 7, DPD 7) : l'étiquette est une image raster de
  105 ppi incrustée dans le PDF ; même extraite à sa résolution d'origine, aucun code n'y
  est lisible. Ils ne ressemblent pas à une photo de 12 Mpx.
- **Code lu, tracking ailleurs** (14) : recommandés allemands (Internetmarke, Einschreiben)
  dont le Data Matrix est une franking signée et binaire, GLS dont le Data Matrix ne porte
  que le routage, USPS dont le Code 128 porte le code de routage. Le tracking y est
  imprimé, pas encodé : c'est l'OCR (S3) qui le trouvera. Les 5 autres (DHL Paket, DHL
  Express, Royal Mail, autres) n'ont livré qu'un code sans le tracking, non détaillé ici.
- **Aucun code** (le reste) : miniatures Commons et Flickr floues ou très réduites,
  étiquettes anciennes (Royal Mail 1990), déclarations douanières sans code.

Les photos réelles du service, les seules prises comme l'app les prendra, sont toutes lues
(5 / 5, trop peu pour conclure). Le corpus web mesure surtout la qualité des images
publiées. **Le test iPhone au service tranche le critère.**

### Par transporteur (cascade, web + réelles)

| Transporteur  | Étiquettes | Tracking lu | Code sans tracking | Aucun code |   Taux |
| ------------- | ---------: | ----------: | -----------------: | ---------: | -----: |
| DHL Paket     |         27 |          25 |                  1 |          1 | 92,6 % |
| Autres        |         18 |          12 |                  2 |          4 | 66,7 % |
| DPD           |         18 |          11 |                  0 |          7 | 61,1 % |
| USPS          |         17 |          15 |                  2 |          0 | 88,2 % |
| Deutsche Post |         11 |           4 |                  5 |          2 | 36,4 % |
| Colissimo     |         10 |           3 |                  0 |          7 | 30,0 % |
| Royal Mail    |          6 |           3 |                  1 |          2 | 50,0 % |
| Hermes        |          5 |           5 |                  0 |          0 |  100 % |
| DHL Express   |          5 |           4 |                  1 |          0 | 80,0 % |
| UPS           |          5 |           4 |                  0 |          1 | 80,0 % |
| GLS           |          3 |           1 |                  2 |          0 | 33,3 % |
| FedEx         |          2 |           2 |                  0 |          0 |  100 % |
| Chronopost    |          1 |           1 |                  0 |          0 |  100 % |
| Amazon, TNT   |          2 |           2 |                  0 |          0 |  100 % |

Colissimo : les 7 échecs sont des spécimens PDF ; la photo réelle et 2 autres spécimens
sont lus. En synthèse, Colissimo, La Poste et GLS sont à 100 %, FedEx à 91,7 %, Chronopost,
DHL Express, UPS et DPD à 83,3 % (images volontairement floues, bruitées ou froissées).

### Par format (cascade)

| Format      | Web + réelles : lu / tracking dedans | Synthèse : lu / tracking dedans |
| ----------- | -----------------------------------: | ------------------------------: |
| Code 128    |                              76 / 52 |                         67 / 66 |
| Data Matrix |                              35 / 15 |                         36 / 36 |
| ITF         |                              32 / 24 |                               — |
| Code 39     |                                9 / 4 |                               — |
| Aztec       |                                6 / 6 |                         16 / 16 |
| PDF417      |                                4 / 2 |                           9 / 9 |
| MaxiCode    |                      1 / 1 (recadré) |               10 / 10 (recadré) |

Ligne MaxiCode : variante « MaxiCode recadré » seule (la cascade, arrêtée plus tôt par un
Code 128, en lit moins). Sur les photos et les étiquettes web où il a été lu, l'Aztec
(Colissimo, Chronopost, DPD) porte toujours le tracking ; il est illisible sur les
spécimens PDF à 105 ppi.

### MaxiCode

| Variante         |      Web + réelles (6) | Synthèse UPS (12) |
| ---------------- | ---------------------: | ----------------: |
| Sans recadrage   |                      0 |                 0 |
| Recadrage maison | 1 (tracking recomposé) |                10 |

Sans recadrage, zxing ne lit aucun MaxiCode en photo. Avec le recadrage maison, 10 sur 12
en synthèse (les 2 échecs sont floue et bruitée), testé jusqu'à 45° et 90° de rotation.
Sur la photo réelle UPS, l'œil de bœuf et l'angle sont trouvés, mais la légère
perspective (photo prise de biais) n'est pas corrigée par une simple rotation : la lecture
pure échoue. Le MaxiCode web lu (étiquette de face) donne bien le tracking recomposé. Le
tracking UPS est lu de toute façon par le Code 128 de l'étiquette (4 / 5 UPS lus).

**Piste gratuite** (D11) : estimer une homographie à partir de l'hexagone et des
modules de l'œil de bœuf au lieu d'une rotation seule ; à reprendre avec le MaxiCode
maison (F30), le Code 128 suffisant pour le tracking d'ici là.

### Temps (Mac)

| Variante          | p50 (ms) | p95 (ms) | p95 web + réelles (ms) |
| ----------------- | -------: | -------: | ---------------------: |
| Entière 1 600 px  |       22 |       50 |                     57 |
| Entière 2 400 px  |       22 |       81 |                     88 |
| Pleine résolution |       22 |      114 |                    164 |
| Tuiles            |       21 |      266 |                    362 |
| MaxiCode recadré  |       55 |      265 |                    297 |
| Cascade           |       40 |      272 |                    509 |

La cascade du banc s'arrête dès que le tracking attendu est lu : ses temps sont une borne
basse ; la PWA, qui enchaîne toutes les étapes, se rapproche de la somme des variantes. Un facteur 3 à 5 est à prévoir sur l'iPhone : mesuré par la PWA.

## Contenu des codes 2D

Relevé sur les photos réelles et les étiquettes web. Valeurs masquées (`x`), séparateurs
ISO 15434 notés `<RS>` (0x1E), `<GS>` (0x1D), `<US>` (0x1F), `<EOT>` (0x04). Les contenus
bruts restent hors dépôt.

### Aztec Colissimo, Chronopost, DPD (format GeoPost, ISO 15434)

Les trois transporteurs du groupe La Poste / GeoPost partagent la même structure :

```
[)><RS>01<GS>02|03<GS><code postal><GS><pays ISO numérique><GS><service>
<GS><tracking><GS><GEOP|CHRO><GS><compte><GS><…><GS><…><GS><n°/total><GS><poids>KG
<GS>N<GS><adresse><GS><ville><GS><GS><destinataire><GS><RS>07<GS>G03<GS>0<GS>0<GS>0<GS>
<US>…<US><téléphone><US>…<US>F~<code postal><US>…<EOT>
```

| Champ       | Colissimo (réelle)                                   | Chronopost (réelle)                  | DPD (réelle)                    |
| ----------- | ---------------------------------------------------- | ------------------------------------ | ------------------------------- |
| Code postal | `0075xxx` (7 chiffres)                               | `75xxx`                              | `75xxx`                         |
| Pays        | `250` (France)                                       | `250`                                | `250`                           |
| Service     | `801`                                                | `925`                                | `328`                           |
| Tracking    | `11` + tracking **sans clé** (`118Jxxxxxxxxxx`)      | tracking en clair (`HAxxxxxxxxxxxx`) | tracking en clair (14 chiffres) |
| Réseau      | `GEOP`                                               | `CHRO`                               | `GEOP`                          |
| n°/total    | `001/001`                                            | `001/001`                            | `001/001`                       |
| Poids       | `00.50KG`                                            | `02.78KG`                            | `01.00KG`                       |
| Adresse     | rue, ville, **nom du destinataire ou de la société** | idem, nom du salarié                 | idem, nom de la société         |
| Téléphone   | —                                                    | présent (`+33xxxxxxxxx`)             | présent                         |

Conséquences : le destinataire, la ville, le code postal, le n°/total et le poids sont
lisibles **sans OCR** sur ces trois transporteurs ; le tracking Colissimo s'y lit sans sa
clé de contrôle (à recalculer, YSL-21). Un DPD allemand (web) suit la même structure avec
`276` (Allemagne).

### PDF417 FedEx (ISO 15434, format 06)

```
[)><RS>01<GS>02<code postal><GS><pays><GS><service><GS><tracking 12 à 16 chiffres>
<GS>FDE<GS><compte><GS><jour julien><GS><GS><n°/total><GS><poids>KG|LB<GS>N
<GS><adresse><GS><ville><GS><région><GS><destinataire><RS>06<GS>10Z…<GS>11Z<expéditeur>
<GS>12Z<téléphone><GS>…<GS>31Z<code de tri long>…
```

Tracking en clair, destinataire et **expéditeur** (`11Z`) présents.

### MaxiCode UPS (mode 2, ISO 15434)

```
[)><RS>01<GS>96<code postal><GS><pays><GS><service><GS>1Z<8 caractères>
<GS>UPSN<GS><n° d'expéditeur 6 caractères><GS><jour julien><GS><GS><n°/total>
<GS><poids><GS>N<GS><GS><ville><GS><RS><EOT>
```

Le tracking n'est pas en clair : `1Z` + n° d'expéditeur + service + n° de colis se
recomposent à partir de trois champs : `1Z` + n° d'expéditeur (champ après `UPSN`) +
2 derniers chiffres de la classe de service (`068` → `68`) + les 8 caractères qui suivent
`1Z` (`recomposeUps` dans `match.ts`). Pas de nom de
destinataire.

### Data Matrix

| Émetteur                                  | Contenu                                                                                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| La Poste (synthèse, lettre suivie)        | `FR00A001` + tracking + suffixe                                                                                                                                                    |
| Colissimo (synthèse)                      | tracking + code postal                                                                                                                                                             |
| GLS (web, Allemagne)                      | routage à largeur fixe : `A` + pays + dépôt + code postal + code de tri + n° de client ; **pas de tracking** ; un second Data Matrix ne porte que la ville, entre des champs vides |
| USPS (guides)                             | `420` + code postal `<GS>` + tracking IMpb (`92…`, 22 chiffres)                                                                                                                    |
| Deutsche Post Internetmarke, Einschreiben | `DEA` + franking binaire signée ; **pas de tracking lisible**                                                                                                                      |
| Deutsche Post ElectroReturn               | `DEAR01` + identifiant + code postal, chiffres en clair                                                                                                                            |
| Amazon (web)                              | identifiant Amazon `ALxxxxxxxxxx`                                                                                                                                                  |

Aucun Data Matrix GLS ni La Poste réel au service dans le corpus actuel : à relever au
test iPhone.

## PWA iPhone

https://ysl.shinseo.fr/spike-barcode/, servie par l'image de `apps/web`.

- **Scan** : « Démarrer la caméra » ouvre le flux plein format (3024×4032 selon S1) ;
  « Lire » prend une image par `grabFrame` et la décode. « Photo native » ouvre l'appareil
  photo d'iOS. Le décodage tourne dans un Web Worker, une image à la fois ; l'écran
  affiche chaque symbole (format, contenu, position), le temps de chaque étape, l'étape
  qui a lu, et le MaxiCode avec et sans recadrage.
- « Toutes les étapes » (cochée par défaut) enchaîne toute la cascade même après un premier code lu ;
  « Forcer le MaxiCode recadré » le tente même si un autre code est lu.
- Chaque essai se rattache à un **colis n°** (« Colis suivant »), avec transporteur et
  verdict : « Tracking lu », « Code lu sans tracking », « Rien lu ».
- **Journal** : essais par colis et par mode, taux par mode et par transporteur ;
  conservé dans `localStorage` (`spike-barcode:journal`), « Exporter le journal » le
  partage en JSON. Il contient les contenus lus, donc des données personnelles : il passe
  de l'iPhone au Mac par AirDrop et ne va jamais dans le dépôt.

## Protocole

1. Ouvrir https://ysl.shinseo.fr/spike-barcode/ dans Safari, l'installer sur l'écran
   d'accueil, l'ouvrir depuis l'icône.
2. Au service, sur **30 colis au moins** couvrant Colissimo, Chronopost, La Poste, DHL,
   UPS (MaxiCode), FedEx (PDF417), GLS et DPD. Pour chaque colis : choisir le
   transporteur, « Lire » dans le viseur, puis « Photo native » (« Toutes les étapes »
   reste cochée) ; donner le verdict de
   chaque essai ; « Colis suivant ».
3. Pour les colis à 2D, vérifier que le contenu affiché correspond à l'étiquette (tracking,
   code postal, nom).
4. UPS : un essai avec « Forcer le MaxiCode recadré », étiquette bien de face puis de biais.
5. Rafale : 20 « Lire » d'affilée sur des colis différents ; noter les temps affichés et
   tout plantage ou rechargement.
6. Exporter le journal par AirDrop vers le Mac.

## Résultats sur l'iPhone

À remplir après le test.

| Mesure                          | Viseur | Photo native |
| ------------------------------- | -----: | -----------: |
| Colis testés                    |        |              |
| Tracking lu                     |        |              |
| Tracking lu, transporteurs à 2D |        |              |
| MaxiCode lu (recadré)           |        |              |
| Temps p50 / p95                 |        |              |
| Plantage ou rechargement        |        |              |

## Verdict

À rendre après le test iPhone. Sur le corpus : critère non atteint (70,8 %), à cause d'images
web inexploitables plus que du lecteur ; Aztec et Code 128 fiables ; MaxiCode lisible en
synthèse grâce au recadrage maison, pas encore sur une photo de biais.

## Conséquences

- **YSL-20 (lecture en Worker)** : reprendre `src/decode/` : `.wasm` auto-hébergé, cascade
  entière réduite puis tuiles, tuiles sous 16,7 Mpx, une image à la fois. Lire **tous** les
  codes de l'étiquette, pas le premier : le tracking n'est pas toujours dans le premier lu.
- **YSL-21 (validation du tracking)** : règles de `match.ts` (clé Colissimo absente de
  l'Aztec, UPS recomposé), clé de contrôle à recalculer.
- **YSL-25 (parseurs 2D)** : un parseur ISO 15434 couvre l'Aztec GeoPost (Colissimo,
  Chronopost, DPD), le PDF417 FedEx et le MaxiCode UPS ; il donne destinataire, adresse,
  code postal, n°/total et poids sans OCR. Data Matrix : un parseur par émetteur.
- **YSL-26 et S3 (OCR)** : nécessaire pour les recommandés allemands, GLS et USPS dont le
  tracking n'est pas encodé, et pour l'expéditeur hors FedEx.
- **YSL-23 (rafale)** : temps iPhone à mesurer avant de fixer la cadence.
- **F30 (MaxiCode maison)** : homographie à ajouter au recadrage ; le Code 128 couvre le
  tracking UPS en attendant.
- **Corpus** : les spécimens des guides PDF à 105 ppi ne mesurent pas le lecteur ; ajouter
  de vraies photos du service (Colissimo, Chronopost, La Poste lettre suivie, GLS) au fil
  de l'eau, comme le prévoit YSL-5.
