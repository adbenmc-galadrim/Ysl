# Stockage local : Dexie, OPFS et outbox

Ticket YSL-22 (F45, lot L0). Tout ce que l'agent voit et saisit vit d'abord sur l'iPhone :
la base locale est la source de l'interface, le serveur n'arrive qu'à la synchronisation
(YSL-28). Décisions : D3 (Dexie + outbox, confirmée par le spike S4,
[`docs/spikes/S4-stockage-mises-a-jour.md`](../spikes/S4-stockage-mises-a-jour.md)) et
D8 (les photos ne quittent jamais l'iPhone).

## La base `courrier` (IndexedDB, Dexie)

Code : `apps/web/src/features/db/`.

- **Schéma versionné** (`schema.ts`, version 2) : une table par entité synchronisée du
  serveur (`SYNCED_ENTITIES` de `packages/db`), sous le même nom (`parcel`,
  `directory_person`, `event`, `setting`…), plus les tables propres à l'appareil :
  `outbox`, `photo`, `sync_state` (version 1), `draft_batch` et `draft_parcel` (version 2,
  le lot en cours, voir [`capture-rafale.md`](capture-rafale.md) ; `reading` vaut
  `pending`, `read`, `unreadable`, `failed`, ou `typed` pour un numéro saisi à la
  main). Un test vérifie que
  chaque entité du serveur a sa table : ajouter une entité dans `packages/db` oblige à
  l'ajouter ici, dans une nouvelle version Dexie.
- **Types** : dérivés en type seulement de `@repo/db/schema` (`typeof parcel.$inferSelect`),
  sans `organizationId` (un appareil sert un seul service courrier ; le serveur pose
  l'organisation au push) et avec `serverXid` optionnel (absent tant que la ligne n'est
  pas revenue par un pull). Le navigateur ne charge jamais le code de `packages/db` : une
  règle ESLint n'autorise que les imports de types.
- **Index** : ceux des requêtes connues. L'accueil lit `parcel` par
  `[status+receivedAt]` et par `deliveredAt` ; la recherche de doublons par
  `trackingNorm` ; l'annuaire par `nameNorm` et `email` ; le journal par
  `[entity+entityId]`.
- **Lecture réactive** : `useLiveQuery` (`dexie-react-hooks`). La liste Colis
  (`features/parcels/api/use-parcels.ts`) se relit à chaque écriture et une fois par
  minute, pour que « il y a 2 h » et « Remis aujourd'hui » restent vrais. Un colis
  notifié passe « en retard » 48 h après sa dernière notification (`lastNotifiedAt`,
  sinon `notifiedAt`), comme l'index `parcel_overdue_idx` du serveur ; la ligne d'état
  compte les jours depuis la première.

## Écrire : la ligne et son opération, ensemble

`commitLocal(db, { upserts, deletes })` (`commit.ts`) est le seul chemin d'écriture
métier. Dans **une transaction Dexie**, il pose `updatedAt`, écrit chaque ligne et ajoute
une opération dans `outbox` :

| Champ                   | Contenu                                                   |
| ----------------------- | --------------------------------------------------------- |
| `seq`                   | ordre d'écriture (clé auto-incrémentée), ordre d'envoi    |
| `opId`                  | UUID v7, clé d'idempotence côté serveur (`sync_op`)       |
| `entity`                | nom de la table serveur                                   |
| `entityId`              | identifiant de la ligne                                   |
| `type`                  | `upsert` ou `delete`                                      |
| `patch`                 | la ligne entière (`upsert`) ou `{ deletedAt }` (`delete`) |
| `clientTs`              | horodatage client, qui devient `updated_at` au push       |
| `attempts`, `lastError` | tenus par le push (YSL-28)                                |

Une suppression est logique (`deletedAt`), jamais physique : la purge en deux temps est
une règle serveur (YSL-55). Si une écriture du lot échoue, rien n'est écrit, rien n'est
mis en file.

## Les photos : OPFS, jamais le serveur (D8)

Code : `apps/web/src/features/photos/`.

- Le fichier vit dans le répertoire OPFS `photos/`, nommé par l'identifiant de la photo.
  L'écriture passe par un Web Worker et un `createSyncAccessHandle` (`truncate`, `write`,
  `flush`), la seule écriture OPFS dont le spike a vérifié la tenue sur iPhone.
- La table `photo` ne contient que la description : chemin, SHA-256, dimensions, octets,
  colis, nature (`etiquette`, `signature`). **Le blob n'est jamais dans IndexedDB** et
  aucune opération d'outbox n'est créée : la photo reste sur l'appareil.
- **Ordre d'écriture** (S4) : le fichier d'abord, la ligne ensuite. Une ligne sans fichier
  serait une perte ; un fichier sans ligne est une orpheline que le **balayage au
  lancement** (`sweepOrphanPhotos`) retire une fois vieille d'une heure, délai qui laisse
  à une photo en cours d'enregistrement le temps d'avoir sa ligne.
- La suppression retire la ligne puis le fichier, pour la même raison.
- Sans OPFS (navigation privée sur Safari), `savePhoto` rejette une
  `StorageUnavailableError` que l'écran de capture affichera.

## Stockage persistant

Au lancement (`boot.ts`), l'app demande `navigator.storage.persist()` sans attendre un
geste : Safari l'accorde d'emblée à une app installée (S4). Réglages › Données › **Hors
ligne** affiche l'espace occupé (`estimate().usage`) ou « Non persistant » si la demande a
été refusée.

## Ce qui attend d'autres tickets

- `sync.push` / `sync.pull`, le curseur dans `sync_state`, la pastille « Synchronisation »
  et le vidage de la file avant la déconnexion : YSL-28. L'horizon du premier pull
  (événements récents seulement, historique d'une fiche à la demande) s'y décide.
- La revue du lot avant sa promotion en colis : YSL-33. La vignette des photos : quand un
  écran l'affichera.
- L'export de secours et le diagnostic des lignes sans fichier : YSL-36.
