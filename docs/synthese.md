# Courrier v3 : synthèse

30 octobre 2026 · Détails dans `docs/cahier-des-charges-v3.md`

## Le produit

Courrier suit les colis d'une entreprise, de leur réception à leur remise, pour plusieurs entreprises clientes. La chaîne : la **navette** scanne les colis reçus et les dépose aux départements ; le **département** confirme le nombre reçu et remet au salarié contre un QR ou un code ; le **salarié** reçoit un e-mail. Saint Laurent, pour qui la v1 a été écrite, est le premier client.

| Rôle | Ce qu'il fait | Ce qu'il voit |
| --- | --- | --- |
| Admin de l'app | Crée et suspend les entreprises, invite leur premier admin | Des chiffres, ni colis ni annuaire |
| Admin entreprise | Gère départements, comptes, annuaire, réglages, profil ; réaffecte les colis à régulariser | Toute son entreprise |
| Département (plusieurs comptes) | Confirme les dépôts, remet les colis, tient son annuaire | Ses colis, son annuaire |
| Navette | Réceptionne, fait sa tournée, dépose | Ses tournées, tout l'annuaire en lecture |

Un colis passe par **En route**, **Déposé**, puis Notifié et Remis ; un écart au dépôt le met **À régulariser**. Chaque entreprise a un **profil de fonctionnement** : chaque étape y est désactivée, facultative ou obligatoire, et une petite structure peut faire remettre les colis par la navette.

Tant que ces fonctionnalités ne sont pas livrées, l'app marche comme en v2 : un agent, un service, des e-mails depuis la messagerie du téléphone.

## Ce qu'on propose de mieux que la v1

1. **Scan en rafale.** Un geste par colis, caméra ouverte pendant tout le lot, analyse en arrière-plan. La navette n'attend plus 5 à 25 s par photo, et vérifie tout en fin de lot.
2. **Les codes-barres 2D sont exploités.** UPS, FedEx et DPD y encodent le tracking, le destinataire, le colis n/N et le poids. On les lit avant l'OCR.
3. **Chaque numéro est validé par la clé de contrôle de son transporteur.** Le faux tracking de la v1 (`7185713569`) aurait été rejeté. On ne remplit plus jamais un champ avec un « nombre quelconque ».
4. **L'expéditeur s'apprend.** Les codes contiennent un n° de compte expéditeur ; une fois l'expéditeur confirmé, il est prérempli automatiquement les fois suivantes. C'était le point faible de la v1 (2 bordereaux sur 6).
5. **Un OCR neuronal qui lit dans tous les sens** (famille PaddleOCR), sur le téléphone, y compris le texte vertical que la v1 ratait.
6. **Une confiance qui veut dire quelque chose.** Trois niveaux : sûr, à vérifier, vide avec suggestions. Fini l'orange partout. Et rien ne bloque le scan : un cas douteux est enregistré « À compléter ».
7. **Les e-mails partent du serveur, avec une trace.** Envoi automatique à la validation du lot, reprises en cas d'échec, statut visible. Brevo au MVP, depuis l'expéditeur de chaque entreprise ; la messagerie du téléphone reste en repli.
8. **Une remise prouvée.** QR ou PIN reçu par e-mail, scanné même hors ligne, signature en secours. Relances automatiques, colis « en souffrance » mis en évidence.
9. **Des données synchronisées et protégées.** iPhone et ordinateur partagent les mêmes données. Annuaire retiré du code public et tenu par l'admin et les départements, durées de conservation par entreprise et purge automatique.
10. **Une app fluide et accessible.** Hors ligne garanti (modèles en cache), affichage immédiat des écritures, skeletons seulement là où l'on attend vraiment le réseau, zoom autorisé, cibles de 44 px, design sobre en noir et blanc.

## Stack recommandée

C'est la stack d'Emis, allégée :
- **Web** : React 19, Vite 8, TanStack Router, Form et Query, Tailwind 4.
- **Serveur** : Hono, tRPC 11, Drizzle, PostgreSQL 17, Better Auth.
- **Lecture** : zxing-wasm pour les codes-barres, PaddleOCR via onnxruntime-web pour le texte, Tesseract v7 en plan B.

**Hors ligne : Dexie (IndexedDB) et une file d'envoi maison, plutôt que PowerSync.** PowerSync exige 3 conteneurs et une réplication Postgres, et son moteur SQLite n'a pas été vérifié en arrière-plan sur iOS. Pour le volume visé, c'est trop lourd.

E-mail : Brevo pour le MVP, derrière une interface qui permet de passer à Scaleway TEM ou à Microsoft Graph.

## Décisions

Le détail et le suivi sont au §12 du cahier des charges et dans `kibo-notes/pilotage/decisions.md`.

| # | Décision | Recommandation |
| --- | --- | --- |
| 1 | Hébergeur et domaine | UE, domaine de l'entreprise |
| 2 | E-mail du MVP | Révisée : le serveur envoie, Brevo au MVP, TEM ou Graph ensuite, messagerie du téléphone en repli |
| 3 | Base hors ligne | Dexie + file d'envoi |
| 4 | Corpus de 100 à 200 photos d'étiquettes réelles | Oui, tout de suite (accord DPO) |
| 5 | iPhone du service et version d'iOS | iOS 26 |
| 6 | Preuve de remise | QR ou code, signature et photo facultatives ; le profil peut en décider autrement |
| 7 | Durées de conservation | Validées, réglables par entreprise. Révisée : le serveur garde aussi les colis |
| 8 | Envoi des photos au serveur | Non : sur l'iPhone de la navette seulement |
| 9 | OCR dans le cloud | Non au MVP |
| 10 | Suivi transporteur | Pas au MVP, test sur 20 colis |
| 11 | MaxiCode : outil maison ou Dynamsoft | Maison d'abord |
| 12 | Regroupement des e-mails et relances | Un e-mail par personne ; relances à J+2 et J+5, à partir du dépôt |
| 13 | Lieu et horaires de retrait | Portés par chaque département |
| 14 | Usage du nom et du logo | Interface neutre ; nom et logo réglables par entreprise |
| 15 | Source de l'annuaire | Révisée : tenu par l'admin entreprise et les départements, CSV possible, puis Entra ID |
| 16 | Dépôt public v1 | Archiver et purger |
| 17 | Connexion des agents | E-mail + mot de passe, puis Entra ID |
| 18 | MDM | Non, installation manuelle |
| 19 | Chiffrement applicatif local | Non au MVP |
| 20 | Interlocuteur DSI pour la cible | Ouvrir la demande maintenant |
| 21 à 23 | Rôles et départements | Quatre rôles ; département à plusieurs comptes, ordinateur et mobile |
| 24, 25 | Dépôt | Confirmé au nombre ; écart « À régulariser » |
| 26, 27 | Plateforme et comptes | Admin de l'app : chiffres seulement ; comptes par invitation |
| 28, 29 | Réglages et facturation | Nom, logo, expéditeur et conservation par entreprise ; facturation hors périmètre |
| 30, 31 | Profil de fonctionnement | Trois états par étape, modifiable librement, effet immédiat annoncé |

## Prochaines étapes

1. Dessiner et mettre en stories les écrans multi-entreprises, retirer les apps de spike (F34).
2. Livrer dans l'ordre l'envoi serveur, les départements et les rôles, la plateforme, le profil, l'annuaire, la tournée et le dépôt, l'espace département et la vue d'ensemble (F35 à F42).
3. Recette par rôle sur un vrai lot et mise en production pilote (F28).
4. En parallèle, ouvrir la demande à la DSI pour Graph et Entra ID.
