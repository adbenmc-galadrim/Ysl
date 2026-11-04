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
| `report` | les lectures, un objet JSON en texte ; leur forme est fixée par le bouton de l'iPhone (YSL-143), le serveur ne vérifie que l'objet et sa taille |
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
