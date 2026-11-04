# Rapport de scan {{REPORT_ID}} : corriger la lecture

Un utilisateur de la phase de test a signalé un scan raté. Ta tâche : comprendre ce qui a
été mal lu sur cette étiquette, corriger la chaîne d'extraction et le prouver sur le
corpus, sans que rien de l'étiquette n'entre dans le dépôt.

Tu travailles dans ce worktree (branche `{{BRANCH}}`, depuis `origin/main`) et dans le
dossier de travail `{{WORK_DIR}}`, hors dépôt. Rien d'autre.

## Règles absolues

1. **Le dépôt GitHub est public.** Le rapport et l'image portent des noms, des adresses
   et des numéros réels. Aucune image, aucune valeur lue sur l'étiquette ou dans le
   rapport (nom, société, adresse, code postal, téléphone, e-mail, numéro de suivi, contenu
   brut d'un code, texte OCR) ne va dans un fichier du dépôt, un message de commit, ni
   dans `titre` ou `resume` de `resultat.json` (ils deviennent le titre et la description
   de la PR). Les tests n'utilisent que des valeurs inventées (« Nom Fictif »,
   « 12 rue de l'Exemple », numéros de suivi calculés pour l'occasion). Désigne
   l'étiquette par `{{LABEL_ID}}`, jamais par ce qu'elle porte. La commande qui t'a lancé
   compare tes commits au rapport et refuse le moindre emprunt.
2. **Tu ne publies rien.** Ni `git push`, ni `gh`, ni réseau : tu commites seulement. La
   commande pousse la branche et ouvre la PR en draft après ses propres contrôles. Personne
   d'autre qu'Adam ne fusionne.
3. **Aucune régression.** Aucun champ du banc ne doit reculer, ni sur l'ensemble du corpus
   ni sur une seule étiquette. La commande refait la mesure avant et après, et n'ouvre la
   PR que si rien ne recule et que l'étiquette signalée est mieux lue.
4. **Aucune attribution** : pas de `Co-Authored-By`, de signature, de lien ni de mention
   d'un outil ou d'un modèle dans les commits, le code ou `resultat.json`.
5. Hors limites : `packages/bench/` (la notation du banc), `packages/scan-agent/`,
   `.github/`, `pnpm-lock.yaml` et les dépendances, `packages/corpus/data/`. Pas de fichier
   image ni binaire dans le dépôt.

## Ce que tu as

- `{{REPORT_DIR}}/rapport.json` : la réponse du serveur ; `report` contient les lectures
  du téléphone. Sa forme est versionnée (`report.version`) mais peut être minimale : lis ce
  qui est là. Version 1 : `codes.passes[].symbols` (sorties brutes de zxing, MaxiCode
  compris), `ocr.lines` (texte, boîte, confiance), `fields` (champs extraits, niveau,
  sources, candidats), `extraction` (fusion avant correction), `corrections` (ce que
  l'utilisateur a corrigé à la main : c'est la vérité la plus sûre), `draft`, `screen`.
- `{{REPORT_DIR}}/commentaire.txt` s'il existe : ce que l'utilisateur dit du raté.
- L'image : `{{PRIVATE_DIR}}/{{IMAGE_FILE}}` (lis-la avec l'outil Read pour la voir).
- `{{PRIVATE_DIR}}` : une copie de travail du corpus privé (`annotations.json` et les
  photos réelles). `{{CORPUS_DIR}}` : la synthèse et les étiquettes web.

## Étapes

1. **Lecture attendue.** Lis le rapport, le commentaire et l'image. Ajoute à
   `{{PRIVATE_DIR}}/annotations.json` une seule entrée, sans toucher aux autres :
   `id` `{{LABEL_ID}}`, `source` `real`, `file` `{{IMAGE_FILE}}`, `carrier`, `tracking`,
   `recipient`, `sender`, `pieces`, `weightKg`, `difficulties`, `reviewed: false` (schéma :
   `packages/corpus/src/schema.ts`). Les corrections de l'utilisateur priment ; ce que tu ne
   lis pas avec certitude sur l'image reste `null`.
2. **Mesure avant**, avant de toucher au code :
   `pnpm --filter @repo/bench measure --corpus {{CORPUS_DIR}} --private {{PRIVATE_DIR}} --out {{WORK_DIR}}/agent-avant`
   (environ 70 s). Lis la ligne de `{{LABEL_ID}}` dans `mismatches.md` et `results.json`.
   Le banc ne lit que les codes (zxing, MaxiCode, parseurs, fusion) ; pour un champ venu de
   l'OCR, rejoue `report.ocr.lines` dans les parseurs de `packages/ocr` (`recipient.ts`,
   `sender.ts`) par un script `*.local.ts` posé dans le paquet et supprimé avant le commit.
3. **Diagnostic.** Nomme la cause : code non lu, parseur qui se trompe, fusion qui garde
   la mauvaise source, OCR qui découpe mal. Si l'étiquette est en réalité bien lue, ou si
   la cause n'est pas corrigeable sans casser autre chose, arrête-toi et écris un échec.
4. **Correction** dans `packages/barcode`, `packages/contract` ou `packages/ocr`, la plus
   petite qui règle la cause et non le seul cas. Un test synthétique qui échoue avant et
   passe après, à côté des tests existants du paquet.
5. **Vérification** : `pnpm --filter <paquet> test`, `check-types`, `lint` pour chaque
   paquet touché, puis la mesure après :
   `pnpm --filter @repo/bench measure --corpus {{CORPUS_DIR}} --private {{PRIVATE_DIR}} --out {{WORK_DIR}}/agent-apres`.
   Compare `results.json` avant et après, champ par champ et étiquette par étiquette : un
   seul recul, et tu reprends ou abandonnes.
6. **Commits** : `git add <fichiers>` un par un, `git commit -m "fix: …"`, en français,
   moins de 50 caractères, une seule ligne, sans corps. Arbre propre à la fin (`git status`
   vide : supprime tes scripts `*.local.ts`).
7. **Résultat** : écris `{{RESULT_FILE}}` :

   ```json
   {
     "statut": "corrige",
     "nature": "code-barres",
     "titre": "fix: <ce que corrige le code, en termes généraux>",
     "resume": "<la cause et la correction, les tests ajoutés, les chiffres agrégés avant/après de ta mesure ; rien de l'étiquette>"
   }
   ```

   `nature` : `code-barres` (mesurable par le banc), `ocr` (vérifiée par tes tests
   synthétiques seulement) ou `autre`. En cas d'échec : `"statut": "echec"`, `titre`
   `"échec"`, `resume` court et `raison` (ce qui a été tenté, ce qui bloque). L'échec reste
   sur le PC : `raison` peut citer l'étiquette, `titre` et `resume` jamais.

Tu as un nombre de tours et un temps limités : si la cause n'est pas trouvée à mi-chemin,
écris l'échec plutôt que de forcer une correction.
