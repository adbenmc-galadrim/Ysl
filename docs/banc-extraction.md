# Banc d'extraction sur le corpus

Ticket YSL-27 (cahier des charges §4.9, objectifs O1 à O6 du §1). Le banc mesure ce que
la chaîne d'extraction propose sur chaque étiquette du corpus (`@repo/corpus`, YSL-5) et
le compare à la vérité terrain, champ par champ. Outil : [`packages/bench`](../packages/bench)
(commande et sorties dans son README). Il réutilise le lecteur de `@repo/barcode`
(YSL-20), les parseurs 2D et la validation de `@repo/contract` (YSL-21, YSL-25) et la
fusion par champ de `@repo/contract/extract`, écrite pour ce banc.

## Ce que le banc mesure

**La chaîne.** Image → `decodeSource` (cascade : entière 1 600 px, 2 400 px, tuiles,
MaxiCode recadré) → symboles → `extractFields` → six champs : tracking, transporteur,
destinataire, expéditeur, n/N, poids. Deux politiques de lecture :

- `first` : la cascade s'arrête au premier symbole lu, comme la première passe de l'app ;
- `thorough` : toutes les étapes de la cascade, sans s'arrêter. C'est la borne haute de
  ce que le lecteur peut donner ; la seconde passe de l'app (`expect`, limitée aux formats
  attendus du transporteur) se situe entre les deux et n'est pas reproduite ici.

**La fusion par champ** (`@repo/contract/extract`, §4.3 à §4.5) :

| Source                                                                                                         | Confiance |
| -------------------------------------------------------------------------------------------------------------- | --------- |
| Champ d'un code 2D structuré (Aztec GeoPost, PDF417 FedEx, MaxiCode UPS, Data Matrix La Poste, GS1)            | 0,97      |
| Tracking 1D au format reconnu, clé valide                                                                      | 0,95      |
| Transporteur déduit d'un code (SCAC, préfixe 1Z)                                                               | 0,93      |
| Tracking 1D au format reconnu, sans clé ; transporteur déduit d'une forme partagée par plusieurs transporteurs | 0,85      |
| Code 1D de forme inconnue (routage, code postal)                                                               | 0,40      |

Deux sources indépendantes concordent : `1 − (1 − c₁)(1 − c₂)`, plafonné à 0,99. Deux
sources à ≥ 0,60 se contredisent : la mieux classée garde la main avec un malus de 0,15
et le drapeau `conflict`. Transporteur : vote pondéré (2D 1,0 ; tracking à clé 0,9 ; forme
partagée par plusieurs transporteurs 0,5, un poids que le §4.5 ne prévoit pas, placé
entre le logo OCR et la mise en page), égalité = `tie`, jamais « sûr ». Un champ d'un code
structuré dont le numéro n'a aucune forme connue (rang 1 : « cohérent avec la structure
attendue ») descend à 0,85. Les seuils d'affichage du §4.4
donnent les niveaux : **sûr** ≥ 0,90, **à vérifier** de 0,60 à 0,90, vide en dessous.
L'entrée `ocr` du type `ExtractInput` est réservée aux rangs 5 à 7 (YSL-26) : aucune règle
OCR n'est encore branchée.

**La comparaison.** Tracking normalisé (espaces, tirets, casse) ; transporteur à
l'identique ; noms aux mêmes mots quel que soit l'ordre, accents et ponctuation ignorés,
ou l'un contenu dans l'autre ; n/N à l'identique ; poids à ± 0,25 kg (le MaxiCode UPS
porte des livres entières). Un **faux « sûr »** est une valeur à ≥ 0,90 différente de
l'annotation.

**Les bases.** Comme au spike S2 : le critère se compte sur les étiquettes **web et
réelles à tracking connu**, sans les 20 spécimens des guides PDF Colissimo et DPD (rasters
à 105 ppi, aucun code lisible : comptés à part). La synthèse (96) est un témoin de la
chaîne, pas de la difficulté. Les 148 annotations encore `reviewed: false` sont signalées
dans la liste des écarts : un écart peut venir de l'annotation.

## Résultats (24/10/2026, Mac, Node, images ramenées au viseur 3024×4032 JPEG 80)

Corpus : 96 synthèse, 143 web, 5 réelles. Base du critère : 110 étiquettes.

### Objectifs, base du critère

| Objectif                                 |                                                `first` |                 `thorough` | Cible                           | Atteint                                                |
| ---------------------------------------- | -----------------------------------------------------: | -------------------------: | ------------------------------- | ------------------------------------------------------ |
| O1 · faux « sûrs » sur le tracking       |                                                      4 |                          4 | 0                               | **non** (voir ci-dessous)                              |
| O2 · tracking prérempli et juste         |                                                 61,8 % |                     63,6 % | ≥ 95 %                          | non                                                    |
| O3 · destinataire juste ou dans le top 3 |                                         8,3 % (2 / 24) |                      8,3 % | ≥ 95 %                          | non : sans OCR, seuls les 2D le donnent                |
| O4 · expéditeur juste ou proposé         |                                           0 % (0 / 56) |                        0 % | ≥ 70 %                          | non : seul le PDF417 FedEx le porte                    |
| O5 · délai entre deux captures           |                                                      — |                          — | ≤ 1 s                           | non mesuré ici (banc S1, YSL-23)                       |
| O6 · temps par photo, Mac                |                                   p50 22 ms, p95 78 ms |     p50 175 ms, p95 757 ms | p50 ≤ 3 s, p95 ≤ 5 s sur iPhone | oui, avec un facteur 3 à 5 à prévoir sur l'iPhone (S2) |
| Faux « sûrs » sur les autres champs      | destinataire 8,3 % (2 / 24), expéditeur 1,8 % (1 / 56) | idem, poids 2,0 % (1 / 49) | ≤ 2 %                           | non sur le destinataire                                |

**Les quatre faux « sûrs » du tracking** portent tous sur une annotation `reviewed: false`
et aucun n'est une lecture fausse ; le premier met aussi en cause la règle de comparaison :

- `web-paketaufkleber-dhl-europack-national-deutschland-2016` : annotation à 18 chiffres,
  le Code 128 porte le SSCC à 20 chiffres (`00` devant) : même numéro sous deux formes ;
  trancher à la relecture laquelle est la bonne, et si la comparaison doit les confondre ;
- `guide-usps-priority-mail-smart-locker`, `guide-usps-bulk-parcel-return-service` : les
  guides USPS impriment un numéro d'exemple et en encodent un autre ; l'annotation a copié
  l'imprimé ;
- `web-usps-first-class-pkg-intl-…-lettre` : enveloppe à deux numéros S10 valides (un
  recommandé allemand, un USPS) ; le banc lit celui que l'annotation n'a pas retenu.

Un cinquième faux « sûr » (`web-parcel-label-fedex-dji-…`, PDF417 à 16 chiffres) a été
corrigé pendant la mesure : le parseur ISO 15434 isole désormais les 12 chiffres de tête.

### Par champ, base du critère, politique `thorough` (110 étiquettes)

| Champ        | Annotées | Sûr et juste | Sûr et faux | À vérifier, juste | À vérifier, faux | Vide | Exactitude | Préremplissage |
| ------------ | -------: | -----------: | ----------: | ----------------: | ---------------: | ---: | ---------: | -------------: |
| Tracking     |      110 |           44 |           4 |                26 |                7 |   29 |     63,6 % |         73,6 % |
| Transporteur |      110 |           29 |           0 |                 8 |               20 |   53 |     33,6 % |         51,8 % |
| Destinataire |       24 |            2 |           2 |                 0 |                0 |   20 |      8,3 % |         16,7 % |
| Expéditeur   |       56 |            0 |           1 |                 0 |                0 |   55 |        0 % |          1,8 % |
| Colis n/N    |       34 |            7 |           0 |                 0 |                0 |   27 |     20,6 % |         20,6 % |
| Poids        |       49 |            6 |           1 |                 0 |                0 |   42 |     12,2 % |         14,3 % |

Les 29 trackings vides : 10 étiquettes sans aucun code lu (miniatures Commons floues,
étiquettes anciennes, déclarations douanières) et 19 où le code lu ne porte pas le tracking
(recommandés Deutsche Post à franking binaire, DHL Paket, GLS, Royal Mail : le tracking est
imprimé, pas encodé ; c'est l'OCR qui le trouvera). Les 7 « à vérifier, faux » sont presque
tous des ITF de 14 chiffres (Leitcode DHL, code de routage) pris pour un numéro au format
reconnu sans clé : une règle « ITF-14 = routage » dans `@repo/contract/tracking` les
retirerait.

### Autres bases, politique `thorough`

| Base                             | Étiquettes | Tracking juste | Faux sûrs | Transporteur juste |    p50 / p95 |
| -------------------------------- | ---------: | -------------: | --------: | -----------------: | -----------: |
| Web + réelles, spécimens compris |        130 |    74 (56,9 %) |         4 |        41 (31,5 %) | 134 / 747 ms |
| Photos réelles du service        |          5 |      5 (100 %) |         0 |          5 (100 %) | 757 / 896 ms |
| Spécimens PDF 105 ppi            |         20 |       4 (20 %) |         0 |           4 (20 %) |  52 / 139 ms |
| Synthèse (témoin)                |         96 |    75 (78,1 %) |         0 |          73 (76 %) |  99 / 192 ms |

Synthèse : 21 étiquettes sans tracking sont les prises de vue volontairement floues,
bruitées ou froissées (le spike S2 en lisait 85 à 87 sur 96 avec un oracle qui s'arrêtait
au bon code). Les 18 « à vérifier » sont DHL Express et GLS : numéro à clé sans contexte,
ou sans clé publique, comme prévu au §4.6. Photos réelles : sur la Chronopost réelle,
l'Aztec porte une forme à 14 caractères que la validation ne connaît pas, proposée « à
vérifier » quand l'étiquette imprime le S10 : la forme Aztec de Chronopost reste à
documenter (YSL-21, YSL-25).

### `first` contre `thorough`

Sur la synthèse, `first` lit autant de trackings que `thorough` mais moins de n/N et de
poids (34 contre 41) : la cascade s'arrête sur un Code 128 avant d'atteindre le MaxiCode
ou le PDF417. Sur la base du critère l'écart est de 2 trackings et 2 n/N. Le temps passe de
22 à 175 ms en médiane (78 à 757 ms au p95) : la seconde passe de l'app, limitée aux
formats attendus du transporteur, est le bon compromis ; le banc ne la reproduit pas
encore (ses formats attendus vivent dans `apps/web`).

## Verdict

- **O1 non atteint (4)** : aucun des quatre écarts n'est une lecture fausse ; trois tiennent à
  l'annotation, le quatrième (SSCC à 20 ou 18 chiffres) à l'annotation ou à la règle de
  comparaison. Relire les 148 annotations
  `reviewed: false` avant la prochaine mesure (TODO YSL-5).
- **O2 à 63,6 %** : le corpus web mesure surtout des images publiées à basse résolution
  et des transporteurs dont le tracking n'est pas encodé ; les photos réelles sont à
  5 / 5, deux « à vérifier » (DHL Express sans contexte, Chronopost par l'Aztec). Le chiffre à suivre est celui des vraies photos du service, à prendre au fil de
  l'eau (D4).
- **O3, O4** : hors d'atteinte sans OCR ; l'entrée `ocr` d'`extractFields` attend YSL-26.
- **O6** : largement tenu sur Mac, iPhone à mesurer avec l'app.
- **Faux « sûrs » hors tracking** : destinataire 2 / 24 (une annotation société contre un
  nom de personne lu dans le code, et une étiquette où le 2D porte le nom de la société
  destinataire : le choix personne / société revient à la revue de lot) ; `11Z` du
  PDF417 FedEx lu comme expéditeur contredit par l'étiquette DJI, où c'est la société
  destinataire (TODO YSL-25).

## Relancer

```sh
pnpm --filter @repo/corpus generate --out ~/goinfre/ysl/tmp/corpus
pnpm --filter @repo/bench measure --corpus ~/goinfre/ysl/tmp/corpus --private ~/goinfre/ysl/tmp/corpus/real
```

À relancer à chaque changement de règle, de parseur ou de lecteur ; recopier ici le tableau
des objectifs daté. En CI, `pnpm test` rejoue en texte les contenus des codes des gabarits de synthèse,
recopiés de `templates.ts` (O1 à zéro, O2 ≥ 95 % sur 96 étiquettes), et un aller-retour
bwip-js → zxing → extraction sur le code 2D des cinq transporteurs de synthèse qui en
portent un : aucune image du corpus n'y passe.
