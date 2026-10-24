# @repo/bench — banc d'extraction sur le corpus

Mesure ce que la chaîne d'extraction propose sur chaque étiquette du corpus
(`@repo/corpus`) et le compare à la vérité terrain, champ par champ : tracking,
transporteur, destinataire, expéditeur, n/N, poids (cahier des charges §4.9,
objectifs O1 à O6). Il ne duplique rien : la lecture vient de `@repo/barcode`
(`decodeSource`), les parseurs et la validation de `@repo/contract`, la fusion
par champ et le vote transporteur de `@repo/contract/extract`.

## Lancer

```sh
pnpm --filter @repo/bench measure \
  --corpus ~/goinfre/ysl/tmp/corpus \
  --private ~/goinfre/ysl/tmp/corpus/real \
  [--out <dossier>] [--limit 24] [--policy first,thorough] [--raw]
```

- `--corpus` : le dossier de sortie du générateur (`synthetic/labels.json`,
  `web/labels.json`). Régénérer la synthèse avant une mesure
  (`pnpm --filter @repo/corpus generate --out …`).
- `--private` : le dossier des vraies photos (`annotations.json`, HEIC convertis
  par `sips` dans `<out>/cache/`).
- `--policy` : `first` arrête la cascade au premier symbole lu (première passe de
  l'app) ; `thorough` enchaîne toutes les étapes (borne haute).
- `--raw` : images à leur résolution d'origine ; par défaut elles sont ramenées
  au viseur de l'iPhone (3024×4032, JPEG 80), comme au spike S2.

Sorties dans `out/` du package (ignoré par git) ou dans `--out` : `results.md` (objectifs, tableaux par champ, transporteur,
format et temps, par politique et par base), `mismatches.md` (chaque écart avec
l'annotation, les annotations `reviewed: false` signalées), `results.json`,
`contents-2d.json` (contenus bruts des codes 2D : données personnelles, ne
jamais verser au dépôt).

## Bases de mesure

| Base              | Contenu                                                                   |
| ----------------- | ------------------------------------------------------------------------- |
| Base du critère   | web + réelles à tracking connu, **sans** les spécimens des guides PDF     |
| Web + réelles     | la même, spécimens compris                                                |
| Photos réelles    | les photos du service                                                     |
| Spécimens PDF     | guides Colissimo et DPD : rasters à 105 ppi, aucun code lisible (S2)      |
| Synthèse (témoin) | étiquettes générées, codes propres : vérifie la chaîne, pas la difficulté |

## Ce qui compte comme juste

- Tracking : égalité après `normalizeTracking` (espaces, tirets, casse).
- Transporteur : égalité avec l'annotation.
- Destinataire, expéditeur : mêmes mots, quel que soit l'ordre, accents et
  ponctuation ignorés ; ou l'un contenu dans l'autre (« MME MARIE CURIE »).
  « Top 3 » : l'annotation figure parmi les trois premiers candidats.
- n/N : égalité ; poids : écart ≤ 0,25 kg (le MaxiCode UPS porte des livres
  entières).

Les statuts suivent les seuils d'affichage du §4.4 : « sûr » à ≥ 0,90, « à
vérifier » de 0,60 à 0,90, vide en dessous. Un faux « sûr » est une valeur à
≥ 0,90 différente de l'annotation (O1 : zéro sur le tracking).

## En CI

`pnpm test` ne lit aucune image du corpus : `tests/fixtures.test.ts` rejoue en texte les contenus des codes des gabarits de synthèse (recopiés de `templates.ts` ; O1 et O2 sur 96 étiquettes), `tests/roundtrip.test.ts` rend avec bwip-js le code 2D des cinq transporteurs de synthèse qui en portent un, le lit avec `@repo/barcode` et l'extrait. Le banc image reste une commande locale.
