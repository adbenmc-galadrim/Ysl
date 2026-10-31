# Conversion de la prod vers le modèle multi-entreprises

Ticket YSL-118, ME09 (cahier v3, §3.7.2), D21, D22, D30, §3.7.9. La conversion est la
migration `packages/db/drizzle/0024_conversion_prod.sql` : `apps/server/docker-entrypoint.sh`
la joue au déploiement, avant le démarrage de l'API.

## Ce qu'elle fait

Pour chaque organisation, en ne remplissant que ce qui est vide :

| Élément | Résultat |
| --- | --- |
| Départements | « Service courrier », plus un par valeur du texte `department` (fiches, colis, contacts ayant un colis), casse et espaces ignorés |
| `department.pickup` | Copie du réglage `pickup` ; le réglage reste, les e-mails le lisent encore |
| Personne | Le département de son texte, sinon « Service courrier » ; si ce département a déjà son e-mail (unique par département, `0022`), elle reste sans département, ses colis vont à « Service courrier », et un admin tranche depuis l'annuaire (onglet « Sans département ») |
| Colis en attente d'une personne | Suit la personne (trigger `directory_person_moved`) |
| Autre colis (`remis`, `retourne`, supprimé, contact, sans destinataire) | Son texte, puis sa personne, puis le texte du contact, puis « Service courrier » |
| Code ouvert | Suit la personne ; celui d'un contact prend le département de son dernier colis en attente |
| Code utilisé ou supprimé | Inchangé (sans département) |
| Profil de fonctionnement | `SMALL_SITE_OPERATING_PROFILE` (`setting.operatingProfile`), sauf si l'entreprise en a déjà un |
| Rôles | `admin` → `company_admin` ; `agent` ou rôle nul → `shuttle` ; un rôle inconnu reste et n'atteint rien |

Le statut d'un colis ne change pas. Les sessions restent valables : le rôle est relu à
chaque requête. Les anciennes colonnes texte restent jusqu'à une migration ultérieure.
Sur une base vide, ou jouée deux fois, elle ne change rien.

État de la prod relevé le 31/10/2026 : 3 comptes, tous `admin`, aucun `agent`.

`0023_departement_archive.sql`, jouée juste avant, refuse qu'un colis ou une personne
rejoigne un département archivé.

## Après le déploiement

1. `/ready` répond 200, le SHA déployé est le bon, une synchro d'un compte converti passe.
2. **Remettre une navette en place.** Un `company_admin` ne remet pas (§2.1) et l'écran
   d'équipe n'existe pas encore (YSL-83) : tant qu'aucun compte `shuttle` n'existe, personne
   ne peut remettre un colis. La route `/remise` reste ouverte à l'admin jusqu'à YSL-119 : sa
   remise, faite hors ligne ou encore en file au déploiement, part en « Corriger » (403).

   **Ne pas se déconnecter de l'iPhone qui reçoit les colis** : la déconnexion efface sa base
   locale et ses fichiers, seule copie des photos d'étiquettes et des preuves de remise (D8).
   Passer plutôt son compte en navette, sans changer de session, puis créer l'admin à part :

   ```sql
   UPDATE "user" SET role = 'shuttle' WHERE email = '<e-mail de l''opérateur>';
   ```

   Tout nouveau compte arrive par invitation (`docs/comptes.md`).

   Un ancien `agent` devenu `shuttle` n'écrit plus l'annuaire (D15 révisée). Une navette n'a pas
   les réglages d'administration.

3. Un appareil déjà connecté garde son ancien rôle en cache jusqu'à sa prochaine lecture de
   session en ligne : hors ligne, un `admin` en cache se lit comme un rôle inconnu, sans
   réglages d'administration et sans libellé de rôle.

## Retour arrière

**Avant le push sur `prod`**, qui déploie : sauvegarde de la base (`pg_dump -Fc`), hors du dépôt.

### Aucune écriture à garder

Dans cet ordre : arrêter l'API, `pg_restore --clean --if-exists` de la sauvegarde, redéployer
le commit d'avant le merge (`git push --force-with-lease origin <sha>:prod`), contrôler `/ready`.

### Des écritures à garder depuis le déploiement

Les colonnes `department_id`, les départements et le profil restent : l'ancien code les
tolère (il les connaît depuis `0020`). `0022` n'est pas défaite : l'unicité de l'e-mail par
département et les demandes de déplacement appartiennent à l'ancien code aussi. Une personne
rattachée à la conversion a déjà fermé ses demandes ouvertes, qu'un retour ne rouvre pas. Seuls les rôles, les gardes de `0023` et le journal
des migrations reviennent.

1. Arrêter l'API.
2. Jouer :

   ```sql
   BEGIN;
   UPDATE "user" SET role = 'admin' WHERE role = 'company_admin';
   UPDATE "user" SET role = 'agent' WHERE role = 'shuttle';
   DROP TRIGGER "parcel_department_open" ON "parcel";
   DROP TRIGGER "directory_person_department_open" ON "directory_person";
   DROP FUNCTION "public"."parcel_department_open"();
   DROP FUNCTION "public"."directory_person_department_open"();
   DROP FUNCTION "public"."refuse_archived_department"(uuid);
   DELETE FROM drizzle.__drizzle_migrations
    WHERE created_at >= (SELECT min(created_at) FROM (
      SELECT created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 2
    ) AS last_two);
   COMMIT;
   ```

   Le `DELETE` retire les deux dernières lignes du journal : à ne jouer que si `0024` est
   bien la dernière migration appliquée. Il permet de rejouer la conversion plus tard.
   Tout compte `company_admin` ou `shuttle`, même antérieur à la conversion ou créé depuis,
   devient `admin` ou `agent` : un `admin` regagne les droits admin de Better Auth sur l'ancien code.
   Un opérateur passé en `shuttle` après la conversion revient donc `agent` : le remettre `admin` à la main s'il l'était.
   Le profil posé reste sans effet sur eux : seul un compte `shuttle` lit ce réglage pour remettre.
3. Redéployer le commit d'avant le merge (`git push --force-with-lease origin <sha>:prod`),
   puis contrôler `/ready` et une synchro.

Rejouer ensuite la conversion : redéployer le commit corrigé ; elle reprend les rôles et ne
remplit que ce qui manque.

## Répétition

Jouée le 31/10/2026 sur une copie de la prod restaurée dans une base temporaire, sans écriture
sur la prod. Comptes, identifiants, sessions, rattachements, colis (statut compris), personnes,
codes, événements et remises : empreintes identiques avant et après, hors `department_id`,
`role`, `updated_at` et `server_xid`. Seconde exécution sans effet. Retour arrière, puis nouvelle
conversion, joués aussi.

Rejouée après l'arrivée de `0022` sur une copie de la base locale (40 comptes, 868 colis, 339
personnes, sans dump de la prod : celle-ci n'a toujours aucun département), avec une personne dont
le département tenait déjà l'e-mail et une demande de déplacement ouverte : mêmes empreintes,
la personne reste sans département, la demande reste ouverte ; retour arrière, ancien code et
nouvelle conversion joués.
