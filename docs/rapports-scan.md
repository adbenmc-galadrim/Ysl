# Rapports de scan (phase de test)

Pendant la phase de test, l'utilisateur peut signaler un scan raté. Le rapport part de
l'iPhone avec l'image complète et toutes les lectures, attend sur le serveur, puis le PC
d'Adam le récupère (`pnpm reports:pull`) et le supprime. Un agent s'en sert ensuite pour
améliorer la lecture.

C'est une exception à D8 (les photos d'étiquettes ne quittent pas l'iPhone), décidée par
Adam le 04/11/2026 (D32) **pour la phase de test seulement** : rien n'est masqué, l'envoi
ne part que sur action de l'utilisateur. Tout ceci se retire avant les vrais utilisateurs
(YSL-148, voir « Retrait »). Hors de cette exception, D8 reste entière.

## Mise en service

Une seule variable sur l'API (`ysl-api` dans Coolify) : `SCAN_REPORTS_KEY`, 32 caractères
au moins, tirée au hasard (`openssl rand -base64 48`). Sans elle, toutes les routes
répondent 404 et l'iPhone ne peut rien envoyer : c'est aussi l'interrupteur.

La même valeur sert au PC (`SCAN_REPORTS_KEY` dans le terminal, ou le fichier
`~/.config/ysl/scan-reports-key`, jamais dans le dépôt). Le
dépôt est public : aucun rapport, aucune image, aucune clé n'y entre, ni dans les tests
(fixtures fabriquées seulement).

## Stockage

Table `scan_report` (migration `0038_rapports_scan`), à part des tables métier : aucune
clé étrangère, ni entrante ni sortante. Elle garde l'identifiant du compte et de
l'entreprise qui ont envoyé, le rapport (JSON), le commentaire, l'image (`bytea`, sans
compression) et son empreinte SHA-256.

- Image : JPEG ou PNG, reconnu à ses octets ; 8 Mio au plus.
- Rapport : un objet JSON, 512 Kio au plus. Commentaire : 2 000 caractères au plus.
- Plafond du serveur : 1 Gio d'images en attente ; au-delà, l'envoi est refusé (507).
- Conservation : supprimé à l'acquittement du PC, sinon par la purge planifiée au bout de
  14 jours (`runPurge`, le passage sur toutes les entreprises, comme le journal de
  l'admin de l'app). La suppression d'une entreprise emporte ses rapports ; ceux d'un
  compte rattaché à aucune entreprise (`organization_id` vide) ne partent qu'à
  l'acquittement ou à la purge.

Aucune vue de l'app n'affiche ces rapports, ni chez l'admin d'entreprise ni chez l'admin
de l'app (D26) ; un test vérifie qu'aucun routeur tRPC ne lit la table.

## Routes

Toutes sous `https://ysl-api.shinseo.fr/api/scan-reports` ; les rapports, les images et
les réponses de l'envoi partent en `Cache-Control: no-store`.

### Envoi, depuis l'iPhone

`POST /api/scan-reports`, avec la session de l'utilisateur (cookie, comme tRPC), en
`multipart/form-data` :

| Champ | Contenu |
| --- | --- |
| `id` | UUID choisi par le téléphone : un renvoi après une réponse perdue est le même rapport |
| `report` | les lectures, un objet JSON en texte ; leur forme est fixée par le bouton de l'iPhone (voir « Contenu du rapport »), le serveur ne vérifie que l'objet et sa taille |
| `comment` | facultatif |
| `image` | le fichier de l'image |

| Réponse | Sens | Ce que fait l'outbox |
| --- | --- | --- |
| 201 `{ id }` | gardé | retire le rapport |
| 200 `{ id }` | déjà reçu (renvoi) | retire le rapport |
| 400 `invalid` | champ manquant ou mal formé | abandonne |
| 401 `unauthorized` | pas de session | attend une reconnexion |
| 403 `suspended` | compte ou entreprise suspendus | abandonne |
| 404 | fonction éteinte (pas de clé) | abandonne, et le dit à l'utilisateur : le rapport n'est pas parti |
| 413 `too_large`, 415 `type` | image trop lourde, pas une image | abandonne |
| 429 `rate_limited` | 20 envois par compte et par 10 minutes ; `Retry-After` | réessaie plus tard |
| 503 `busy` | deux envois déjà en lecture sur le serveur ; `Retry-After` | réessaie plus tard |
| 507 `full` | plafond du serveur atteint | réessaie plus tard |

### Contenu du rapport

Fixé par `scanReportV1` (`@repo/contract/scan-report`), version `SCAN_REPORT_VERSION` = 1 :
toute forme nouvelle monte la version. Le serveur ne le vérifie pas, le PC l'écrit tel quel
dans `rapport.json` ; c'est ce que l'agent lit pour rejouer l'image dans le banc
(`packages/bench`, voir « Rejouer » plus bas).

| Clé | Contenu |
| --- | --- |
| `version` | 1 |
| `shotAt`, `createdAt` | prise de la photo, appui sur « Envoyer le rapport » (ISO) |
| `app` | `version` : `displayVersion` (AAAA.MM.JJ, celle des Réglages) ; `build` : l'horodatage du build (`__APP_VERSION__`) |
| `device` | `kind` (`iphone`…), `userAgent`, `platform`, `language`, `screen` (`width`, `height`, `pixelRatio`), `standalone` (app installée) |
| `shot` | `source` : `camera` (viseur) ou `import` (photothèque, appareil photo natif) ; `zoom` du viseur ; `torch` allumée ; `quality` : la mesure de netteté avant lecture (`ok`, `blurry`, `glare`), qui choisit le conseil sous « illisible » |
| `reception` | l'adresse de l'entreprise que la fusion a prise en compte (étiquettes « ailleurs »), ou `null` |
| `image` | l'image envoyée : `type`, `width`, `height`, `bytes`, `quality` JPEG |
| `codes` | `state` (`done`, `failed` si le Worker a échoué) et `passes` : chaque passe de la cascade zxing, la première puis celle qui cherche les formats manquants (`expect`, ex. `["MaxiCode"]`), avec ses `symbols` (`format`, `text` brut séparateurs compris, `isValid`, `position` en pixels du cadre de la passe (`width` × `height` de la passe), `orientation`), ses `steps` (`whole-1600`, `whole-2400`, `tiles`, `maxicode` : durée, nombre de symboles, taille lue) et sa durée |
| `ocr` | `state` : `done`, `skipped` (modèles pas encore sur l'iPhone), `failed`, `pending` (pas fini 15 s après l'envoi), `none` (pas de lecture du texte pour cette prise : pièce rattachée à son colis, doublon hors du lot) ; si `done` : `engine` (`paddle`, `tesseract`), `lines` (`text`, `box` dans l'image du moteur `width` × `height`, `score`), `sourceWidth` × `sourceHeight` (l'image reçue par le moteur), `timings`, et `input` : l'OCR lit la photo stockée, soit l'image envoyée réduite à `maxSide` (1 600 px) et réenregistrée en JPEG `quality` 0,8 |
| `fields` | chaque champ tel que le colis le garderait, corrections comprises : `value`, `confidence`, `level`, `flags`, `sources`, `candidates` |
| `extraction` | la fusion des lectures avant toute correction (`extractFields`) : mêmes champs, plus `codes` (codes analysés), `accounts`, `recipientCard`, `senderId` |
| `corrections` | ce que l'utilisateur a posé à la main avant l'envoi : `field` (`tracking`, `recipient`, `sender`, `type`, `department`), `value`, `how` (`typed`, `chosen`, `confirmed`) |
| `draft` | le brouillon du colis tel quel au moment de l'envoi ; `{ id, reading: "gone" }` s'il a été annulé entre-temps |
| `screen` | ce que l'écran de scan affichait : `kind` (`read`, `unreadable`, `duplicate`, `piece`) et, pour `read` seulement, ses lignes (`label`, `value`, `status`) ; vide pour les autres états |

**L'image** est le cadre complet que les lecteurs de codes ont lu (après le zoom du viseur,
jusqu'à 12 Mpx), encodé en JPEG 0,92, ou moins (0,85, 0,75, 0,6) s'il dépasse 8 Mio ; encore
trop lourd, il est réduit, et `image.width` diffère alors de celui des passes (les positions
restent dans la taille des passes). Pour
rejouer l'OCR au plus près, la réduire à 1 600 px de grand côté et l'encoder en JPEG 0,8.
La photo stockée de l'étiquette n'est pas touchée : le cadre est une copie gardée en mémoire
pour la dernière prise seulement (la précédente est libérée), et n'est encodé qu'à l'envoi.

**Rejouer.** Ouvrir l'image sans la repasser au format du viseur
(`openImage(chemin, { viewfinder: false })`, ou `--raw` du banc), lire une première passe
avec `decodeSource`, puis, pour chaque passe dont `expect` n'est pas nul, une seconde passe
`decodeSource(source, { enough: enoughFormats(expect) })` : c'est là que l'app lit la
MaxiCode d'UPS. Le rejeu reste une approximation : l'image a été recompressée (JPEG 0,92),
et le banc réduit en lanczos3 là où le Worker de l'app réduit par un canvas.

**Ce que le rapport ne dit pas.** La bonne réponse n'y est que pour ce que l'utilisateur a
corrigé (`corrections`) et ce qu'il écrit dans le commentaire : le reste de `fields` est la
lecture, non vérifiée. `app.build` est l'horodatage du build, pas un commit : retrouver le
code lu par `app.version` (date) et l'historique de `prod`. L'annuaire n'y est pas
(`extraction` est recalculée sans lui).

### Côté iPhone

Le bouton « Signaler ce scan » apparaît au-dessus des commandes du viseur, sur le résultat du
dernier scan (lu, illisible, doublon, pièce). Il ouvre une feuille avec un commentaire
facultatif (2 000 caractères) ; « Envoyer le rapport » la ferme aussitôt, le rapport
s'enregistre et l'écran le dit, sans bloquer le scan suivant. Rien ne part sans ce geste.

Le rapport attend dans la table Dexie `scan_report_outbox` (version 13), son image en OPFS à
côté des photos (`photos/report-<id>.jpg`, épargnée par le balayage des photos orphelines),
ou dans la ligne quand l'OPFS manque. Il part à l'appui, à l'ouverture de l'app, au retour du
réseau et toutes les minutes, un à la fois, du plus ancien au plus récent, selon le
tableau de l'envoi ; sans `Retry-After`, l'attente double à partir de 5 s jusqu'à 30 min.
Une déconnexion efface les rapports en attente avec le reste des données locales.

Au retrait (YSL-148), côté iPhone :

- le dossier `apps/web/src/features/scan-report/` (rapport, dernier cadre, file, envoi, hook
  de l'écran) et ses tests `apps/web/tests/scan-report-*.test.ts` ;
- `apps/web/src/app/routes/_authenticated/scan.tsx` : `useScanReport`, ses appels
  (`report.keep`, `report.codes`, `report.text`, `report.slot`, `report.sheet`) et la
  condition `!report.open` sur les commandes ;
- `apps/web/src/features/scan/reader.ts` (`passes`, `DecodePass`) et
  `apps/web/src/features/scan/text.ts` (`ocr`), avec leurs assertions dans
  `scan-reader.test.ts` et `scan-text.test.ts` ;
- `apps/web/src/features/camera/capture.ts` : `PHOTO_MAX_SIDE` et `PHOTO_QUALITY`
  redeviennent privés ;
- `apps/web/src/features/db/schema.ts` : l'import `LocalScanReport`, la table `scanReport`,
  `SCAN_REPORT_STORES`, et une nouvelle version Dexie qui la supprime
  (`scan_report_outbox: null`), avec `db.verno` et la liste des tables dans
  `local-schema.test.ts` ; les fichiers `report-*` restants partent alors au balayage ;
- `apps/web/src/features/photos/store.ts` : `reportImagePaths` dans `sweepOrphanPhotos` ;
- `apps/web/src/app/routes/_authenticated.tsx` (`startReportSender`) et
  `apps/web/src/features/auth/wipe.ts` (`stopReportSender`) ;
- les libellés `scan.report.*` de `packages/shared/src/i18n/locales/fr.ts` ;
- `packages/ui/src/screens/reception/signaler-scan.tsx`, ses stories, son export dans
  `packages/ui/src/screens/index.ts`, et la prop `report` de `ScanScreen` ;
- dans le contrat, `scanReportV1` et ce qui l'accompagne, avec
  `packages/contract/tests/scan-report.test.ts`.

### Récupération, depuis le PC

Avec `Authorization: Bearer <SCAN_REPORTS_KEY>` (comparée à temps constant). Aucun compte
d'entreprise n'y accède ; sans la clé, ou avec une autre, 401.

| Route | Réponse |
| --- | --- |
| `GET /api/scan-reports` | les rapports en attente, du plus ancien au plus récent (100 au plus) : `id`, `createdAt`, `imageType`, `imageBytes` |
| `GET /api/scan-reports/:id` | le rapport sans l'image : `report`, `comment`, `userId`, `organizationId`, `imageSha256`… |
| `GET /api/scan-reports/:id/image` | l'image, en pièce jointe |
| `POST /api/scan-reports/:id/ack` | 204, le rapport et l'image sont supprimés ; 404 s'il n'existe plus |

Le PC n'acquitte qu'après avoir écrit le rapport et vérifié l'empreinte de l'image. La
liste s'arrête à 100 rapports : après ses acquittements, le PC la redemande jusqu'à ce
qu'elle revienne vide.

Les codes d'erreur (`SCAN_REPORT_ERRORS`), les limites et les types des réponses sont dans
`@repo/contract/scan-report`. `Retry-After` est exposé par le CORS : l'outbox peut le lire.

```bash
curl -s -H "Authorization: Bearer $SCAN_REPORTS_KEY" https://ysl-api.shinseo.fr/api/scan-reports
```

## Sur le PC : `pnpm reports:pull`

Depuis la racine du dépôt :

```bash
pnpm reports:pull            # une passe : récupère tout ce qui attend, puis rend la main
pnpm reports:pull --watch    # recommence toutes les 60 s, jusqu'à Ctrl-C
```

La clé vient de `SCAN_REPORTS_KEY` si elle est posée dans le terminal, sinon du fichier
`~/.config/ysl/scan-reports-key` (`--key-file` pour un autre). Elle n'est jamais affichée.
Le serveur par défaut est la prod ; `--server http://localhost:3101` pour une API locale.
La clé ne part qu'en HTTPS, ou vers la machine elle-même.

Chaque rapport arrive dans `tmp/rapports-scan/<id>/` (dossier ignoré par git ; `--dir`
pour un autre) :

| Fichier | Contenu |
| --- | --- |
| `rapport.json` | la réponse de `GET /api/scan-reports/:id` telle que reçue : `report` (les lectures), `comment`, `userId`, `organizationId`, `imageSha256`… |
| `image.jpg` ou `image.png` | l'image, selon `imageType` |
| `commentaire.txt` | le commentaire, s'il y en a un |

Un rapport à la fois. Il s'écrit dans un dossier temporaire (`.<id>.partiel-<pid>`), l'image
est relue et son empreinte comparée à `imageSha256`, puis le dossier est renommé en `<id>` :
`<id>/` est complet ou absent. L'acquittement ne part qu'ensuite. Une écriture qui échoue,
une empreinte fausse : le rapport reste sur le serveur, la commande finit en code 1. Un
rapport déjà présent et intact (coupure avant l'acquittement) n'est pas réécrit : il est
seulement acquitté.

`--watch` laisse au moins 10 s entre deux passes (`--interval <secondes>`) ; une passe
redemande la liste sans attendre tant qu'elle revient pleine (100 rapports).
Après un échec (réseau, 5xx, 429, 503 `busy`, 404 si la clé n'est plus posée), l'attente double
jusqu'à 15 min, et dure au moins le `Retry-After` du serveur. Une clé refusée (401) arrête
la commande. Ctrl-C arrête proprement : le rapport en cours n'est pas acquitté et repart à
la passe suivante.

### Accroche pour la suite

`--on-report "<commande>"` lance la commande (`sh -c`) après chaque rapport acquitté, avec
`SCAN_REPORT_ID` et `SCAN_REPORT_DIR` dans son environnement (jamais la clé). Une seule fois
par rapport, sauf coupure entre l'acquittement et la commande ; un rapport présent mais pas
encore acquitté la déclenche à son acquittement.
Son échec est journalisé et n'arrête rien. C'est là que se branche l'agent qui lit les
rapports.

```bash
pnpm reports:pull --watch --on-report 'echo "nouveau rapport : $SCAN_REPORT_DIR"'
```

## Agent sur chaque rapport : `pnpm reports:agent`

L'accroche de `--on-report` (paquet `packages/scan-agent`). Pour chaque rapport, un agent
cherche ce qui a été mal lu, corrige la chaîne d'extraction et ouvre une PR **en draft**
qu'Adam relit et fusionne. Depuis la racine du dépôt :

```bash
pnpm reports:pull --watch --on-report 'pnpm -w reports:agent'
```

`-w` est nécessaire : `reports:pull` lance l'accroche depuis `apps/server`. Options :
`--no-pr` (tout sauf le push, la PR et le versement au corpus privé : démo, essai ; le
worktree et sa branche restent sur le PC),
`--max-turns <n>` (150 par défaut), `--timeout-min <n>` (60 par défaut), `--corpus` (sortie
du générateur, défaut `~/goinfre/ysl/tmp/corpus`), `--private` (corpus privé, défaut
`<corpus>/real`). Le corpus de synthèse doit être généré avant
(`pnpm --filter @repo/corpus generate --out ~/goinfre/ysl/tmp/corpus`).

### Ce que fait la commande

0. **Un rapport qu'elle sait lire.** `report` doit être un `scanReportV1` (« Contenu du
   rapport ») : une autre version, ou un rapport v1 qui ne suit pas le contrat, est ignoré
   sans agent, avec sa raison dans le journal (la commande finit en code 0).
1. **Un agent à la fois.** Verrou `tmp/rapports-scan/.agent/verrou` : un rapport arrivé
   pendant qu'un agent travaille attend son tour (`reports:pull` attend déjà l'accroche
   avant le rapport suivant ; le verrou couvre deux commandes lancées en parallèle). Le
   verrou d'un processus mort est repris.
2. **Une PR ouverte par étiquette.** Deux rapports sur la même étiquette (même tracking,
   celui corrigé par l'utilisateur d'abord, ou même empreinte SHA-256 de l'image) vont dans
   le même groupe de `tmp/rapports-scan/.agent/etiquettes.json` (le tracking y est haché).
   Si une branche du groupe a une PR ouverte (`gh pr list --head`), aucun agent ne part :
   le rapport est rattaché. La branche porte un identifiant neutre,
   `fix/scan-etiquette-<8 premiers caractères de l'id du premier rapport>`, suffixée
   (`-2`…) quand une tentative précédente l'a déjà prise.
3. **Un worktree dédié** `../ysl-scan-etiquette-<id>` depuis `origin/main`,
   `pnpm install --frozen-lockfile --prefer-offline`.
4. **Un dossier de travail hors dépôt**, `tmp/rapports-scan/<id>/agent/` : une copie du
   corpus privé (`annotations.json` et des liens vers les photos) où l'image du rapport
   entre sous le nom `rapport-<id>.jpg` (ou `.png`).
5. **L'agent** : `claude -p --model claude-opus-5-5` (le modèle annoncé par la session est
   vérifié, un autre l'arrête), `--permission-mode dontAsk`, outils `Read`, `Edit`, `Write`,
   `Glob`, `Grep` et `Bash` limité à `pnpm`, `ls` et à `git` en lecture, `add`, `commit`,
   `restore` ; ni `git push`, ni `gh`, ni web ; aucun serveur MCP ni réglage du PC ;
   dossiers : le worktree et le dossier de travail ; tours et durée bornés. `pnpm` lance
   n'importe quel code : ses commandes passent par le bac à sable de Claude Code (aucun
   réseau, écriture seulement dans le worktree, le dossier de travail et le dossier git
   pour commiter, sockets Unix seulement dans le dossier temporaire du bac à sable). Ni
   lecture ni écriture de `~/.ssh`, `~/.config`, `~/.gnupg`, `~/.aws`, `~/.claude`,
   `~/.netrc`, `~/.gitconfig`, par aucun outil : git y lit sans config globale
   (`GIT_CONFIG_GLOBAL=/dev/null`) et les commits portent le nom et l'e-mail git d'Adam,
   lus par la commande. Son environnement ne porte aucune clé
   (`SCAN_REPORTS_KEY`, jetons GitHub, Coolify…, agent ssh), seulement la sienne ; l'URL de
   push d'`origin` y est inutilisable et `gh` sans compte. Son prompt est versionné :
   `packages/scan-agent/prompt.md` ; il renvoie l'agent à « Contenu du rapport », « Rejouer »
   et « Ce que le rapport ne dit pas ». Il écrit la lecture attendue de l'étiquette dans la
   copie du corpus, mesure le banc avant et après, corrige `packages/barcode`,
   `packages/contract` ou `packages/ocr` avec un test synthétique, commite, et rend
   `resultat.json` (statut, nature de la correction, titre et résumé de la PR).
6. **Les contrôles, faits par la commande et non par l'agent**, avant tout push :
   - hooks git, configuration (`config`, `config.worktree`) et fichier `.git` du worktree
     identiques à ce qu'ils étaient avant l'agent ; le push part avec
     `core.hooksPath=/dev/null` et `--no-verify` ;
   - arbre propre, au moins un commit, la seule étiquette ajoutée au corpus de travail
     valide (schéma du corpus) et les autres intactes ;
   - aucun fichier image ni binaire, rien sous `tmp/`, ni `annotations.json`, ni lockfile,
     ni `package.json`, ni `packages/corpus/data/`, ni `packages/bench/` (la notation), ni
     `packages/scan-agent/`, ni `.github/` ;
   - **aucune fuite** : les noms, numéros et valeurs lus ou corrigés du rapport et de la
     lecture attendue, mot à mot, en entier ou sans espaces, et les lignes OCR qui portent
     des chiffres (adresse, téléphone, e-mail), cherchés dans les lignes ajoutées, les
     chemins, les messages de commit, la branche, le titre et la description de la PR ; un
     texte déjà présent sur `main` en mot entier n'est pas une fuite ;
   - aucune attribution (`Co-Authored-By`, signature, mention d'un outil) ; aucun jeton
     GitHub ou Anthropic, clé privée ni en-tête `Bearer` ;
   - gates `turbo run lint check-types test` des paquets touchés et de leurs dépendants ;
     comme le banc, ils exécutent le code de l'agent : ils tournent sous `sandbox-exec`
     (`packages/scan-agent/src/sandbox.ts` : aucun réseau ni DNS, sockets Unix seulement
     dans un dossier temporaire à eux, aucune app lancée hors du bac à sable (LaunchServices,
     Apple Events, `open`, `osascript`, `shortcuts`, `automator`), ni `ssh` ni `scp`, aucune
     lecture des clés du PC, écriture seulement dans le worktree, le dossier de travail et ce
     dossier) ;
   - le banc sur `main` puis sur la branche, sur le même corpus : aucun champ ne perd une
     lecture juste ni ne gagne un faux « sûr », sur l'ensemble comme sur chaque étiquette,
     et au moins un champ de l'étiquette signalée est mieux lu (une correction OCR, que le
     banc image ne mesure pas, passe sur ses tests synthétiques).
7. **Succès** : push de la branche seule, `gh pr create --draft` (titre de l'agent,
   description de la commande : résumé, tableau agrégé avant/après par champ et par
   politique, nombre d'étiquettes) ; l'image et sa lecture attendue sont versées au corpus
   privé `~/goinfre/ysl/tmp/corpus/real` ; le worktree et la branche locale sont supprimés.
   Si ce rangement échoue, la PR reste ouverte et le journal dit ce qui est à finir à la
   main. Personne ne fusionne à part Adam ; rien ne part jamais sur `main` ni `prod`.
8. **Échec** (rien à corriger, régression, fuite, gates rouges, délai) : ni push ni PR ;
   `echec.md` dans le dossier de travail donne la raison et le détail ; le worktree reste
   pour qu'on le reprenne. Le corpus privé n'est pas touché. Seule exception : `gh pr create`
   qui échoue après le push ; `echec.md` le dit (« Publié : branche … poussée, sans PR »).

Journal : une ligne par rapport dans `tmp/rapports-scan/.agent/journal.log`, le détail dans
`tmp/rapports-scan/<id>/agent/` (`journal.log`, `claude.jsonl` le flux complet de l'agent,
`install.log`, `gates.log`, `banc-avant/`, `banc-apres/`, `comparaison.md`, `pr.md`). Ces
fichiers portent des données réelles : ils ne quittent pas le PC.

## Retrait

Avant les premiers vrais utilisateurs (YSL-148) :

1. Retirer `SCAN_REPORTS_KEY` de l'API et redéployer : plus rien n'entre ni ne sort.
2. Retirer le bouton de l'iPhone, les routes (`apps/server/src/scan-reports-route.ts`,
   leur montage dans `apps/server/src/index.ts`), le service
   (`packages/api/src/features/scan-reports/`, ses exports dans
   `packages/api/src/index.ts`), la commande du PC (`apps/server/src/ops/scan-reports-pull.ts`,
   `apps/server/src/scripts/reports-pull.ts`, son test et `reports:pull` dans les deux
   `package.json`), son appel dans `runPurge`, le contrat
   (`packages/contract/src/scan-report.ts` et son export dans `package.json`), la table
   du schéma, `SCAN_REPORTS_KEY` (`packages/shared/src/env/server.ts`, `turbo.json`,
   `.env.example`), la ligne du README et cette page.
3. Migration de retrait : `DROP TABLE "scan_report";`. Aucune autre table n'en dépend.
4. Sur le PC : supprimer `tmp/rapports-scan/` (images complètes de la phase de test) et
   `~/.config/ysl/scan-reports-key`.
5. L'agent : le paquet `packages/scan-agent` et `reports:agent` dans le `package.json` de la
   racine ; sur le PC, les worktrees `ysl-scan-etiquette-*` restés après un échec ou un `--no-pr` et les
   branches `fix/scan-etiquette-*` (`git worktree remove`, `git branch -D`). Les étiquettes
   versées au corpus privé (`rapport-*`, images complètes) : les garder pour le banc ou
   les supprimer avec le reste, au choix d'Adam.
