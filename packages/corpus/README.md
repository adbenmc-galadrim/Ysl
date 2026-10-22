# @repo/corpus — corpus d'étiquettes

Le corpus qui sert à calibrer les seuils de confiance et à mesurer l'extraction
(cahier des charges §4.9). Chaque image a sa **vérité terrain** : les bonnes
réponses que l'app doit trouver (tracking, transporteur, destinataire,
expéditeur, n/N, poids). Le banc d'essai compare ce que l'app lit à ces
réponses.

## Trois sources

| Source      | Où sont les images           | Où est la vérité terrain            | Dans le dépôt                 |
| ----------- | ---------------------------- | ----------------------------------- | ----------------------------- |
| `synthetic` | `out/synthetic/`, régénérées | sortie du générateur                | le générateur seul            |
| `web`       | `out/web/`, téléchargées     | `data/web.json`                     | l'annotation et la provenance |
| `real`      | hors dépôt                   | `annotations.json` du dossier privé | rien                          |

- **Synthèse** : étiquettes fictives aux formats de Colissimo, Chronopost, La
  Poste (lettre suivie), DHL Express, UPS, FedEx, DPD et GLS. Vrais codes (Code
  128, Data Matrix, Aztec, PDF417, MaxiCode), trackings à clé valide (§4.6),
  identités inventées, prises de vue dégradées (inclinaison, flou, reflet,
  faible lumière, grain, froissé). La graine rend le corpus reproductible à
  l'identique.
- **Web** : étiquettes réelles publiées sous licence libre (Wikimedia Commons,
  Flickr via Openverse) et spécimens des guides techniques des transporteurs
  (Colissimo, DPD, USPS), découpés dans leurs PDF. `data/web.json` cite pour
  chacune l'URL, la page, l'auteur, la licence et le sha1 de la source ; rien
  n'est redistribué ici, les images sont téléchargées à la demande. Les noms de
  particuliers ne sont pas recopiés : leur champ vaut `null`.
- **Réelles** : photos prises au service, avec l'accord du client (décision D4).
  Elles contiennent des données personnelles : elles restent hors dépôt, le
  dépôt étant public. Leur annotation suit le même format dans
  `annotations.json`, à côté des photos.

## Commandes

```sh
pnpm --filter @repo/corpus corpus
pnpm --filter @repo/corpus generate --out ~/goinfre/ysl/tmp/corpus
pnpm --filter @repo/corpus fetch-web --out ~/goinfre/ysl/tmp/corpus
pnpm --filter @repo/corpus check --out ~/goinfre/ysl/tmp/corpus --private ~/goinfre/ysl/tmp/corpus/real
```

`corpus` écrit toujours dans `out/` du package ; `--out` choisit un autre
dossier, commande par commande. `corpus` génère la synthèse, télécharge les
étiquettes web en vérifiant leur sha1 (les spécimens PDF demandent `pdftoppm`,
de poppler : `brew install poppler` ; pour 17 fichiers Commons servis en
miniature, le sha1 est celui de la miniature, que Wikimedia peut régénérer),
puis contrôle la couverture. `check` refuse un corpus sous 100 images ou avec
moins de 6 transporteurs à 10 images, une entrée web sans licence, un fichier
absent ; il compte les annotations encore à relire (`reviewed: false`).

## Ajouter de vraies photos

1. Déposer les photos dans le dossier privé. `check` accepte le HEIC de
   l'iPhone, mais sharp ne le lit pas : pour les traiter, les convertir
   (`sips -s format jpeg IMG.heic --out IMG.jpg`).
2. Ajouter une entrée par photo dans son `annotations.json` : `source: "real"`,
   `file` relatif au dossier, `reviewed: false` tant qu'elle n'est pas relue.
3. `check --private <dossier>`.

## Format d'une entrée

Voir `src/schema.ts`. `tracking`, `recipient`, `sender`, `pieces` et `weightKg`
valent `null` quand l'information n'est pas sur l'étiquette ou n'est pas
lisible. `difficulties` liste ce qui rend la lecture difficile.
