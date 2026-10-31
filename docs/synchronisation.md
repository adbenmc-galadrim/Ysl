# Synchronisation et outbox

Ticket YSL-28 (cahier des charges §7.2, §8.4, §8.6 ; décision D3 : Dexie + outbox,
pas PowerSync, confirmé pour la synchronisation filtrée par rôle, YSL-117). Chaque iPhone et chaque ordinateur du service tient une copie des
tables du serveur dans Dexie (`apps/web/src/features/db`) et lui envoie ses
changements par une file locale, l'outbox. Deux procédures tRPC suffisent :
`sync.push` et `sync.pull` (`packages/api/src/features/sync`, contrat dans
`packages/contract/src/sync.ts`). Les photos et les lots en cours restent sur le
téléphone (D7, D8, §8.5) : la synchronisation ne porte que ce que le serveur garde.

## Ce qui circule

| Sens               | Quoi                                                                                                                                       | Clé                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Appareil → serveur | une opération par écriture locale : `upsert` (la ligne entière) ou `delete` (suppression logique), avec son `op_id` et l'horodatage client | `op_id` (UUID v7, `sync_op`)                                      |
| Serveur → appareil | les lignes des quinze tables synchronisées que le rôle atteint, écrites depuis le curseur                                                      | `server_xid` (identifiant de la transaction qui a écrit la ligne) |

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

| Statut | Sens                                                                                                                                                                                                           | Côté appareil                                                                                  |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 200    | appliquée, maintenant ou par un envoi précédent                                                                                                                                                                | retirée de l'outbox                                                                            |
| 400    | colonne inconnue, valeur invalide, `not null` manquant, destinataire absent sur `notifie`/`remis`, autre garde-fou (SQLSTATE `22xxx`, `23502`, `23514`, `P0xxx`)                                               | `rejected`, à corriger                                                                         |
| 403    | identifiant d'une autre organisation ; réglage écrit par un non-admin ; modèle d'e-mail d'un autre agent ; notification préparée par un autre agent (voir « Modèles et e-mails ») ; écriture hors de ce que le rôle atteint (voir plus bas)                            | `rejected`                                                                                     |
| 404    | référence absente (`23503`), suppression d'une ligne inconnue                                                                                                                                                  | `rejected`                                                                                     |
| 409    | doublon sur une clé naturelle (`23505`) : deux appareils hors ligne ont créé le même e-mail, la même clé de réglage… ; transition de statut hors du graphe, remise écrasée, annulation défaite (voir plus bas), colis ou salarié vers un département archivé | `rejected`, le second part en « Corriger » ; une remise doublée se range seule (voir plus bas) |
| 503    | le serveur n'a pas pu la prendre (verrou, rejeu épuisé, erreur inattendue)                                                                                                                                     | tentative comptée, le paquet s'arrête là, renvoyé plus tard                                    |

Ces statuts valent par opération. Un compte `platform_admin`, de rôle inconnu, ou `department` rattaché à aucun département, est refusé avant : `sync.push` et `sync.pull` entiers répondent 403.

## Ce que chaque rôle atteint (§2.1 du cahier)

| Rôle | Colis | Annuaire | Remise (`handover`, passage à `remis`, code utilisé, `pickup.verify`) |
| --- | --- | --- | --- |
| `company_admin` | toute l'entreprise | lecture, écriture | non |
| `shuttle` | toute l'entreprise, jusqu'à YSL-133 (`parcelScope`) | lecture | selon le profil : « Navette = département » (`canHandOver`, relu à chaque écriture) |
| `department` | les siens | le sien, lecture et écriture | les siens |
| `platform_admin` | aucun | aucun | non |

Le profil de fonctionnement est la ligne `setting` de clé `operatingProfile`. Le serveur seul l'écrit (`operating.save`) : `sync.push` refuse cette clé, même d'un admin. Il descend à tous les appareils ; sans ligne, l'entreprise garde `DEFAULT_OPERATING_PROFILE`. La conversion (`docs/conversion-multi-entreprises.md`) pose `SMALL_SITE_OPERATING_PROFILE`. Une remise faite hors ligne par une navette dont le profil vient de changer est refusée au push (403) et part en « Corriger ».

Un compte `department` reçoit ses colis et ce qui en dépend (contacts, journal, e-mails, remises), ses codes, les réglages et ses modèles ; ni les lots, ni les expéditeurs, ni les alias. Un colis sans département lui reste invisible. En écriture il ne crée pas de colis et n'en donne aucun à un autre département : 403 `sync.op.outOfScope`.

**Département d'un colis.** Le serveur le pose (trigger `parcel_department_of_person`) : celui de la personne, à la création et quand la personne change. Sans personne, celui qu'indique un compte de l'entreprise (cas d'un contact). Un salarié déplacé ne déplace pas ses colis : YSL-128. Exception (ME25) : à la création, le département envoyé par l'app reste, c'est celui que l'agent a vu à la revue ; un colis qui en a déjà un garde le sien face à une copie, et un colis qui n'en a pas prend celui qu'on lui choisit. Une fiche sans département vide celui du colis, sauf en tournée. Un colis ne naît pas « En route » sans département (409). Avec une tournée, un contact sans département connu ne reçoit plus « Service courrier » : son colis attend « À compléter ».

**Curseur.** Une ligne devenue visible remonte : les lignes liées à un colis suivent la plage du colis. Une ligne sortie de la portée ne laisse aucune marque : `department.scope_xid` retient la dernière transaction qui en a fait sortir une, et un curseur qui ne l'a pas dépassée repart de zéro (`reset`). Un compte qui change de département ou de rôle détient un curseur d'une autre génération (`readerGeneration`) et repart de zéro lui aussi.

**`department`** se lit seulement et ne s'envoie qu'au client qui l'annonce (`departments: true`) : une PWA d'avant ne connaît pas cette table et sa synchronisation s'arrêterait.

**Statuts d'une tournée** (`en_route`, `depose`, `a_regulariser`) : seul le client qui l'annonce (`tourStatuses: true`) les reçoit. Une PWA d'avant reçoit ces colis comme retirés (`deletedAt`) : ils quittent l'appareil sans casser sa synchronisation, et reviennent à leur prochaine écriture dans un statut qu'elle connaît. Sa copie restée en file est refusée par `parcel_status_guard`. Elle perd l'historique déjà reçu de ces colis jusqu'à sa mise à jour. À la mise à jour, le curseur s'efface (Dexie 9) pour tout relire.

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

## Modèles et e-mails

Les modèles d'e-mail (`email_template`) appartiennent à leur agent (D2) et les e-mails
(`notification`) à qui les a préparés. `sync.pull` ne renvoie à chaque agent que ses propres
modèles ; `sync.push` vérifie avant d'écrire :

| Cas                                                                                          | Statut | Message                        |
| -------------------------------------------------------------------------------------------- | ------ | ------------------------------ |
| modèle dont `owner_id` (envoyé ou en base) n'est pas l'agent qui pousse                      | 403    | `sync.op.templateOwner`        |
| suppression du modèle par défaut (`delete`, ou `deleted_at` posé sur une ligne `is_default`) | 409    | `sync.op.defaultTemplate`      |
| suppression du modèle livré (id `presetTemplateId`), même quand un autre est par défaut      | 409    | `sync.op.defaultTemplate`      |
| second modèle par défaut du même agent et du même type (`email_template_default_idx`)        | 409    | `sync.op.defaultTemplateTwice` |
| notification qui ne suit pas le contrat `notificationRow` (`@repo/contract/mail`)            | 400    | message générique              |
| notification dont `prepared_by` n'est pas l'agent qui pousse                                 | 403    | `sync.op.notificationOwner`    |
| notification qui recule (`sent` vers `opened`…, `canMoveNotification`)                       | 409    | `sync.op.notificationStale`    |

Le suivi est déclaratif (spike S5) : `prepared` avant le toucher du lien, `opened` si la
page est passée en arrière-plan dans les 2 s, `sent` ou `failed` selon ce que l'agent
déclare. `markSent` écrit l'e-mail, les colis passés à `notifie` (ou leur relance datée
dans `last_notified_at`) et un événement `parcel.notified` par colis dans le même
`commitLocal`. Le texte de l'e-mail n'est pas stocké. Le pull ramène les modèles de toute
l'organisation ; l'app n'affiche que ceux de l'agent connecté.

Destinataire sans adresse (YSL-72, migration `0014_prevenir_autrement`) : un e-mail
écrit à un collègue ou à une assistante garde le destinataire dans `person_id` /
`contact_id`, l'adresse du tiers dans `recipients` et son nom dans `relay_name` ; le contact
retient le dernier tiers dans `contact.notify_via` (`person:<id>` ou `contact:<id>`).
Prévenu de vive voix, il n'y a pas de notification : le même `commitLocal` écrit le code
de retrait (`pickup_code`), les colis passés à `notifie` (ou leur relance datée) et un
événement `parcel.informed` (`{ kind: 'avis' | 'relance' }`) par colis, compté comme
une relance par les règles de F37.

## Garde-fous des statuts et de la remise

Tickets YSL-34 et YSL-43 (§8.3, §8.4, F30). Des triggers de `packages/db` (migrations
`0004_transitions_statut` et `0005_statuts_reversibles`) tiennent le graphe des statuts,
quel que soit l'auteur de l'écriture ; `sync.push` reconnaît chaque garde-fou au nom de contrainte que le
trigger lève (`packages/api/src/features/sync/errors.ts`, `GUARDS`) et répond avec un
message propre.

| Garde-fou                   | Règle                                                                                                                                                                                                                                                                                      | Réponse |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| `parcel_status_transition`  | en avant : `a_completer → recu` ; `recu → notifie, remis, retourne` ; `notifie → remis, retourne`. En arrière : `recu → a_completer` ; `notifie → recu` ; `remis → notifie, recu` ; `retourne → notifie, recu`. Rester sur place est toujours permis                                       | 409     |
| `parcel_status_stale`       | un changement de statut porte `status_seq` + 1 ; sans compteur (version de l'app d'avant YSL-43), seul un pas en avant passe et le serveur incrémente ; tout autre compteur vient d'une copie qui a manqué un changement                                                                   | 409     |
| `parcel_delivery_protected` | un colis `remis` garde `delivered_at` et `delivered_by` ; il ne quitte `remis` que si la remise (`handover`) dont `at` vaut son `delivered_at` est annulée ; une remise perdante qui le liste ne compte pas, une remise supprimée logiquement reste vivante tant qu'elle n'est pas annulée | 409     |
| `handover_cancel_sticky`    | `handover.cancelled_at` posé ne se retire ni ne se déplace                                                                                                                                                                                                                                 | 409     |
| `handover_parcels_sticky`   | une `handover` garde ses `parcel_ids` : on annule une remise, on n'en retire pas un colis                                                                                                                                                                                                  | 409     |
| `parcel_recipient_check`    | `notifie` et `remis` exigent `person_id` ou `contact_id`                                                                                                                                                                                                                                   | 400     |

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
  (`parcel_delivery_protected`) tant que la remise dont `at` vaut son `delivered_at` n'est
  pas annulée, que la `handover` de A soit vivante, pas encore arrivée ou supprimée
  logiquement ; la ligne du
  serveur ne bouge pas, l'opération de B part en « Corriger ».
- **Même colis remis sur deux appareils.** A et B, hors ligne, remettent le même colis.
  A envoie le premier ; la `handover` de B passe, mais son colis est refusé en 409
  (`parcel_delivery_protected`, la preuve de remise ne change pas). Après le pull, B
  range sa copie sur celle du serveur (une opération refusée ne protège pas sa ligne),
  retire l'opération refusée de l'outbox et, quand aucun colis de sa `handover` n'est
  plus remis par elle, l'annule (`cancelled_at`, jamais supprimée, sans motif : personne
  ne l'a défaite) ; Colis affiche « Déjà remis à … par un
  collègue » (`settleDeliveryConflicts`, appelé par `afterPull` du moteur). Une
  `handover` qui garde une partie de ses colis reste vivante ; la ligne, la fiche et
  l'historique d'un colis suivent la `handover` dont l'heure est son `delivered_at`.
- **Annulation tracée (F44, `cancelHandover`).** Annuler une remise, c'est poser
  `cancelled_at`, `cancel_reason`, `cancel_note` et `cancelled_by_name` sur la
  `handover` **puis** repasser ses colis `notifie`, ou `recu` s'ils n'ont jamais été
  notifiés (`delivered_at` et `delivered_by` à nul, `status_seq` + 1, sinon 409
  `parcel_status_stale`), dans cet ordre dans l'outbox, avec un
  `parcel.handover_cancelled` par colis. La `handover` reste, annulée : c'est la trace.
  Toute la remise s'annule, jamais un colis seul ; un colis perdu au profit d'un autre
  iPhone reste à la remise gagnante. Le code de retrait reste consommé. Deux annulations
  croisées passent sans refus : la première et son motif restent.
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
annulée ; l'écran de remise (`recordHandover`, YSL-74) envoie la `handover` avant le
colis, et l'annulation devra relire le serveur avant d'annuler. Enfin,
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

`reset: true` quand le curseur est inutilisable (génération différente, `xid`
au-delà de la borne, ou sous l'horizon de purge de l'organisation) : les lignes
repartent de zéro, l'appareil les prend toutes, relit une fois depuis la nouvelle borne
(une ligne récrite pendant la lecture complète est au-dessus de sa borne), puis retire
ce que ni l'une ni l'autre n'a rendu, sauf une ligne qui a une opération dans l'outbox.
Une page suivante peut aussi dire `reset` quand une purge a effacé entre-temps une
marque de la plage : la lecture repart de zéro.

Une ligne arrivée avec `deletedAt` quitte l'appareil (pas de tombstone local), avec,
pour un colis, ses événements et sa lecture (`extraction`) ; une ligne qui a une
opération `queued` reste, son push portera la version de l'appareil.

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

## Apprentissage partagé (§4.8, YSL-60)

Ce qu'apprennent les corrections de l'agent circule comme le reste, par l'outbox, avant
les colis qui en découlent :

| Table             | Clé lue                                 | Écrite par                                                                  | Effet à la lecture suivante                                                |
| ----------------- | --------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `sender_account`  | (transporteur, compte)                  | expéditeur sûr à Terminer ; correction de l'agent (revue, fiche)            | prérempli 0,90, 0,95 après 3 confirmations ; `challenger_id`, `challenges` |
| `sender_alias`    | `alias_norm` (texte du bloc `FROM`)     | expéditeur gardé ou corrigé par l'agent quand le texte lu diffère du nom    | 0,30, +0,20 par confirmation, plafond 0,90                                 |
| `recipient_alias` | `name_norm` (nom imprimé, sans accents) | fiche choisie par l'agent pour le nom du code 2D ou de l'OCR (revue, fiche) | fiche en tête et présélectionnée, 0,30 à 0,89, jamais réglée en silence    |

Pas d'index unique sur les alias : deux iPhone qui apprennent le même nom hors ligne
gardent chacun leur ligne, la lecture prend la plus confirmée (`bestAlias`) ; le
prochain apprentissage de ce nom fond les lignes dans la plus confirmée (confirmations
additionnées quand elles s'accordent) et supprime les autres, pour qu'une correction
tienne sur tous les appareils. Dernier
écrit gagne sur `confirmations`, comme ailleurs (§8.4.4). `recipient_alias` pointe une
personne **ou** un contact (`recipient_alias_target_check`), par les clés composites
`(organization_id, …)` de 0002 ; un contact choisi compte comme utilisé (`usage_count`,
`last_used_at`) à Terminer.

## Purge selon les durées de conservation

Durées du §9.2 (validées, D7) dans `RETENTION` de `@repo/contract/retention`.

**Serveur** (`packages/api/src/features/maintenance/purge.ts`), par organisation, en
deux temps et par lots de 500 en transactions courtes :

1. **Marquage** `deleted_at` (que le pull propage) : colis `remis` depuis 12 mois
   (`delivered_at`) ou `retourne` depuis 12 mois (`updated_at`) ; remises et
   notifications dont tous les colis sont marqués ; codes de retrait utilisés ou
   expirés depuis 12 mois ; lots vides de plus de 12 mois ; contacts inutilisés depuis
   12 mois (`last_used_at`, à défaut `updated_at`) et personnes désactivées depuis 30 jours, sans colis,
   remise, notification ni code vivant ; alias appris (`sender_alias`, `recipient_alias`)
   dont l'expéditeur, la personne ou le contact n'est plus vivant : ils suivent la durée
   de leur parent.
2. **Suppression physique** des lignes marquées depuis plus de 30 jours, enfants
   avant parents (remises, notifications, codes, colis avec leurs `event` sous
   `set_config('app.purge', 'on', true)` local à la transaction, lots, comptes
   transporteurs, alias d'expéditeur, expéditeurs, modèles, réglages, alias de
   destinataire, contacts, personnes), une ligne
   encore référencée attendant la purge suivante ; `sync_op` au-delà de 90 jours.

Chaque passage écrit une ligne `purge_run` (compteurs par table, `horizon_xid` = le
plus grand `server_xid` supprimé + 1, relevé dans la transaction de chaque lot). Un appareil dont le curseur est sous l'horizon
de son organisation a pu manquer un marquage : son pull repart à zéro (`reset`).
Job planifié dans `apps/server` (`PURGE_INTERVAL_MINUTES`, 1440 par défaut, 0 le
coupe ; premier passage une minute après le démarrage), une instance à la fois par
`pg_try_advisory_lock` ; `maintenance.purgeNow` (admin) purge son organisation à la
demande, `maintenance.status` rend le dernier passage.

**E-mails du serveur** (`email_outbox`) : `runPurge`, hors purge d'une seule
organisation, efface les lignes envoyées, abandonnées ou jamais parties après 30 jours.
Cette durée ne fait pas partie du §9.2 : elle reste à valider par le DPO. Job d'envoi
dans `apps/server` (`MAIL_POLL_SECONDS`, 30 par défaut, 0 le coupe), éteint sans
`BREVO_API_KEY` ou `MAIL_FROM_ADDRESS`.

**Envoi par le serveur** (YSL-115, ME04) : `sync.pull` dit `serverMail` (clé Brevo, jeton du webhook,
adresse d'expédition, job actif). Sans ce oui, l'iPhone n'écrit aucune demande et le job ne tourne
pas : la messagerie du téléphone reste le seul parcours, sans tirage ni file. Avec lui, la
validation d'un lot écrit une `notification` `channel = 'server'`, `prepared`, par destinataire
ayant une adresse ; elle voyage par la synchro, donc tient hors ligne. Un iPhone d'avant
n'écrit jamais `server`, et une fois écrite, une copie d'appareil ne change plus la ligne
(`sync.push` répond 200 sans écrire). Le job relit colis, adresse et département, tire le
code (un par personne et par département, l'ancien retiré), rend le modèle et met en file,
dans une transaction. À l'envoi : `sent`, colis `notifie`, événement, dans la transaction de
la file. Pendant 15 minutes l'iPhone considère ces colis partis ; passé ce délai ils lui
reviennent en repli. Avant d'envoyer, le serveur revérifie : des colis déjà notifiés par le
téléphone annulent le mail. Un échec passe la ligne en `failed`, rétablit l'ancien code et
laisse les colis à notifier. Une demande de plus de 3 jours n'est plus envoyée, préparée ou en file (compte refusé) : l'ancien code revient. Le corps,
qui porte le code, est effacé dès la fin de l'envoi ou de l'échec ; restent l'adresse et le
statut, 30 jours. Si Brevo refuse l'expéditeur d'une entreprise (400, 401, 402, 403), le mail
repart de l'adresse de la plateforme ; un second refus décide seul (compte refusé : file
bloquée). `Répondre à` : le plus ancien compte du département du colis, sinon l'agent qui a
validé. Une désinscription ou une plainte s'inscrit dans `email_suppression`, sans
expiration ni levée pour l'instant (à valider par le DPO) : plus aucun mail du serveur à cette adresse, la ligne passe en `failed` et le
colis reste à prévenir par un autre moyen.

**Relances par le serveur** : profil `reminders = required` (`automatic`) : le job demande
J+2 et J+5 (D12), du lundi au vendredi de 8 h à 18 h à Paris, pour les colis dont l'avis est
parti par le serveur ; les colis avisés par le téléphone restent aux relances du téléphone.
Un mail en cours, un échec depuis le dernier envoi ou un rebond retiennent la relance : elle
part une fois. `optional` (`manual`) : « Relancer » écrit une demande. `disabled` : rien.
Chaque relance du serveur tire un nouveau code et retire l'ancien, dont le QR répond
« remplacé » ; « même code » ne vaut que pour le repli.

**Statuts réels** (`POST /api/webhooks/mail`, YSL-113) : Brevo ne signe pas ses
événements, il renvoie le jeton donné à la création du webhook
(`Authorization: Bearer`, `BREVO_WEBHOOK_TOKEN`, 32 caractères au moins ; sans lui la
route répond 404). `delivered` donne délivré ; `hard_bounce`, `invalid_email` et
`blocked` un rebond ; `spam` une plainte ; `unsubscribed` une désinscription ; le
reste, dont `soft_bounce`, n'écrit rien. Le statut s'écrit sur `email_outbox` et, par
`notification_id`, sur `notification`, d'où la synchro le ramène ; les appareils ne
peuvent pas l'écrire. Il ne fait qu'avancer (délivré, désinscription, plainte, rebond),
donc un rejeu n'écrit rien. L'adresse et le motif de Brevo ne sont ni gardés ni
journalisés. Brevo abandonne un événement sur tout 5xx et tout 4xx sauf 429 : une panne
de notre côté, ou un message inconnu de moins de 5 minutes, répond 429 (reprises à
10 min, 1 h, 2 h, 8 h).

**Expéditeur par entreprise** (`mail_sender`, YSL-114, non synchronisée) : l'admin règle
un nom et une adresse (`mailSender.save`), le domaine est déclaré chez Brevo, ses
enregistrements DNS s'affichent, « Vérifier maintenant » (`mailSender.check`) lit
`authenticated`. L'expéditeur se lit à l'envoi : domaine vérifié, l'adresse de
l'entreprise ; sinon `MAIL_FROM_ADDRESS` au nom de l'entreprise. Toutes les entreprises
partagent un compte Brevo, où `authenticated` ne dit pas à qui est le domaine : un
domaine n'appartient qu'à une entreprise, et un domaine déjà authentifié chez Brevo sans
propriétaire ici est refusé, comme celui de la plateforme. Changer de domaine retire
l'ancien chez Brevo, s'il a été déclaré ou prouvé par cette entreprise. Sans `BREVO_API_KEY` ou `MAIL_FROM_ADDRESS`, l'expéditeur s'enregistre et la vérification
reste indisponible ; le domaine se déclare à la première vérification après la pose de
la clé.

Mise en service : poser `BREVO_WEBHOOK_TOKEN` sur l'API,
puis `POST https://api.brevo.com/v3/webhooks` avec `type: "transactional"`, l'URL de la
route, `events: ["delivered", "hardBounce", "invalid", "blocked", "spam", "unsubscribed"]`
et `auth: { type: "bearer", token }`.

**iPhone** (`apps/web/src/features/retention`), à l'ouverture puis après une
synchronisation (au plus tous les quarts d'heure), au repos du fil principal :
photos d'étiquette et de dommage 7 jours après la sortie du colis (remise ou retour)
une fois sa ligne confirmée par le serveur, signatures après 12 mois, photos d'un
colis disparu de l'iPhone, `extraction` après 30 jours ou sans son colis ; preuves de
remise (`handover_proof`, YSL-75) : signature 12 mois après la prise, photo 7 jours
après la remise une fois la remise confirmée par le serveur, preuve sans remise après
une heure. Le balayage des orphelines au lancement connaît aussi leurs fichiers.
Réglages › Données et confidentialité (admin) montre les durées, le dernier passage,
« Purger maintenant » et « Effacer les données de cet iPhone » (synchro, puis
déconnexion et vidage de Dexie et d'OPFS ; les changements non envoyés sont comptés
et ne se perdent qu'après confirmation). L'effacement demande le réseau : la session
est fermée sur le serveur d'abord, sinon le cookie ramènerait tout au lancement
suivant.

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
  retour » (`changeParcelStatus`). « Annuler la remise » passe par la feuille de motif
  et `cancelHandover`, comme depuis la confirmation et le journal.
- **Remise** (`recordHandover`) : en un seul commit, la `handover` (méthode de la voie :
  `qr`, `pin`, ou `manuel` pour un nom choisi sans preuve), chaque colis coché `remis`
  (`delivered_at`, `delivered_by`, `status_seq` + 1), un `parcel.delivered` par colis
  et, si plus aucun colis de la personne n'attend, son code de retrait `used_at` ; le
  QR ou le code est revérifié sur l'appareil juste avant.
- **Suppression** : logique (`deleted_at`), avec son événement ; le colis quitte les
  listes de tous les appareils, son historique reste.
- **Événements** (`@repo/contract/parcel-event`) : `event.entity = 'parcel'`,
  `type` `parcel.edited` (`detail.fields`, les champs changés), `parcel.status`
  (`detail.from`, `detail.to`), `parcel.deleted` ou `parcel.delivered`
  (`detail.handoverId`, `detail.method` : `qr`, `pin`, `signature`, `manuel`),
  `parcel.handover_cancelled` (`detail.handoverId`, `detail.reason`, `detail.note`),
  `actor_id` = l'agent. La
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
- **Limites connues** : la réserve suit la règle de la ligne entière (dernier écrit gagne,
  §8.4.4, comme les autres champs) : un iPhone qui n'a pas encore reçu la réserve et
  modifie le colis renvoie sa copie sans réserve, et la réserve disparaît de la ligne
  sans événement de levée ; seul le statut a un compteur (`status_seq`). L'auteur est
  enregistré (`actor_id`) mais l'historique de la fiche n'affiche que la date. Les
  photos d'une réserve levée restent dans OPFS, sans être montrées.

## Réponses des salariés (YSL-70)

L'app ne lit pas les e-mails (D2) : le salarié répond dans la boîte de l'agent (liens
`{lien_pas_moi}` et `{lien_collegue}` du modèle, `mailto:` à objet seul « Ce n'est pas pour
moi - 7112 »), et l'agent reporte la réponse (« Le salarié a répondu », fiche colis ou
« E-mails envoyés »).

- **Ligne** : colonnes de `parcel` (migration `0011_reponses_salaries`) : `reply`
  (`not_mine`, `colleague`, `absent`) et `replied_at` (ensemble, `parcel_reply_check`),
  `expected_delegate` (nom du collègue, proposé par la remise en YSL-77),
  `reminders_paused_until` (dernier jour d'absence, début de journée sur l'iPhone).
- **Événement** `parcel.reply` (`detail.reply`, et `previous` / `delegate` / `until`
  `YYYY-MM-DD`), dans le même commit que la ligne (`features/replies/record.ts`).
- **« Pas pour moi »** : deux ops du colis dans l'ordre, `notifie → recu` puis
  `recu → a_completer` (`status_seq` + 1 chacune, le garde-fou n'accepte qu'un pas), avec
  leurs `parcel.status` ; destinataire, service et adresse saisie retirés, nom lu gardé ;
  les `recipient_alias` d'un nom imprimé vers l'ancienne fiche supprimés. Choisir un
  destinataire efface la réponse (`saveParcelEdit`).
- **Collègue, absence** : écrits sur tous les colis `notifie` du même destinataire. Pendant
  l'absence, `reminderState` (`@repo/contract/reminders`) ne rend rien de dû ni « en
  souffrance » ; au jour ouvré suivant, la relance redevient due et la souffrance attend
  deux jours ouvrés de plus.
- **Idempotence** : la même réponse redonnée n'écrit rien ; un colis non notifié n'est pas
  concerné.

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
- **`sync_op`** grandit d'une ligne par opération : la purge le vide au-delà de
  90 jours (`RETENTION.syncOp`), index `sync_op_applied_at_idx`.
- **Index `*_cursor_idx`** : `REINDEX CONCURRENTLY` périodique (pages coupées par les
  insertions de plusieurs organisations).
