# Comptes de l'entreprise

L'admin entreprise gère ses comptes dans **Comptes** (`/reglages/comptes`). Les comptes de
plateforme n'y figurent jamais et `/api/auth/admin/*` reste en 404.

| Geste | Connexion | Téléphone du compte |
|---|---|---|
| Suspendre | refusée, toute requête répond 403 (seule la lecture de session reste ouverte, pour dire au téléphone qu'il est suspendu) | **données gardées**, écran « Compte suspendu », tout reprend à la réactivation |
| Révoquer | refusée, sessions supprimées | **photos et preuves effacées** à sa prochaine requête, y compris ce qui n'est pas envoyé |
| Changer le mot de passe | nouveau mot de passe | données gardées, sauf si « fermer ses sessions » est coché |

Une session non utilisée pendant 30 jours expire : le téléphone suspendu qui reste fermé aussi
longtemps s'efface à sa réouverture après réactivation, comme tout autre téléphone.

Le dernier admin actif d'une entreprise ne peut être ni suspendu ni révoqué.

## Mot de passe perdu, sans admin disponible

Depuis le terminal du conteneur de l'API (l'image doit contenir ce script), le mot de passe
lu sur l'entrée standard, jamais dans la commande :

```bash
cd /app/packages/auth
read -rs AUTH_USER_PASSWORD && export AUTH_USER_PASSWORD
./node_modules/.bin/tsx src/scripts/reset-password.ts --email <e-mail>
unset AUTH_USER_PASSWORD
```

Le script garde les sessions ouvertes. `--close-sessions` les ferme : à réserver à un mot de
passe compromis, car il efface les téléphones du compte.
