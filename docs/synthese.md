# Courrier YSL v2 : synthèse

21 octobre 2026 · Détails dans `docs/cahier-des-charges-v2.md`

## Ce qu'on propose de mieux que la v1

1. **Scan en rafale.** Un geste par colis, caméra ouverte pendant tout le lot, analyse en arrière-plan. L'agent n'attend plus 5 à 25 s par photo, et vérifie tout en fin de lot.
2. **Les codes-barres 2D sont exploités.** UPS, FedEx et DPD y encodent le tracking, le destinataire, le colis n/N et le poids. On les lit avant l'OCR.
3. **Chaque numéro est validé par la clé de contrôle de son transporteur.** Le faux tracking de la v1 (`7185713569`) aurait été rejeté. On ne remplit plus jamais un champ avec un « nombre quelconque ».
4. **L'expéditeur s'apprend.** Les codes contiennent un n° de compte expéditeur ; une fois l'expéditeur confirmé par l'agent, il est prérempli automatiquement les fois suivantes. C'était le point faible de la v1 (2 bordereaux sur 6).
5. **Un OCR neuronal qui lit dans tous les sens** (famille PaddleOCR), sur le téléphone, y compris le texte vertical que la v1 ratait.
6. **Une confiance qui veut dire quelque chose.** Trois niveaux : sûr, à vérifier, vide avec suggestions. Fini l'orange partout. Et rien ne bloque l'agent : un cas douteux est enregistré « À compléter ».
7. **Les e-mails partent du serveur, avec une trace.** Envoi automatique à la validation du lot, reprises en cas d'échec, statut visible. Fini le `mailto:` envoyé depuis un compte personnel.
8. **Une remise prouvée.** QR ou PIN reçu par e-mail, scanné même hors ligne, signature en secours. Relances automatiques, colis « en souffrance » mis en évidence.
9. **Des données synchronisées et protégées.** iPhone et ordinateur partagent les mêmes données. Annuaire retiré du code public, durées de conservation et purge automatique.
10. **Une app fluide et accessible.** Hors ligne garanti (modèles en cache), affichage immédiat des écritures, skeletons seulement là où l'on attend vraiment le réseau, zoom autorisé, cibles de 44 px, design sobre en noir et blanc.

## Stack recommandée

C'est la stack d'Emis, allégée :
- **Web** : React 19, Vite 8, TanStack Router, Form et Query, Tailwind 4.
- **Serveur** : Hono, tRPC 11, Drizzle, PostgreSQL 17, Better Auth.
- **Lecture** : zxing-wasm pour les codes-barres, PaddleOCR via onnxruntime-web pour le texte, Tesseract v7 en plan B.

**Hors ligne : Dexie (IndexedDB) et une file d'envoi maison, plutôt que PowerSync.** PowerSync exige 3 conteneurs et une réplication Postgres, et son moteur SQLite n'a pas été vérifié en arrière-plan sur iOS. Pour 1 à quelques agents, c'est trop lourd.

E-mail : un service transactionnel hébergé en UE pour le MVP, Microsoft Graph quand la DSI aura donné son accord.

## Décisions à prendre

| # | Décision | Recommandation |
| --- | --- | --- |
| 1 | Hébergeur et domaine | UE, domaine de l'entreprise |
| 2 | E-mail du MVP | Scaleway TEM, testé sur 5 boîtes Saint Laurent ; Graph ensuite |
| 3 | Base hors ligne | Dexie + file d'envoi |
| 4 | Corpus de 100 à 200 photos d'étiquettes réelles | Oui, tout de suite (accord DPO) |
| 5 | iPhone du service et version d'iOS | iOS 26 |
| 6 | Preuve de remise | QR ou PIN, signature en secours (obligatoire pour les recommandés) |
| 7 | Durées de conservation | À valider par le DPO (propositions dans le CDC) |
| 8 | Envoi des photos au serveur | Oui, étiquette recadrée seulement, purge à 90 jours |
| 9 | OCR dans le cloud | Non au MVP |
| 10 | Suivi transporteur | Pas au MVP, test sur 20 colis |
| 11 | MaxiCode : outil maison ou Dynamsoft | Maison d'abord |
| 12 | Regroupement des e-mails et relances | Un e-mail par personne ; relances à J+2 et J+5 |
| 13 | Lieu et horaires de retrait | À fournir |
| 14 | Usage du nom et du logo | Demander l'accord |
| 15 | Source de l'annuaire | Export CSV RH/DSI, puis Entra ID |
| 16 | Dépôt public v1 | Archiver et purger |
| 17 | Connexion des agents | E-mail + mot de passe, puis Entra ID |
| 18 | MDM | À demander à la DSI |
| 19 | Chiffrement applicatif local | Non si l'iPhone est géré par MDM |
| 20 | Interlocuteur DSI pour la cible | Ouvrir la demande maintenant |

## Prochaines étapes

1. Obtenir les réponses 4, 5 et 13, puis photographier un premier lot de 100 étiquettes.
2. Lancer 5 tests de faisabilité sur l'iPhone, chacun avec un critère go/no-go : caméra en rafale, codes-barres, OCR, stockage et mises à jour, e-mail.
3. Construire le MVP sans dépendre de la DSI : fondations, réception, puis notification et remise, avant une mise en production pilote.
4. En parallèle, ouvrir la demande à la DSI pour Graph, Entra ID et le MDM.
