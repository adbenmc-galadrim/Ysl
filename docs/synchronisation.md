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

Ticket YSL-34 (§8.3, §8.4). Des triggers de `packages/db` (migration
`0004_transitions_statut`) tiennent le graphe des statuts, quel que soit l'auteur de
l'écriture ; `sync.push` reconnaît chaque garde-fou au nom de contrainte que le
trigger lève (`packages/api/src/features/sync/errors.ts`, `GUARDS`) et répond avec un
message propre.

| Garde-fou                   | Règle                                                                                                                                                                                                                                                              | Réponse |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `parcel_status_transition`  | `a_completer → recu` ; `recu → notifie, remis, retourne` ; `notifie → remis, retourne` ; `remis → notifie` ; rester sur place est toujours permis                                                                                                                  | 409     |
| `parcel_delivery_protected` | un colis `remis` garde `delivered_at` et `delivered_by` ; il ne repasse `notifie` que par une remise (`handover`) annulée qui le liste, et sans remise vivante qui le liste (une remise supprimée logiquement compte comme vivante tant qu'elle n'est pas annulée) | 409     |
| `handover_cancel_sticky`    | `handover.cancelled_at` posé ne se retire ni ne se déplace                                                                                                                                                                                                         | 409     |
| `handover_parcels_sticky`   | une `handover` garde ses `parcel_ids` : on annule une remise, on n'en retire pas un colis                                                                                                                                                                          | 409     |
| `parcel_recipient_check`    | `notifie` et `remis` exigent `person_id` ou `contact_id`                                                                                                                                                                                                           | 400     |

Le graphe est aussi la constante `PARCEL_TRANSITIONS` de `@repo/db/schema`
(`canTransition(from, to)`), que l'app peut consulter avant d'écrire ; un test de
`packages/db` vérifie que le trigger accepte exactement ce qu'elle décrit. « Brouillon »
n'existe que sur l'appareil (lot en cours) et n'atteint jamais le serveur.

Ce que cela donne entre deux appareils :

- **Remise écrasée.** L'appareil A remet le colis (`handover` + colis `remis`). L'appareil
  B, hors ligne depuis le matin, renvoie sa copie entière en `recu` : transition
  `remis → recu` refusée en 409, la ligne du serveur ne bouge pas, l'opération de B part
  en « Corriger ». Si la copie de B date d'un colis déjà `notifie`, c'est
  `remis → notifie` : refusée tant qu'aucune remise annulée ne liste le colis, que la
  `handover` de A soit vivante, pas encore arrivée ou supprimée logiquement.
- **Annulation tracée.** Annuler une remise, c'est poser `cancelled_at` sur la
  `handover` **puis** repasser le colis `notifie` (`delivered_at` et `delivered_by` à
  nul), dans cet ordre dans l'outbox. La `handover` reste, annulée : c'est la trace.
  Une copie en retard qui la renverrait sans `cancelled_at` est refusée.
- **Modification ordinaire.** Changer l'emplacement ou les notes d'un colis remis passe,
  tant que le statut et la preuve de remise ne bougent pas.

Deux limites, assumées : une copie en retard encore `remis` (un appareil qui a vu la
remise mais pas son annulation) repasse par `notifie → remis`, qui est dans le graphe,
et remet le colis avec son ancienne preuve ; et un colis `remis` dont la `handover` a
été refusée au push ne peut revenir à `notifie` qu'après l'envoi d'une `handover`
annulée. Les deux demandent un écran de remise (YSL-75) qui envoie la `handover` avant
le colis et relit le serveur avant d'annuler. Enfin,
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
- Écrans : pastille Colis (`À jour`, `Synchronisation`, `Hors ligne`), bannière
  « N changements en attente » quand le serveur est hors de portée, ligne Réglages ›
  Synchronisation et écran `/reglages/synchronisation` (état, « Synchroniser
  maintenant », ce qui est sur l'iPhone, mise à jour).
- Déconnexion : une dernière synchronisation ; s'il reste des opérations `queued`
  ou `rejected` (seule copie d'un changement à corriger), la déconnexion est refusée
  avec leur nombre. Sinon le compte est déconnecté, la synchro arrêtée, puis la base
  locale et les photos OPFS sont effacées.

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
