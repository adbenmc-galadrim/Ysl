# Synchronisation et outbox

Ticket YSL-28 (cahier des charges §7.2, §8.4, §8.6 ; décision D3 : Dexie + outbox,
pas PowerSync). Chaque iPhone et chaque ordinateur du service tient une copie des
tables du serveur dans Dexie (`apps/web/src/features/db`) et lui envoie ses
changements par une file locale, l'outbox. Deux procédures tRPC suffisent :
`sync.push` et `sync.pull` (`packages/api/src/features/sync`, contrat dans
`packages/contract/src/sync.ts`). Les photos et les lots en cours restent sur le
téléphone (D7, D8, §8.5) : la synchronisation ne porte que ce que le serveur garde.

## Ce qui circule

| Sens               | Quoi                                                                                                                                       | Clé                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Appareil → serveur | une opération par écriture locale : `upsert` (la ligne entière) ou `delete` (suppression logique), avec son `op_id` et l'horodatage client | `op_id` (UUID v7, `sync_op`)                                      |
| Serveur → appareil | les lignes des douze tables synchronisées de l'organisation, écrites depuis le curseur                                                     | `server_xid` (identifiant de la transaction qui a écrit la ligne) |

Un appareil appartient à une organisation par le compte connecté
(`organization_member`) ; sans rattachement, les deux procédures répondent 403
(`pnpm auth:attach-organization`). Les dates traversent le fil tRPC par `superjson`.

## `sync.push`

Les opérations partent par paquets de 100 au plus, dans l'ordre où elles ont été
faites. Le serveur les applique une par une, chacune dans sa transaction :

1. `set local lock_timeout = '3s'` ;
2. `insert into sync_op … on conflict do nothing` : si l'`op_id` est déjà là, la
   réponse est le statut enregistré, rien n'est réécrit ;
3. `upsert` : `insert … on conflict (id) do update set … where
   <table>.organization_id = excluded.organization_id`, sans jamais réécrire
   `organization_id`, `server_xid` ni `created_at` ; zéro ligne touchée = la ligne
   appartient à une autre organisation (403). `event` est en insertion seule.
   `delete` : `deleted_at` posé sur la ligne de l'organisation, 404 si elle n'y est pas ;
4. une transaction refusée pour un motif passager (`40001`, `40P01`, `55P03`) est
   rejouée jusqu'à trois fois.

Un statut par opération, dans l'ordre envoyé :

| Statut | Sens                                                                                                                                                                                                           | Côté appareil                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 200    | appliquée, maintenant ou par un envoi précédent                                                                                                                                                                | retirée de l'outbox                                         |
| 400    | colonne inconnue, valeur invalide, `not null` manquant, destinataire absent sur `notifie`/`remis`, autre garde-fou (SQLSTATE `22xxx`, `23502`, `23514`, `P0xxx`)                                               | `rejected`, à corriger                                      |
| 403    | identifiant d'une autre organisation                                                                                                                                                                           | `rejected`                                                  |
| 404    | référence absente (`23503`), suppression d'une ligne inconnue                                                                                                                                                  | `rejected`                                                  |
| 409    | doublon sur une clé naturelle (`23505`) : deux appareils hors ligne ont créé le même e-mail, la même clé de réglage… ; transition de statut hors du graphe, remise écrasée, annulation défaite (voir plus bas) | `rejected`, le second part en « Corriger »                  |
| 503    | le serveur n'a pas pu la prendre (verrou, rejeu épuisé, erreur inattendue)                                                                                                                                     | tentative comptée, le paquet s'arrête là, renvoyé plus tard |

Le suivi d'un colis (`tracking_norm`) n'est pas une clé naturelle : un même numéro peut
être reçu deux fois (« Ajouter quand même », F10), l'index `parcel_tracking_norm_idx` n'est
pas unique et le doublon se traite sur l'appareil, à la lecture
(`docs/architecture/capture-rafale.md`, « Les doublons »). Deux appareils hors ligne qui
scannent le même colis créent donc deux lignes, visibles toutes deux dans la liste.

Un rejet 4xx est aussi consigné dans `sync_op`, avec son motif (`reason` : la
contrainte et la ligne levée par le trigger ou la vérification, le seul SQLSTATE
sinon, ou le motif du serveur ; des identifiants et des noms de colonnes, jamais une
valeur envoyée par l'appareil ni les paramètres de la requête) : la
même opération renvoyée reçoit la même réponse, et `select * from sync_op where
status = 409` est le journal des conflits du §8.4. Le dernier écrit gagne **ligne par
ligne**, et non champ par champ comme le §8.4 le prévoit (écart assumé tant qu'une
ligne n'a qu'un auteur à la fois), dans l'ordre d'arrivée au serveur ; une suppression
reste acquise, une copie en retard ne la défait pas.

## Garde-fous des statuts et de la remise

Tickets YSL-34 et YSL-43 (§8.3, §8.4, F30). Des triggers de `packages/db` (migrations
`0004_transitions_statut` et `0005_statuts_reversibles`) tiennent le graphe des statuts,
quel que soit l'auteur de l'écriture ; `sync.push` reconnaît chaque garde-fou au nom de contrainte que le
trigger lève (`packages/api/src/features/sync/errors.ts`, `GUARDS`) et répond avec un
message propre.

| Garde-fou                   | Règle                                                                                                                                                                                                                                                              | Réponse |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `parcel_status_transition`  | en avant : `a_completer → recu` ; `recu → notifie, remis, retourne` ; `notifie → remis, retourne`. En arrière : `recu → a_completer` ; `notifie → recu` ; `remis → notifie, recu` ; `retourne → notifie, recu`. Rester sur place est toujours permis               | 409     |
| `parcel_status_stale`       | un changement de statut porte `status_seq` + 1 ; sans compteur (version de l'app d'avant YSL-43), seul un pas en avant passe et le serveur incrémente ; tout autre compteur vient d'une copie qui a manqué un changement                                           | 409     |
| `parcel_delivery_protected` | un colis `remis` garde `delivered_at` et `delivered_by` ; il ne repasse `notifie` que par une remise (`handover`) annulée qui le liste, et sans remise vivante qui le liste (une remise supprimée logiquement compte comme vivante tant qu'elle n'est pas annulée) | 409     |
| `handover_cancel_sticky`    | `handover.cancelled_at` posé ne se retire ni ne se déplace                                                                                                                                                                                                         | 409     |
| `handover_parcels_sticky`   | une `handover` garde ses `parcel_ids` : on annule une remise, on n'en retire pas un colis                                                                                                                                                                          | 409     |
| `parcel_recipient_check`    | `notifie` et `remis` exigent `person_id` ou `contact_id`                                                                                                                                                                                                           | 400     |

Le graphe vit dans `@repo/contract/parcel-status` (`FORWARD_TRANSITIONS`,
`BACKWARD_TRANSITIONS`, `canTransition(from, to)` ; `canTransition` et `PARCEL_STATUSES`
sont réexportés par `@repo/db/schema`) ; un
test de `packages/db` vérifie que le trigger accepte exactement ce qu'il décrit. Le même
module dit, pour chaque statut, ce qu'il reste à faire (`STATUS_TODO`), l'action qui le
défait (`STEP_BACK_LABEL`), le statut où mène ce retour (`stepBackOf` : un colis remis ou
retourné sans avoir été notifié revient à `recu`) et les colonnes à écrire
(`statusPatch` : compteur, date de notification, preuve de remise). Côté app,
`changeParcelStatus` et `stepBackParcel` (`apps/web/src/features/parcels/status.ts`)
écrivent la ligne et son opération dans la même transaction. Les noms de statut n'ont pas
changé : « En attente », le statut mort de la v1, n'a jamais existé en v2 ; ce qu'il
couvrait se lit « À notifier » (`recu`) ou « En attente de retrait » (`notifie`).
« Brouillon » n'existe que sur l'appareil (lot en cours) et n'atteint jamais le serveur.

Ce que cela donne entre deux appareils :

- **Remise écrasée.** L'appareil A remet le colis (`handover` + colis `remis`). L'appareil
  B, hors ligne depuis le matin, renvoie sa copie entière en `recu` : `remis → recu`
  (ou `remis → notifie` si la copie date d'un colis déjà notifié) est refusée en 409
  (`parcel_delivery_protected`) tant qu'aucune remise annulée ne liste le colis, que la
  `handover` de A soit vivante, pas encore arrivée ou supprimée logiquement ; la ligne du
  serveur ne bouge pas, l'opération de B part en « Corriger ».
- **Annulation tracée.** Annuler une remise, c'est poser `cancelled_at` sur la
  `handover` **puis** repasser le colis `notifie` (`delivered_at` et `delivered_by` à
  nul, `status_seq` + 1, sinon 409 `parcel_status_stale`), dans cet ordre dans
  l'outbox. La `handover` reste, annulée : c'est la trace.
  Une copie en retard qui la renverrait sans `cancelled_at` est refusée.
- **Modification ordinaire.** Changer l'emplacement ou les notes d'un colis remis passe,
  tant que le statut et la preuve de remise ne bougent pas.
- **Retour arrière voulu ou copie en retard.** L'appareil A notifie le colis
  (`recu → notifie`, `status_seq` 2 → 3). L'appareil B, hors ligne, change les notes de
  sa copie d'avant, encore `recu` avec `status_seq` 2, et la renvoie entière : refusée en
  409 (`parcel_status_stale`), alors qu'elle aurait passé pour une notification
  annulée. Si A annule ensuite la notification, il envoie `recu` avec `status_seq` 4, qui
  passe. Une ligne
  tirée avant `0005` n'a pas de compteur sur l'appareil : elle se lit 0, comme sur le
  serveur, où la migration pose 0 partout sans toucher `server_xid`.

Le compteur ferme une limite de YSL-34 : une copie en retard encore `remis` (un
appareil qui a vu la remise mais pas son annulation) ne repasse plus `notifie → remis`,
son compteur est périmé — à condition que la copie en ait un : une ligne tirée avant
`0005` et jamais retirée depuis n'en a pas, et passe encore pour un pas en avant. De même,
une copie qui renvoie le compteur inchangé se lit comme une app sans compteur
(`sync.push` ne réécrit que les colonnes reçues, le trigger ne voit pas la différence) :
un pas en avant passe, un retour arrière est refusé. Reste une limite, assumée : un colis
`remis` dont la `handover` a été refusée au push ne peut revenir en arrière qu'après l'envoi d'une `handover`
annulée ; l'écran de remise (YSL-75) enverra la `handover` avant le colis et relira le
serveur avant d'annuler. Enfin,
`parcel_recipient_check` fait échouer le `SET NULL` des clés `person_id` et
`contact_id` sur un colis `notifie`/`remis` : une personne ou un contact qui a un tel
colis se désactive, il ne se supprime pas.

## `sync.pull`

L'appareil envoie son curseur `{ generation, xid }` (ou rien la première fois) et
reçoit les lignes de son organisation telles que `xid ≤ server_xid < borne`, où la
borne est `pg_snapshot_xmin(pg_current_snapshot())` prise à la première page : toute
transaction en dessous est terminée, aucune écriture ne peut plus se glisser derrière
le curseur. Les pages suivent l'ordre `(server_xid, id)` entité après entité
(`SYNCED_ENTITIES`), avec un jeton de page `{ from, bound, entity, after }` ; la borne
devient le curseur suivant une fois la dernière page reçue. Une ligne peut revenir
deux fois d'un pull à l'autre : l'appareil la réécrit (`bulkPut`). Une ligne que
l'appareil n'a pas encore envoyée n'est pas écrasée par la copie du serveur.

`reset: true` quand le curseur est inutilisable (génération différente, ou `xid`
au-delà de la borne) : les lignes repartent de zéro et l'appareil les prend toutes.
Les suppressions étant logiques, rien n'est vidé localement ; la purge physique
(YSL-55) traitera le reste.

**Horizon du premier pull.** Un pull qui repart de zéro (premier lancement, `reset`)
ne rend que les `event` des 90 derniers jours (`EVENT_HORIZON_DAYS`, sur `at`) : le
journal fait l'essentiel des lignes d'un service et l'iPhone n'a besoin que des
récents. Un pull par curseur rend tous les nouveaux événements, quel que soit leur
`at`. L'historique complet d'une fiche se lira à la demande, dans une prochaine PR.

## Côté appareil

- Toute écriture passe par `commitLocal` : la ligne et son opération d'outbox dans
  la même transaction Dexie (`features/db/commit.ts`). L'outbox (version 3 du
  schéma) distingue `queued` et `rejected`.
- Le moteur (`features/sync/engine.ts`) fait un push puis un pull, une
  synchronisation à la fois. Déclencheurs : au lancement d'une session, au retour du
  réseau, au retour au premier plan, 500 ms après un commit, toutes les 60 s au
  premier plan. Après un échec (réseau, 401, 503), les déclencheurs automatiques
  attendent 2 s, 4 s… jusqu'à 5 min ; « Synchroniser maintenant » et le retour du
  réseau n'attendent pas. Pas de Background Sync (absent d'iOS).
- Préparation hors ligne (`/preparation`, `features/offline`) : après la
  connexion, tant que l'appareil n'est pas marqué préparé (`courrier.prepared` en
  `localStorage`, effacé à la déconnexion), toute route authentifiée y renvoie.
  Trois lignes : **Annuaire** (le premier pull, fait quand le curseur existe ;
  `pulled` du moteur donne les lignes reçues), **Lecture des étiquettes** (les gros
  fichiers de `@repo/ocr/assets` téléchargés par la page dans le cache
  `courrier-models`, fichier par fichier avec la progression en octets, servis
  hors ligne par la route `CacheFirst` du service worker ; un fichier déjà en cache
  n'est jamais retéléchargé, un fichier d'un autre build est retiré) et **Écrans et
  polices** (le précache du service worker, fait quand un worker contrôle la
  portée). Le téléchargement des modèles repart à chaque lancement de session s'il
  manque des fichiers, jamais seul après une coupure en cours de session : « Reprendre
  le téléchargement (N Mo) » ou l'ouverture suivante. « Commencer en saisie manuelle »
  entre dans l'app sans attendre ; la lecture automatique s'active dès que les
  fichiers sont là.
- Écrans : pastille Colis (`À jour`, `Synchronisation`, `Hors ligne`), bannière
  « N changements en attente » quand le serveur est hors de portée, ligne Réglages ›
  Synchronisation et écran `/reglages/synchronisation` (état, « Synchroniser
  maintenant », ce qui est sur l'iPhone, mise à jour).
- Déconnexion : une dernière synchronisation ; s'il reste des opérations `queued`
  ou `rejected` (seule copie d'un changement à corriger), la déconnexion est refusée
  avec leur nombre. Sinon le compte est déconnecté, la synchro arrêtée, puis la base
  locale et les photos OPFS sont effacées.

## Fiche colis et historique

La fiche (`/colis/<id>`, F29) et « Modifier le colis » écrivent comme le reste :
`commitLocal`, hors ligne compris.

- **Modification** (`features/parcels/edit.ts`) : la ligne `parcel`, un `contact`
  quand le destinataire est saisi à la main (« Personne hors annuaire ») et un
  événement, dans le même commit. L'enregistrement recalcule la complétude comme la
  fin d'un lot : un colis à compléter qui a désormais un transporteur, un numéro
  (sauf `sans_suivi`) et un destinataire passe à `recu` ; un colis `recu` auquel on
  retire ce qui le rendait complet revient à `a_completer`, avec le compteur
  `status_seq`. Un colis `notifie` ou `remis` garde un destinataire de l'annuaire ou
  un contact (`parcel_recipient_check`). Le numéro de suivi n'est jamais bloquant ;
  il est revalidé contre le transporteur choisi (`validateTracking`).
- **Retour arrière** depuis la fiche : « Annuler la notification » et « Annuler le
  retour » (`changeParcelStatus`). « Annuler la remise » attend l'écran de remise :
  il faut annuler la `handover` avec son motif dans le même commit.
- **Suppression** : logique (`deleted_at`), avec son événement ; le colis quitte les
  listes de tous les appareils, son historique reste.
- **Événements** (`@repo/contract/parcel-event`) : `event.entity = 'parcel'`,
  `type` `parcel.edited` (`detail.fields`, les champs changés), `parcel.status`
  (`detail.from`, `detail.to`) ou `parcel.deleted`, `actor_id` = l'agent. La
  réception n'a pas d'événement : la ligne la porte (`received_at`). Un appareil
  ignore un type ou un `detail` qu'il ne sait pas lire. L'historique de la fiche y
  ajoute la notification et la remise portées par la ligne sans événement, et l'état
  de chaque événement dans l'outbox (pas encore envoyé, refusé avec le motif).
- **État de synchronisation** de la fiche : `Refusé` si une opération du colis est
  `rejected` (bandeau rouge avec le motif), `Non envoyé` si une opération attend
  et que la bannière d'attente de Colis s'affiche, `À jour` sinon.
- **Photo** : lue dans OPFS par `parcelId` ; elle n'existe que sur l'iPhone qui a
  scanné (D8), les autres affichent « Photo restée sur l'iPhone qui a scanné ce
  colis ».

## Colis abîmé : la réserve

Zone d'ombre « Colis abîmé » (YSL-53). L'agent pose une **réserve** sur l'état du
colis depuis le panneau du colis lu (écran Scan) ou depuis la fiche (« Signaler un
dommage », `/colis/<id>/dommage`).

- **Ligne** : colonnes de `parcel` (migration `0006_reserve_colis`) : `damage` (motif :
  `carton_abime`, `ouvert`, `mouille`, `contenu_casse`, `autre`), `damage_note`,
  `damage_notify` (« Prévenir dans l'e-mail au salarié »), `damage_carrier_reserve`
  (« Réserve auprès du transporteur »), `damaged_at`. `parcel_damage_check` refuse un
  motif inconnu et un motif sans date. La liste Colis et la fiche lisent la ligne :
  ligne orange « Réserve · Carton abîmé », bandeau orange sur la fiche.
- **Événements** : `parcel.damaged` (`detail` : motif, remarque, les deux bascules,
  nombre de photos) et `parcel.damage_lifted` (`detail.reason`), dans le même commit
  que la ligne (`features/damage/report.ts`).
- **Lever la réserve** remet les colonnes à nul ; l'historique garde la pose et la
  levée, et une réserve peut être reposée ensuite.
- **Depuis Scan**, la réserve vit sur le brouillon (`draft_parcel.damage`) ; « Terminer »
  l'écrit sur le colis avec son événement, daté du signalement.
- **Photos** : nature `dommage`, dans OPFS comme l'étiquette (D8) : elles ne quittent
  pas l'iPhone qui a signalé le dommage. Les photos d'une réserve sont celles prises
  depuis `damaged_at` ; un autre iPhone affiche « N photos restées sur l'iPhone qui a
  signalé le dommage » d'après le nombre porté par l'événement.
- **E-mail au salarié** (YSL-61) : `damageForEmail` de `@repo/contract/parcel-damage`
  rend le motif et la remarque quand « Prévenir » est allumé, rien sinon.
- **Export CSV** : colonne `reserve` (« Carton abîmé : coin enfoncé »).

## Alerte et export de secours

Ticket YSL-36 (F47, §8.4.7). Tant qu'un changement n'a pas atteint le serveur, le
téléphone en est la seule copie : Safari peut effacer le stockage, l'iPhone peut
lâcher.

- **Alerte au-delà de 24 h** : dès qu'une opération de l'outbox (`queued` ou
  `rejected`) a plus de 24 h (`clientTs` la plus ancienne, `STALE_AFTER_MS` dans
  `features/sync/sync-value.ts`), la bannière de Colis passe en rouge
  (« N changements en attente depuis plus de 24 h ») et reste affichée même en
  ligne ; la carte de Réglages › Synchronisation passe en rouge et invite à exporter ;
  la ligne Réglages compte en rouge. Le seuil se lit sur l'âge des opérations, pas
  sur la dernière synchronisation : le moteur date celle-ci aussi après un push à
  rejouer (503), elle ne prouve pas que tout est parti.
- **Liste** : l'écran Synchronisation montre les opérations en attente, de la plus
  ancienne à la plus récente (10 au plus, puis « et N autres ») : ce qu'elles
  touchent (colis par la fin de son numéro, salarié par son nom, remise par son
  destinataire…), l'heure du changement, « Refusé » pour celles que le serveur a
  rejetées. Le groupe disparaît quand tout est envoyé.
- **Export JSON** (`features/sync/backup.ts`) : le dernier bouton du groupe construit
  un fichier `courrier-secours-AAAA-MM-JJ-HHMM.json` et le passe à la feuille de
  partage (`navigator.share` avec fichier : Fichiers, AirDrop, Mail) ; sans partage
  de fichiers (Safari sur Mac, Chromium), il se télécharge. Contenu :
  `{ format: 'courrier-secours', version: 1, exportedAt, app, pending, rejected,
  changes[] }`, chaque changement étant l'opération d'outbox (`opId`, `entity`,
  `entityId`, `type`, `state`, `clientTs`, `attempts`, `lastError`, `patch`) avec la
  ligne locale courante (`row`, `null` si elle a disparu). Jamais de photo ni de
  signature (D8, §8.5) : les données seulement, dates en ISO 8601.
- **S'en servir** : le fichier se relit tel quel ; un `patch` d'`upsert` est la ligne
  entière à rejouer par `sync.push` (le même `op_id` reste idempotent), une
  opération `rejected` dit pourquoi dans `lastError`. Pas d'import automatique :
  la restauration passe par le serveur (`psql` ou un appel `sync.push` fabriqué),
  à la main.

## Exploitation

- **Restauration** (pg_dump/restore, PITR, changement d'hébergeur) : le compteur de
  transactions peut repartir plus bas que les curseurs des appareils, et leurs pulls
  ne renverraient plus rien. Juste après la restauration :
  `update sync_generation set generation = gen_random_uuid(), restored_at = now();`
  Chaque appareil repart alors d'une lecture complète. Après une restauration logique,
  `pg_resetwal -x` au-delà de `max(server_xid)` évite aussi que de nouvelles
  écritures reçoivent un `server_xid` inférieur aux anciennes.
- **Transactions longues** : la borne du pull est l'`xmin` de l'instance entière, toutes
  bases confondues. Instance dédiée, `max_prepared_transactions = 0`,
  `idle_in_transaction_session_timeout` court, purges par petits lots.
- **`sync_op`** grandit d'une ligne par opération : purge au-delà de la profondeur
  d'une outbox (quelques semaines), index `sync_op_applied_at_idx` (YSL-55).
- **Index `*_cursor_idx`** : `REINDEX CONCURRENTLY` périodique (pages coupées par les
  insertions de plusieurs organisations).
