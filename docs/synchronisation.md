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

| Statut | Sens                                                                                                                 | Côté appareil                                               |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 200    | appliquée, maintenant ou par un envoi précédent                                                                      | retirée de l'outbox                                         |
| 400    | colonne inconnue, valeur invalide, `not null` manquant (SQLSTATE `22xxx`, `23502`, `23514`)                          | `rejected`, à corriger                                      |
| 403    | identifiant d'une autre organisation                                                                                 | `rejected`                                                  |
| 404    | référence absente (`23503`), suppression d'une ligne inconnue                                                        | `rejected`                                                  |
| 409    | doublon sur une clé naturelle (`23505`) : deux appareils hors ligne ont créé le même e-mail, la même clé de réglage… | `rejected`, le second part en « Corriger »                  |
| 503    | le serveur n'a pas pu la prendre (verrou, rejeu épuisé, erreur inattendue)                                           | tentative comptée, le paquet s'arrête là, renvoyé plus tard |

Un rejet 4xx est aussi consigné dans `sync_op` : la même opération renvoyée reçoit
la même réponse. Le dernier écrit gagne, ligne par ligne, dans l'ordre d'arrivée au
serveur ; les garde-fous des transitions de statut et de la remise (§8.4) viennent
avec YSL-34.

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

## Côté appareil

- Toute écriture passe par `commitLocal` : la ligne et son opération d'outbox dans
  la même transaction Dexie (`features/db/commit.ts`). L'outbox (version 3 du
  schéma) distingue `queued` et `rejected`.
- Le moteur (`features/sync/engine.ts`) fait un push puis un pull, une
  synchronisation à la fois. Déclencheurs : au lancement d'une session, au retour du
  réseau, au retour au premier plan, 500 ms après un commit, toutes les 60 s au
  premier plan. Pas de Background Sync (absent d'iOS).
- Écrans : pastille Colis (`À jour`, `Synchronisation`, `Hors ligne`), bannière
  « N changements en attente » quand le serveur est hors de portée, ligne Réglages ›
  Synchronisation et écran `/reglages/synchronisation` (état, « Synchroniser
  maintenant », ce qui est sur l'iPhone, mise à jour).
- Déconnexion : une dernière synchronisation ; s'il reste des opérations `queued`,
  la déconnexion est refusée avec leur nombre. Sinon le compte est déconnecté puis la
  base locale et les photos OPFS sont effacées.

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
