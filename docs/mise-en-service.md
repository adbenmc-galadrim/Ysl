# Mise en service du pilote

Ce qu'il reste à faire pour que l'app remplace la v1 à la loge : envoi des e-mails par le
serveur, historique de la v1 repris, v1 archivée puis retirée. Chaque section dit qui la
fait et comment vérifier qu'elle a pris. Les secrets ne s'écrivent jamais dans ce dépôt, qui est
public : ils se posent dans Coolify ou se tapent dans un terminal.

## État au 4 novembre 2026

| Sujet | État |
| --- | --- |
| App et API | En production, même commit, santé et base au vert |
| Modèle multi-entreprises | Conversion jouée le 31/10 (`docs/conversion-multi-entreprises.md`), recette jouée et validée |
| Comptes | Une entreprise, deux départements, un admin entreprise, deux navettes, un admin de l'app |
| E-mails | Messagerie du téléphone seulement : `BREVO_API_KEY` posée vide, `BREVO_WEBHOOK_TOKEN` absente, `MAIL_FROM_ADDRESS` posée |
| Expéditeur de l'entreprise | Aucun domaine déclaré |
| Historique de la v1 | Pas encore importé |
| v1 | Dépôt public en ligne, non archivé, site GitHub Pages actif |
| Sauvegarde d'avant conversion | Sur le serveur, à garder jusqu'au retrait des anciennes colonnes |

Les commandes `pnpm ops:*` se lancent depuis un poste, à la racine d'un clone de ce dépôt
après `pnpm install` (Node 22). Le contrôle se rejoue à tout moment, en lecture seule :

```bash
pnpm ops:check --api https://ysl-api.shinseo.fr --web https://ysl.shinseo.fr
```

Il rend une ligne par contrôle (`✓`, `!` à surveiller, `✗` en échec) et sort en erreur si un
contrôle échoue. La ligne « Envoi par le serveur » se lit de dehors : la route du webhook
répond 404 tant que `BREVO_WEBHOOK_TOKEN` n'est pas posée, 401 ensuite. Avec
`BREVO_API_KEY` exportée dans le terminal, il contrôle aussi le compte Brevo, le webhook et
les domaines ; `--domain <domaine>` vise le domaine de l'entreprise pilote.

## 1. Avant de commencer

Par le propriétaire du projet.

- Décider de l'entreprise pilote et de son domaine d'envoi (D28). Aujourd'hui une seule
  entreprise existe, mais la clé Brevo vaut pour toutes : chaque entreprise ouverte ensuite
  enverra par le même compte.
- Prévenir les navettes : dès que la clé est posée, le premier lot validé sur un iPhone à
  jour envoie de vrais e-mails aux salariés, sans geste de leur part.
- Vérifier que chaque iPhone de la loge a la dernière version de l'app : un iPhone
  d'avant continue par la messagerie du téléphone et peut doubler un envoi pendant la
  minute de synchronisation (`docs/synchronisation.md`).
- Garder une boîte de test à soi pour les premiers envois.

## 2. Activer l'envoi par le serveur (Brevo)

Par le propriétaire du projet, avec l'accès à Brevo et à Coolify. Brevo est le fournisseur
du MVP (D2 révisée), hébergé dans l'UE. Le webhook se déclare **avant** de poser les
variables : une fois l'API redéployée, le premier lot validé envoie de vrais e-mails, et
leurs rebonds doivent déjà remonter.

1. Sur le compte Brevo : créer une clé d'API (SMTP & API › Clés API). Vérifier que
   l'adresse de `MAIL_FROM_ADDRESS` est un expéditeur validé du compte.
2. Générer le jeton du webhook, 32 caractères au moins, et le garder pour les étapes 3 et 4
   (gestionnaire de mots de passe), jamais dans un fichier du dépôt :

   ```bash
   openssl rand -hex 32
   ```

3. Déclarer le webhook chez Brevo, depuis un terminal où la clé et le jeton sont exportés
   (`read -s` les lit sans les afficher) :

   ```bash
   read -s BREVO_API_KEY && export BREVO_API_KEY
   read -s BREVO_WEBHOOK_TOKEN && export BREVO_WEBHOOK_TOKEN
   pnpm ops:brevo-webhook --api https://ysl-api.shinseo.fr --dry-run
   pnpm ops:brevo-webhook --api https://ysl-api.shinseo.fr
   ```

   Le script ne crée le webhook que s'il manque, avec les événements que l'API lit
   (`delivered`, `hardBounce`, `invalid`, `blocked`, `spam`, `unsubscribed`) et le jeton en
   `Authorization: Bearer`. Un webhook déjà présent sans tous ces événements est signalé,
   jamais doublé. Si Brevo refuse la création tant que la route répond 404, faire les
   étapes 4 et 5 puis revenir ici, sans valider aucun lot entre-temps.
4. Dans Coolify, ressource API : remplir `BREVO_API_KEY` (aujourd'hui vide) et ajouter
   `BREVO_WEBHOOK_TOKEN`, la même valeur qu'à l'étape 3. Les deux ensemble, avec
   `MAIL_FROM_ADDRESS` déjà posée : sans les trois, l'iPhone ne passe pas à l'envoi
   serveur. Une clé sans jeton active les invitations par e-mail et la vérification du
   domaine, pas les avis aux salariés.
5. Redéployer l'API (Coolify › Redeploy, ou relancer `deploy.yml` sur `prod` avec
   `force=true`). Les variables ne sont lues qu'au démarrage.
6. Contrôler : `pnpm ops:check …` doit dire « BREVO_WEBHOOK_TOKEN posée », « clé
   acceptée » et le numéro du webhook.
7. Premier envoi vers la boîte de test, depuis le conteneur de l'API :

   ```bash
   docker exec -w /app/apps/server <conteneur-api> ./node_modules/.bin/tsx src/scripts/mail-send-test.ts --to <adresse>
   ```

   puis la recette §9 de `docs/recette.md`, de I1 à I6, sur des salariés de test.

Les noms de champs de l'API Brevo (`webhooks`, `domains`, `authenticated`) viennent de sa
documentation : s'ils diffèrent sur le compte réel, le contrôle le dira en échec, et c'est
le script qu'il faut corriger.

## 3. Domaine d'envoi de l'entreprise pilote

Par l'admin entreprise, avec la DSI de l'entreprise pour les DNS.

Sans domaine vérifié, les e-mails partent de `MAIL_FROM_ADDRESS` au nom de l'entreprise.
Avec lui, ils partent de l'adresse de l'entreprise (D28).

1. L'admin entreprise ouvre Réglages › Identité et e-mails, section « Expéditeur des
   e-mails », et saisit le nom et l'adresse d'envoi.
2. « Vérifier maintenant » déclare le domaine chez Brevo et affiche les enregistrements DNS
   à poser (code Brevo, DKIM, DMARC).
3. La DSI de l'entreprise les pose sur son domaine.
4. « Vérifier maintenant » à nouveau, jusqu'à « <domaine> vérifié le … ». Contrôle :
   `pnpm ops:check … --domain <domaine>` doit dire « authentifié ».
5. Recette §9 : I7 (enregistrements conformes à l'écran), puis I9 sur un domaine de test
   (code exact du refus de Brevo quand le DNS disparaît).

**Avant d'ouvrir une deuxième entreprise** : jouer I8. Un domaine retiré dont les DNS sont
restés en place peut-il être redéclaré par une autre entreprise et passer vérifié sans
preuve ? Si oui, c'est bloquant : le compte Brevo est partagé et ne sait pas à qui est un
domaine.

## 4. Reprendre l'historique de la v1

Par une navette (export) et l'admin entreprise (import).

La v1 garde ses colis dans le Safari de l'iPhone de la loge, nulle part ailleurs. Les
reprendre avant de retirer la v1, sinon ils sont perdus.

1. Sur l'iPhone de la loge, dans la v1 : Historique › « Exporter l'historique ». Enregistrer
   le CSV dans Fichiers (ou se l'envoyer). Garder ce fichier hors de ce dépôt : il contient
   des noms et des adresses.
2. Dans l'app, avec le compte admin entreprise : Réglages › Importer l'historique v1,
   choisir le fichier.
3. Lire le rapport : colis importés, ignorés, trackings signalés. Un rejeu n'ajoute rien.
4. Vérifier dans Colis quelques colis connus, et la ligne « Importé de la v1 » dans leur
   historique.

## 5. Bascule à la loge

Par les navettes, l'admin entreprise suit.

1. Les navettes travaillent dans l'app seule à partir d'une date annoncée ; la v1 n'est plus
   utilisée pour un nouveau colis.
2. Une semaine d'usage, puis `pnpm ops:check …` et les compteurs du tableau de bord de
   l'admin entreprise.
3. Les points à voir sur un vrai iPhone sont ceux de la recette, §10 de `docs/recette.md`.

## 6. Archiver puis retirer la v1 (D16)

**À confirmer avant tout geste.** « Archiver et purger » est la réponse provisoire de D16 ;
une autre réponse du client note de laisser le dépôt de la v1 tel quel. La question est
posée au propriétaire du projet : rien ne se supprime tant qu'elle n'est pas tranchée.

Seul le propriétaire du dépôt de la v1 peut le faire.

1. Après la reprise de l'historique (étape 4) : archiver, réversible.

   ```bash
   gh repo archive <propriétaire>/<dépôt-v1> --yes
   ```

   Le dépôt passe en lecture seule. Ouvrir ensuite le site de la v1 pour voir s'il répond
   encore.

2. Après la bascule (étape 5) : supprimer, **irréversible**. Le site GitHub Pages disparaît
   avec le dépôt.

   ```bash
   gh auth refresh -h github.com -s delete_repo
   gh repo delete <propriétaire>/<dépôt-v1> --yes
   ```

3. Sur l'iPhone de la loge : supprimer l'icône de la v1 de l'écran d'accueil, puis Réglages
   › Safari › Avancé › Données des sites web, et effacer celles de la v1.

## 7. Retour arrière

Par le propriétaire du projet.

| Ce qui ne va pas | Geste |
| --- | --- |
| E-mails en erreur, file bloquée | Vider `BREVO_API_KEY` dans Coolify et redéployer l'API : les iPhone repassent à la messagerie du téléphone, les colis en attente leur reviennent |
| Webhook en échec | Retirer `BREVO_WEBHOOK_TOKEN` et redéployer : l'envoi serveur s'arrête aussi (il exige les rebonds) |
| Import v1 faux | Les colis importés se reconnaissent à la ligne « Importé de la v1 » de leur historique ; les reprendre avant la bascule, la v1 restant en place tant qu'elle n'est pas supprimée |
| Base abîmée | Sauvegarde d'avant conversion sur le serveur (`docs/conversion-multi-entreprises.md`) ; la garder jusqu'au retrait des anciennes colonnes |

Rien dans cette procédure ne touche à la base ni aux migrations.
