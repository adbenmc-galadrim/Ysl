# Rapports de scan (phase de test)

Pendant la phase de test, l'utilisateur peut signaler un scan raté. Le rapport part de
l'iPhone avec l'image complète et toutes les lectures, attend sur le serveur, puis le PC
d'Adam le récupère et le supprime. Un agent s'en sert ensuite pour améliorer la lecture.

C'est une exception à D8 (les photos d'étiquettes ne quittent pas l'iPhone), décidée par
Adam le 04/11/2026 (D32) **pour la phase de test seulement** : rien n'est masqué, l'envoi
ne part que sur action de l'utilisateur. Tout ceci se retire avant les vrais utilisateurs
(YSL-148, voir « Retrait »). Hors de cette exception, D8 reste entière.

## Mise en service

Une seule variable sur l'API (`ysl-api` dans Coolify) : `SCAN_REPORTS_KEY`, 32 caractères
au moins, tirée au hasard (`openssl rand -base64 48`). Sans elle, toutes les routes
répondent 404 et l'iPhone ne peut rien envoyer : c'est aussi l'interrupteur.

La même valeur sert au PC (variable d'environnement locale, jamais dans le dépôt). Le
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
  l'admin de l'app). La suppression d'une entreprise emporte ses rapports.

Aucune vue de l'app n'affiche ces rapports, ni chez l'admin d'entreprise ni chez l'admin
de l'app (D26) ; un test vérifie qu'aucun routeur tRPC ne lit la table.

## Routes

Toutes sous `https://ysl-api.shinseo.fr/api/scan-reports`, toutes en `Cache-Control:
no-store`.

### Envoi, depuis l'iPhone

`POST /api/scan-reports`, avec la session de l'utilisateur (cookie, comme tRPC), en
`multipart/form-data` :

| Champ | Contenu |
| --- | --- |
| `id` | UUID choisi par le téléphone : un renvoi après une réponse perdue est le même rapport |
| `report` | les lectures, un objet JSON en texte |
| `comment` | facultatif |
| `image` | le fichier de l'image |

| Réponse | Sens | Ce que fait l'outbox |
| --- | --- | --- |
| 201 `{ id }` | gardé | retire le rapport |
| 200 `{ id }` | déjà reçu (renvoi) | retire le rapport |
| 400 `invalid` | champ manquant ou mal formé | abandonne |
| 401 | pas de session | attend une reconnexion |
| 403 `suspended` | compte ou entreprise suspendus | abandonne |
| 404 | fonction éteinte (pas de clé) | abandonne |
| 413 `too_large`, 415 `type` | image trop lourde, pas une image | abandonne |
| 429 `rate_limited` | 20 envois par compte et par 10 minutes ; `Retry-After` | réessaie plus tard |
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

Le PC n'acquitte qu'après avoir écrit le rapport et vérifié l'empreinte de l'image.

```bash
curl -s -H "Authorization: Bearer $SCAN_REPORTS_KEY" https://ysl-api.shinseo.fr/api/scan-reports
```

## Retrait

Avant les premiers vrais utilisateurs (YSL-148) :

1. Retirer `SCAN_REPORTS_KEY` de l'API et redéployer : plus rien n'entre ni ne sort.
2. Retirer le bouton de l'iPhone, les routes (`apps/server/src/scan-reports-route.ts`),
   le service (`packages/api/src/features/scan-reports/`), son appel dans `runPurge`, le
   contrat (`packages/contract/src/scan-report.ts`) et la table du schéma.
3. Migration de retrait : `DROP TABLE "scan_report";`. Aucune autre table n'en dépend.
