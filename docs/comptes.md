# Comptes de l'entreprise

L'admin entreprise gère ses comptes dans **Comptes** (`/reglages/comptes`). Les comptes de
plateforme n'y figurent jamais et `/api/auth/admin/*` reste en 404.

| Geste | Connexion | Téléphone du compte |
|---|---|---|
| Suspendre | refusée, toute requête répond 403 (seule la lecture de session reste ouverte, pour dire au téléphone qu'il est suspendu) | **données gardées**, écran « Compte suspendu », tout reprend à la réactivation |
| Révoquer | refusée, sessions supprimées | **photos et preuves effacées** à sa prochaine requête, y compris ce qui n'est pas envoyé |
| Renvoyer un lien | le compte choisit son mot de passe, l'ancien lien cesse de marcher | données gardées |
| Changer le mot de passe | mot de passe provisoire, à changer à la prochaine connexion | données gardées, sauf si « fermer ses sessions » est coché ; les téléphones déjà connectés ne sont pas bloqués |

Une session non utilisée pendant 30 jours expire : le téléphone suspendu qui reste fermé aussi
longtemps s'efface à sa réouverture après réactivation, comme tout autre téléphone.

Le dernier admin actif d'une entreprise ne peut être ni suspendu ni révoqué.

## Entreprise suspendue

La suspension par l'admin de l'app s'ajoute à celle du compte, avec les mêmes garanties : connexion
refusée, toute requête répond 403 (`/api/auth/*` compris, sauf la lecture de session et la connexion),
sessions gardées, téléphone intact, écran « Votre entreprise est suspendue ». Une session expirée
pendant cette suspension n'efface pas le téléphone, même resté fermé : le même compte se reconnecte
après la réactivation et retrouve ses données. Supprimer l'entreprise, ou révoquer le compte, l'efface.

Pendant la suspension d'un compte seul, une session expirée n'efface rien non plus ; après sa
réactivation, la règle ci-dessus s'applique.

## Invitation

Tout compte arrive par invitation : l'admin entreprise invite navettes, départements et autres
admins. Le compte n'a aucun mot de passe tant que le lien n'a pas servi : personne ne peut s'y
connecter. Le lien vaut 7 jours, sert une fois, et le suivant le remplace. Seule son empreinte
est en base ; il part directement par `Mailer`, sans passer par la file des e-mails, et le
jeton est après `#` : il n'apparaît dans aucun journal serveur.

Sans `BREVO_API_KEY` et `MAIL_FROM_ADDRESS`, ou si Brevo refuse, aucun e-mail ne part : l'écran
le dit et donne le lien à copier, une seule fois. Si l'e-mail est parti, l'admin peut quand
même demander un lien à copier.

Sur iPhone, le lien s'ouvre dans Safari, où le mot de passe se choisit ; la connexion se fait
ensuite dans l'app installée.

Le changement forcé ne concerne que les sessions ouvertes après qu'un admin a posé un mot de
passe provisoire. Aucune session déjà ouverte n'est bloquée ni fermée ; les comptes d'avant ce
changement n'ont aucune demande en cours.

## Admin de l'app

Le premier `platform_admin` se crée par `auth:create-user --role platform_admin` (voir
`README.md`) ; ce script ne crée aucun autre compte, et refuse d'en créer un second. Mot de
passe perdu : `auth:reset-password`.

Il voit des chiffres par entreprise : comptes, départements, colis reçus depuis le 1er du mois
(heure de Paris), date de la dernière activité (dernier événement ou dernier colis reçu). Ni
colis, ni annuaire, ni nom de salarié (D26).

Le journal garde 12 mois ses créations, renommages, suspensions, réactivations, suppressions
et invitations, avec le nom de l'entreprise à ce moment-là et le nom du compte de plateforme.
Il survit à la suppression de l'entreprise (table `platform_journal`, sans `organization_id`,
hors de la purge). Pas d'adresse, pas de nom de salarié, pas de texte libre : la suspension ne
demande pas de raison.

L'admin de l'app invite le premier admin d'une entreprise, ou un remplaçant s'il n'y a plus
d'admin actif (§3.7.9) : il saisit un nom et une adresse, et ne relit rien. Un admin révoqué
peut revenir à la même adresse : son ancien mot de passe est supprimé, seul le lien le fait
entrer. Un admin suspendu garde ses sessions : c'est une autre adresse qu'il faut inviter. Tant qu'un admin
actif existe, l'invitation est refusée : c'est à lui d'inviter, ou d'utiliser le script
ci-dessous s'il a perdu son mot de passe.

Mot de passe oublié : pas de demande en libre-service sur l'écran de connexion, l'admin de
l'entreprise renvoie un lien.

## Mot de passe perdu, sans admin disponible

Depuis le terminal du conteneur de l'API (l'image doit contenir ce script), le mot de passe
lu sur l'entrée standard, jamais dans la commande :

```bash
cd /app/packages/auth
stty -echo; IFS= read -r AUTH_USER_PASSWORD; stty echo; export AUTH_USER_PASSWORD
./node_modules/.bin/tsx src/scripts/reset-password.ts --email <e-mail>
unset AUTH_USER_PASSWORD
```

Le script garde les sessions ouvertes. `--close-sessions` les ferme : à réserver à un mot de
passe compromis, car il efface les téléphones du compte.
