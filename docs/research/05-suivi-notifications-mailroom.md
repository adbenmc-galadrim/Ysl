# 05 - Suivi transporteur, notifications, annuaire, preuve de remise, mailroom

Projet : Courrier YSL v2 (PWA hors ligne, service courrier, Saint Laurent Paris).
Date de la recherche : 21 octobre 2026. Volume cible : 20 à 100 colis/jour.

## Légende de fiabilité

- **[V]** Vérifié : lu sur une page officielle ou sur une page éditeur citée, au moment de la recherche.
- **[S]** Source secondaire : blog, comparatif concurrent, annuaire d'API, forum. Plausible, à confirmer avant de s'engager.
- **[NV]** Non vérifié : connaissance générale ou déduction, aucune source trouvée. À tester.

Limite de la recherche : l'outil de recherche ne renvoie que des résumés. Plusieurs pages officielles (La Poste Okapi, UPS, DPD, GLS, Chronopost) n'ont pas pu être lues en détail (portails derrière JavaScript ou connexion). Les tarifs de concurrents cités par un concurrent (Ship24 sur 17TRACK, Track123 sur AfterShip) sont marqués [S].

---

## 1. Suivi transporteur

### 1.1 Ce que le tracking apporte réellement à un service courrier

Un numéro de suivi permet, selon le transporteur :
- confirmer le **transporteur** (le préfixe/format du numéro le laisse déjà deviner, les agrégateurs font de l'auto-détection) ;
- obtenir le **statut** (en transit, livré) et la date de livraison estimée ;
- parfois l'**expéditeur**, le **poids**, le **nombre de colis** d'un envoi multi-pièces, la **signature** de remise ;
- **anticiper** les colis attendus, si l'on s'abonne à un numéro avant son arrivée.

Point structurant : les API publiques de suivi sont conçues pour l'expéditeur ou le destinataire final, pas pour un tiers qui réceptionne. Le nom de l'expéditeur, le nombre de pièces et le poids sont **rarement** exposés par le suivi public (champ souvent absent ou masqué pour la vie privée). Il faut donc tester sur des numéros réels avant de promettre l'enrichissement "expéditeur" dans le produit. [NV, hypothèse forte, à valider par un test sur 20 vrais colis]

### 1.2 API officielles des transporteurs

| Transporteur | Accès / inscription | Gratuité / quota | Données | Statut |
|---|---|---|---|---|
| **UPS** | Portail developer.ups.com, création d'une application, produit Tracking, OAuth 2.0 (jetons à durée limitée). Les guides divergent : compte personnel suffisant ou compte professionnel requis. | API gratuite d'après un guide d'avril 2026 ; tarifs standard seulement pour la création d'envois. | Statut et événements. Le schéma exact (expéditeur, poids, nb colis, signature) n'a pas été lu. "Track Alert" : abonnement push (jusqu'à 100 numéros, callback 14 jours), décrit comme premium et réservé aux États-Unis par une source tierce. | [S] sauf mention |
| **FedEx** | developer.fedex.com, API "Basic Integrated Visibility" (ex-Track API). Suivi par numéro de suivi ou de référence, jusqu'à 30 colis par requête. | Limite d'usage 100 000 appels/jour [S]. Tarification non trouvée. | Signature (SPOD) pour Express et Ground jusqu'à 16 mois, mais **le numéro de compte de facturation de l'expéditeur est requis dans la requête**, sinon la preuve est renvoyée sans image de signature : inutilisable pour un destinataire. Livraisons "Authenticated Delivery" non couvertes. Version avancée avec webhooks. | [V] sur la doc FedEx (résumé de recherche) |
| **TNT** | Réseau intégré à FedEx ; je n'ai rien trouvé sur une API TNT France distincte. | - | - | [NV] : suivi à passer par l'API FedEx ou un agrégateur |
| **DHL Express / Parcel** | developer.dhl.com, "Shipment Tracking - Unified API", clé API, base `https://api-eu.dhl.com/track/shipments`. | Nouvelle clé : **250 appels/jour**, 1 appel toutes les 5 s (la page allemande dit 1/s). Réservé au développement ; une hausse se demande dans "My Apps > Request Upgrade". Code 429 au dépassement. | Statut, événements ; schéma détaillé non lu. | [V] pour les limites |
| **La Poste / Colissimo / Chronopost (Okapi "Suivi v2")** | developer.laposte.fr, compte gratuit puis clé `X-Okapi-Key`, appel du type `api.laposte.fr/suivi/v2/idships/{numéro}`. Couvre courrier suivi, Colissimo et Chronopost. | Une fiche mentionne un plan gratuit avec plafond par seconde ; aucune source ne parle d'un contrat requis pour Suivi v2 (le contrat est requis pour l'API Affranchissement, autre produit). Quotas exacts non confirmés. | Statut harmonisé, événements, date de livraison prévue. Le service SOAP Colissimo "WebServiceTrackingTL v2.1" donne en plus l'historique complet, mais est un autre service. | [S] (la page officielle n'a pas pu être lue) |
| **Chronopost** | Couvert par Suivi v2 ci-dessus. Webservice SOAP propre existant pour les clients contractuels. | - | - | [NV] pour le webservice propre |
| **DPD France** | Documentation DPD (v1.2.1, mars 2023) : API réservée aux **clients contractuels DPD**, endpoint `/status/tracking`, 30 colis par requête. | - | - | [S] : un service courrier destinataire n'a pas de contrat DPD |
| **GLS** | Portail développeur GLS (version néerlandaise vue) : Track & Trace API et webhook, `POST /api/parcel/v1/details` avec identifiants de compte. | - | - | [S] : compte client expéditeur nécessaire, à confirmer pour la France |

**Conclusion sur les API directes** : 7 à 8 transporteurs, autant d'inscriptions, d'OAuth/clés, de schémas et de conditions contractuelles différents. Pour un destinataire qui ne paie pas l'expédition, plusieurs exigent un compte expéditeur (FedEx pour la signature, DPD, GLS). Seuls La Poste (Okapi), DHL (clé gratuite à 250/j, à faire monter) et UPS semblent ouverts à un tiers. C'est lourd à maintenir pour 20 à 100 colis/jour.

### 1.3 Agrégateurs

| Service | Modèle de prix | Couverture / données | RGPD | Statut |
|---|---|---|---|---|
| **17TRACK API** | Quotas prépayés **annuels**, sans report : 5 000 pour 119 USD, 25 000 pour 569 USD, 150 000 pour 2 869 USD (chiffres relevés sur des pages Ship24 et Track123, concurrents, datés mai 2026). Pas de quota gratuit côté API ; l'app Shopify a 50 envois/mois gratuits, hors sujet. Essai gratuit sans carte. | 3 500+ transporteurs, 190+ compagnies aériennes, auto-détection du transporteur pour plus de 80 % des numéros, 9 statuts + 30 sous-statuts, événements horodatés avec lieu, webhook (POST JSON, retries), enregistrement via `/track/v2/register`. | La page 17TRACK affirme la conformité RGPD, ISO 27001, ISO 27701, SOC 2. | [V] fonctionnalités et RGPD (page éditeur) ; prix [S] |
| **Ship24** | Mensuel. API par envoi : 10 gratuits/mois ; 1 000 pour 39 USD ; 5 000 pour 99 USD ; 25 000 pour 349 USD (dépassement 0,045 à 0,025 USD). API par appel : 100 gratuits/mois ; 10 000 appels pour 99 USD. Un tracker = un crédit, quelle que soit la durée de vie du colis. Options Pro : preuve de livraison, date prédictive IA. | Multi-transporteurs, auto-détection. | Termes DPA non lus. | [V] grille tarifaire (help.ship24.com) ; RGPD [NV] |
| **AfterShip** | Pas de grille API officielle trouvée. Indications : Pro 119 USD/mois pour 2 000 envois (0,08 USD l'envoi supplémentaire) sur Shopify ; comparatifs concurrents : 359 USD/mois pour 3 000. | 1 100+ transporteurs annoncés (mémoire) [NV]. | Non vérifié | [S] |
| **TrackingMore** | Gratuit limité, Premium à partir de 11 USD/mois pour 200 envois, Entreprise sur devis. | 1 500+ transporteurs annoncés (Capterra). | Non vérifié | [S] |
| **Parcel Monitor** | Aucune information trouvée. | - | - | [NV] |

### 1.4 Coût estimé pour 20 à 100 colis/jour

Hypothèse : 22 jours ouvrés, un tracker par colis.

| Volume | Colis/mois | Ship24 (par envoi) | 17TRACK (annuel) | Direct (La Poste, DHL) |
|---|---|---|---|---|
| 20/jour | ~440 | 39 USD/mois (1 000 crédits), soit ~470 USD/an | 5 000 crédits à 119 USD/an couvrent ~11 mois de 440/mois | 0 EUR mais développement par transporteur |
| 100/jour | ~2 200 | 99 USD/mois (5 000 crédits), soit ~1 190 USD/an | 25 000 crédits, 569 USD/an (~26 500 colis/an : juste) | idem |

Dans tous les cas l'ordre de grandeur est **quelques centaines d'euros par an**, négligeable face au temps de développement et de maintenance de 8 intégrations. [calcul sur prix [V]/[S]]

### 1.5 Intérêt concret et recommandation

1. **Enrichir un colis à partir du seul tracking** : l'agrégateur donne de façon fiable le **transporteur** (auto-détection) et le **statut**. L'expéditeur, le poids et le nombre de pièces ne sont pas garantis (voir 1.1). Ne pas bâtir l'UX sur ces champs ; les traiter comme "bonus si présent".
2. **Anticiper les colis attendus** : fonctionnalité réaliste seulement si le salarié ou l'agent saisit le numéro à l'avance (formulaire "j'attends un colis", ou transfert de l'e-mail de confirmation d'achat). Un salarié peut aussi recevoir l'e-mail transporteur "votre colis arrive demain" : un parseur de ces e-mails est une alternative sans API [NV].
3. **Choix** : un agrégateur (Ship24 ou 17TRACK) derrière une interface interne `TrackingProvider` (une méthode `lookup(trackingNumber)`), avec en repli l'API La Poste Okapi gratuite pour Colissimo/Chronopost. Ne pas intégrer UPS/FedEx/DHL/DPD/GLS en direct en v2.
4. Le tracking est un **enrichissement optionnel** : le scan de bordereau et la saisie manuelle doivent rester fonctionnels hors ligne et sans API.
5. Côté RGPD : le numéro de suivi n'est pas en soi une donnée personnelle, mais la réponse peut contenir nom et adresse du destinataire. Choisir un agrégateur avec DPA et hébergement UE ou clauses contractuelles types, et ne pas envoyer d'autres données que le numéro. [NV pour Ship24, V pour 17TRACK en déclaratif]

---

## 2. Notification des destinataires

### 2.1 Comparatif

| Option | Principe | Avantages | Limites | Statut |
|---|---|---|---|---|
| **mailto:** (v1) | L'app ouvre le client mail du téléphone avec un brouillon. | Aucun serveur. | Un mail à la fois, l'agent doit appuyer sur Envoyer ; expéditeur = compte configuré dans Mail (d'où le compte Gmail perso utilisé par erreur) ; aucune trace d'envoi, aucun retry ; corps limité : aucun plafond officiel, repère pratique sous ~2 000 caractères d'URL, troncature possible entre 2 000 et 4 000 ; Apple Developer Forums (iOS 14.6) : `%0D%0A` affiché en `<BR>` dans Mail, comportement à retester sur l'iOS actuel ; pas d'HTML, pas d'image, pas de QR code ; inutilisable pour l'envoi différé ou la relance. | [S] |
| **Microsoft Graph `sendMail`** | Le backend envoie via `POST /users/{boîte}/sendMail`. | Expéditeur "Service Courrier" propre, mail dans Éléments envoyés de la boîte, HTML, pièces jointes, pas de mot de passe (OAuth), pas de SMTP. | Nécessite un tenant Entra ID, un enregistrement d'application et un **consentement administrateur** (DSI). | [V] |
| **SMTP relais Microsoft 365** | SMTP AUTH client submission ou connecteur Exchange. | Compatible avec toute librairie (nodemailer). | **SMTP AUTH Basic** : calendrier repoussé en janvier 2026 ; comportement inchangé jusqu'à fin décembre 2026, puis désactivé par défaut pour les tenants existants (réactivable), date de suppression annoncée en 2027. Ne pas bâtir sur Basic ; OAuth uniquement. | [S] (MC786329) |
| **Transactionnel** (Brevo, Resend, Postmark, Scaleway TEM) | API HTTP d'envoi, domaine vérifié (SPF/DKIM/DMARC). | Aucun accès à Microsoft 365 requis ; livrabilité, logs, webhooks de statut (délivré, rebond). | Expéditeur = domaine à configurer par la DSI (DNS). Les mails peuvent aller en spam sans DKIM correct. | voir 2.3 |
| **Teams** | Message dans un canal ou chat. | Immédiat. | Voir 2.4. | [V] |
| **SMS** | Passerelle (Brevo, OVH, etc.). | Atteint tout le monde. | Coût, consentement, données personnelles (numéro de mobile absent d'Entra en général) ; prévoir pour les cas d'urgence seulement. | [NV] |

### 2.2 Microsoft Graph depuis une boîte partagée "Service Courrier"

- Permission `Mail.Send` : délégué et application, sans permission de rang supérieur. `sendMail` renvoie **202 Accepted**, la livraison reste soumise aux limites et à la limitation d'Exchange Online. Le message est enregistré dans Éléments envoyés (désactivable avec `saveToSentItems:false`). Adressage : `POST /users/{id | userPrincipalName}/sendMail`. [V] https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- **Application (`Mail.Send` application)** : sans restriction, l'application peut envoyer **au nom de n'importe quelle boîte** du tenant. À restreindre impérativement à la seule boîte "Service Courrier" avec **RBAC for Applications** (Exchange Online, remplace les Application Access Policies ; depuis décembre 2022) ou à défaut une Application Access Policy. Les changements de droits peuvent prendre environ une heure (cache). [S] https://office365itpros.com/2026/02/17/mail-send-rbac-for-applications/amp/
- **Déléguée** : `Mail.Send` délégué, ou `Mail.Send.Shared` pour une boîte partagée ; nécessite qu'un humain se connecte (jeton de rafraîchissement), donc fragile pour un job de fond (expiration, MFA, départ de l'agent). [S]
- Une boîte partagée n'a pas de licence ni de connexion interactive : le flux **application + RBAC** est le bon modèle pour un backend. [NV sur le détail de configuration, à valider avec la DSI]
- Consentement administrateur : nécessaire pour toute permission application ; c'est le point qui oppose "MVP sans DSI" et "cible avec DSI".

### 2.3 Services transactionnels

| Service | Offre gratuite | Premier palier payant | Remarques | Statut |
|---|---|---|---|---|
| **Scaleway TEM** (France) | 300 mails/mois | 0,25 EUR / 1 000 mails (pay as you go), facturé par destinataire ; palier Scale ~80 EUR/mois pour 100 000 | Hébergement UE, quota par défaut 10 000/mois, message max 2 Mo via l'API | [V] pages Scaleway |
| **Brevo** (France) | 300 mails/jour (~9 000/mois) | Starter ~9 USD/mois pour 5 000 | Éditeur français, RGPD natif | [S] |
| **Resend** | 3 000/mois, 100/jour, 1 domaine | Pro 20 USD pour 50 000 | Bonne DX TypeScript ; hébergement hors UE à vérifier | [S] |
| **Postmark** | 100 mails/mois | ~15 USD pour 10 000 | Réputation de livrabilité | [S] |

À 20 à 100 notifications/jour (600 à 3 000 par mois), **Scaleway TEM ou Brevo gratuit/quasi gratuit** suffisent. Le coût est négligeable, le critère de choix est l'hébergement UE et la possibilité de faire envoyer depuis le domaine de l'entreprise (SPF/DKIM : demande DNS à la DSI).

### 2.4 Microsoft Teams

- Les connecteurs Office 365 (webhooks entrants historiques) ont été **retirés de Teams entre le 18 et le 22 mai 2026**. Le remplaçant est le webhook **Workflows (Power Automate)**. Les payloads Adaptive Card sont recommandés ; les cartes interactives ne fonctionnent pas avec MessageCard. Les Adaptive Cards publient avec l'identité "Workflows" par défaut (icône et nom personnalisés non supportés). Canaux privés supportés. [V/S] https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/ ; https://mc.merill.net/message/MC1181996
- Un webhook Workflows poste dans un **canal**, pas dans un message privé à un salarié. Pour écrire à une personne : **bot Teams** (Azure Bot Service, enregistrement d'application, installation de l'app chez les utilisateurs, `Graph chatMessage` avec droits à consentir). Lourd, dépend de la DSI. [NV sur le détail]
- Conclusion : Teams = **canal d'appoint v2.1** (ex. canal "Courrier" qui reçoit un résumé du jour), pas le canal principal.

### 2.5 Notification push de la PWA

Web Push existe pour les PWA iOS depuis iOS 16.4, uniquement si la PWA est **installée sur l'écran d'accueil** et si l'utilisateur accepte la permission ; fiabilité jugée inférieure à Android ; statut dans l'UE à vérifier. [S] https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide. Pour des salariés qui n'ont pas installé la PWA, l'e-mail reste le canal fiable. Le push peut venir plus tard, côté agent seulement (rappels).

### 2.6 Envoi différé et file d'attente hors ligne

Architecture recommandée (**outbox**) :
1. L'app enregistre localement (IndexedDB) le colis **et** une ligne `notification` avec un `id` UUID client (idempotence), statut `pending`.
2. Dès que le réseau revient : synchronisation vers le backend (Background Sync API n'est pas disponible sur Safari iOS, donc prévoir un déclenchement à l'ouverture de l'app et à l'événement `online`). [NV sur la couverture Safari actuelle, à tester]
3. Le backend écrit en base Postgres puis un worker (pg-boss, BullMQ ou simple table + `SELECT ... FOR UPDATE SKIP LOCKED`) envoie, avec retries exponentiels et dédoublonnage par `id`.
4. Statuts remontés à l'app : `queued`, `sent`, `delivered`, `bounced`, `failed`. L'agent voit les échecs au lieu de supposer l'envoi (corrige le défaut principal de mailto).
5. Envoi différé : champ `send_at` (ex. regrouper les notifications en un mail par destinataire à 11h et 15h). Relances : tâche planifiée qui renotifie à J+2, J+5, puis alerte l'agent (voir 4.2).

---

## 3. Annuaire des salariés

| Critère | Microsoft Entra ID / Graph | Import CSV |
|---|---|---|
| Données | `GET /users` : `displayName`, `mail`, `department`, `jobTitle`, `officeLocation`, `accountEnabled` | Ce que le RH exporte |
| Permission | `User.Read.All` (moindre privilège, délégué et application) ; consentement administrateur [V] | Aucune |
| Synchronisation | `GET /users/delta` pour les changements ; les paramètres de requête doivent être posés sur l'appel initial ; l'usage de `$filter` sur `department` avec delta n'est pas confirmé, à tester [V pour delta, NV pour le filtre] | Manuelle (arrivées/départs non suivis) |
| Départs | `accountEnabled=false` ou suppression détectée par delta : on ne notifie plus | À gérer à la main |
| Sources | https://learn.microsoft.com/en-us/graph/api/user-delta | |
| Dépendance DSI | Forte (enregistrement d'application, consentement admin) | Aucune |

**Recommandation** : en MVP, **import CSV** (colonnes `nom, prénom, email, service, site`) avec dédoublonnage par e-mail et recherche floue locale (hors ligne) ; en cible, **synchro Graph delta** nocturne dans une table `directory_user` avec `source` ('csv' | 'entra') pour permettre la cohabitation.

**RGPD** (à valider avec le DPO ; référentiel CNIL RH mis à jour le 29/01/2026 : https://www.cnil.fr/sites/default/files/2026-04/referentiel_durees_de_conservation_gestion_des_ressources_humaines.pdf) :
- ne synchroniser que les champs utiles (nom, e-mail, service, site) ; pas de téléphone, pas de manager si inutile (minimisation) ;
- base légale vraisemblable : intérêt légitime de l'employeur (gestion de la réception du courrier) ; l'inscrire au registre des traitements (art. 30) et informer les salariés ;
- l'annuaire est un **cache** : le supprimer des appareils au départ du salarié, chiffrer le stockage local de l'app ;
- l'import CSV hors ligne sur un smartphone augmente la surface de fuite (appareil perdu) : chiffrer et limiter la durée de conservation.
La CNIL a sanctionné Amazon France Logistique de 32 M EUR en 2024 pour surveillance excessive : la minimisation n'est pas théorique. [S]

---

## 4. Preuve de remise et marché du mailroom

### 4.1 Options de preuve

| Mécanisme | Force probante | Coût UX | Hors ligne | RGPD / remarque |
|---|---|---|---|---|
| **Signature tactile** sur l'écran de l'agent | Moyenne (le salarié signe sur l'appareil de l'agent) | Faible, 5 s | Oui (canvas, stockée en local puis synchronisée) | Donnée personnelle (signature) : durée limitée, accès restreint |
| **Photo** (colis remis, pièce) | Faible à moyenne | Faible | Oui | Une photo du salarié ou de son badge est probablement **excessive** si la signature suffit ; photographier le colis ou le bordereau seulement |
| **QR code de retrait** envoyé dans l'e-mail, scanné par l'agent | Bonne : lie un destinataire authentifié (propriétaire de la boîte mail) à un colis ; l'agent scanne, la remise est tracée sans saisie | Très faible pour l'agent, faible pour le salarié (montrer son téléphone) | **Oui si le QR contient un jeton signé vérifiable localement** (HMAC/JWT court) ou si la liste des jetons est synchronisée à l'avance | Pas de donnée biométrique ; jeton à usage unique, expiration |
| **Code PIN** (4 à 6 chiffres dans l'e-mail) | Bonne, équivalente au QR | Le salarié lit le code, l'agent le tape | Oui (comparaison avec hash local) | Risque de transfert du mail à un tiers, comme le QR |
| **Combinaison** : QR ou PIN, signature en secours | Meilleure | - | - | Recommandé |

Remarque : le QR/PIN prouve que **quelqu'un qui a accès à la boîte mail** s'est présenté. Pour une preuve juridique forte, ajouter la signature ; pour un service courrier interne, QR + horodatage + identité de l'agent suffit en pratique. [NV : avis de l'auteur, à valider avec les RH et le DPO]

Conservation : ne pas garder la signature ou la photo plus longtemps que le besoin de preuve en litige ; le délai de prescription civile de droit commun est de 5 ans (art. 2224 Code civil), mais c'est un plafond, pas un objectif ; viser **3 à 12 mois** pour les images de signature, plus longtemps pour la ligne de journal (qui, quand, quel colis). [NV, à fixer avec le DPO]

### 4.2 Fonctionnalités des logiciels de mailroom

| Éditeur | Fonctionnalités relevées | Statut |
|---|---|---|
| **Envoy Deliveries** | Lecture du nom du destinataire par **photo de l'étiquette** et rapprochement avec l'annuaire ; notification e-mail, Slack, Microsoft Teams, push ; **relances répétées** à intervalle choisi jusqu'au retrait, avec option "snooze" d'une semaine ; **signature ou photo** exigées au retrait, retrait sur kiosque iPad ou depuis la notification ; redirection vers l'assistant d'un salarié. | [V] pages Envoy (résumé) : https://envoy.com/products/deliveries/features , https://help.envoy.com/about-delivery-notifications/ |
| **SendSuite Tracking / PitneyTrack Inbound (Pitney Bowes)** | Scan au lecteur code-barres du colis entrant (transporteur, numéro, date) ; e-mail "colis en attente" ; **étiquette code-barres interne** pour le rangement ; **emplacements** (bâtiment, étage, bureau) ; signature, photo, scan de pièce d'identité en preuve de remise ; chaîne de custodie "de l'arrivée au retrait confirmé" ; palier supérieur : multi-sites, impression d'étiquettes, photo, journal d'audit ; iOS et Android. Pas de mention de lettres recommandées dans les résultats. | [V/S] https://www.pitneybowes.com/us/shipping-and-mailing/case-studies/college-package-tracking-sendsuite.html , https://www.pitneybowes.com/content/dam/pitneybowes/australia/en/pdf/ssto-cut-sheet.pdf (fiches anciennes) |
| **Quadient Parcel Pending** | Surtout **casiers** : alerte SMS, e-mail ou app, ouverture par **code d'accès ou code-barres sur téléphone**, journal automatique des dépôts et retraits, logiciel de suivi temps réel. | [V] marketing : https://www.parcelpending.com |
| **Parcel Tracker (Mailroom)** | Notifications SMS/e-mail automatiques, impression et scan d'étiquettes/codes-barres. | [S] Capterra |
| **Greetly** | Rappels programmés de retrait. | [S] https://greetly.com/digital-mailroom-package-log |
| **Receivd** | Aucun résultat trouvé. | [NV] |
| **Mailroom by Ricoh** | Non recherché en détail, aucun résultat exploitable. | [NV] |

### 4.3 Fonctionnalités à retenir pour Courrier YSL (inspirées du marché)

Priorité 1 (v2 cœur) :
- photo de l'étiquette avec lecture/OCR du nom puis rapprochement annuaire, déjà dans l'esprit v1 ;
- notification e-mail avec lien/QR/PIN ; **statut visible** (envoyé, délivré, rebond) ;
- **remise par scan du QR** ou saisie du PIN, signature en secours ; horodatage et agent ;
- **emplacement de stockage** (étagère A3, casier) et **étiquette interne** imprimable (nom, service, code-barres, emplacement) ;
- **relances automatiques** (J+2, J+5), puis alerte à l'agent pour les colis en souffrance.

Priorité 2 :
- liste "colis en attente" par service, rapports (délai moyen de retrait, colis en souffrance, volume par transporteur, par jour) ;
- **lettres recommandées** : champ spécifique (numéro AR/RAR, pas d'API de suivi tiers, preuve de remise renforcée : signature obligatoire) ;
- **destinataire délégué** (assistante, collègue) comme Envoy ;
- snooze et horaires de passage.

Priorité 3 / cible :
- **multi-sites** (Paris et autres), casiers connectés (hors périmètre), kiosque en libre-service, intégration Teams.

---

## 5. Recommandation d'architecture v2

### 5.1 Principes

1. **Offline-first** : la PWA enregistre toujours localement (IndexedDB) ; tout appel réseau (tracking, mail) est asynchrone et rejouable.
2. **Outbox + worker** côté backend : une file Postgres unique (`notifications`, `tracking_lookups`), des workers idempotents.
3. **Interfaces de fournisseurs** : `Mailer` (Graph, Scaleway TEM, SMTP), `TrackingProvider` (agrégateur, La Poste), `Directory` (CSV, Entra). Le changement de MVP à cible est une substitution de fournisseur, pas une réécriture.
4. **Minimisation** : on stocke le moins possible (voir RGPD en 3 et 4).

### 5.2 Schéma commun

```
PWA (IndexedDB, file locale)
   | sync (HTTPS, jeton d'agent)
   v
API Node/TypeScript ---- Postgres (colis, destinataires, notifications, preuves, journal)
   |                          ^
   +--> worker notifications --> Mailer (MVP : Scaleway TEM / Brevo ; cible : Graph sendMail)
   +--> worker tracking ------> TrackingProvider (Ship24 ou 17TRACK, + Okapi La Poste)
   +--> job annuaire ---------> Directory (MVP : CSV ; cible : Graph users/delta)
```

### 5.3 MVP sans DSI

Contraintes : aucun accès à Entra ID, aucune modification DNS ou Exchange.

| Domaine | Choix |
|---|---|
| E-mail | **Service transactionnel UE** (Scaleway TEM ou Brevo gratuit), expéditeur sur un domaine que l'on contrôle (`courrier@<domaine du projet>`), avec SPF/DKIM propres. Limite : les salariés voient un expéditeur externe, risque de spam/filtrage par le filtre mail de l'entreprise ; à signaler au salarié lors du lancement, et à tester sur 5 boîtes Saint Laurent avant. |
| Alternative e-mail | `mailto:` conservé **en repli manuel** si le réseau est coupé (un seul mail, corps court), jamais comme voie principale. Retirer l'usage du compte Gmail perso : le champ "De" doit être forcé côté serveur. |
| Annuaire | **Import CSV** fourni par les RH ou la DSI (un export suffit, sans accès direct). |
| Preuve | QR code ou PIN dans l'e-mail + signature tactile en secours. |
| Tracking | Agrégateur en gratuit (Ship24 : 10 envois/mois, puis 39 USD/mois ; 17TRACK : essai) **ou rien** : la v2 n'a pas besoin du tracking pour être utile. Activer seulement la détection locale du transporteur par format du numéro (regex), sans coût. |
| Teams / SMS | Non. |
| Coût | ~0 à 40 EUR/mois. |

### 5.4 Cible avec DSI (Entra ID)

| Domaine | Choix |
|---|---|
| E-mail | **Microsoft Graph `sendMail`** depuis la boîte partagée "Service Courrier", flux **application** avec `Mail.Send` **restreint par RBAC for Applications** à cette seule boîte ; consentement administrateur par la DSI. Les mails sortent du vrai domaine, restent dans Éléments envoyés, passent le filtrage interne. Prévoir un secret/certificat géré (certificat préférable au secret client) et un renouvellement planifié. |
| Authentification des agents | Connexion Entra ID (OIDC) pour la PWA ; rôles agent/administrateur. |
| Annuaire | **Graph `users` + `users/delta`**, permission `User.Read.All` (application), job nocturne, désactivation des départs ; CSV conservé en secours. |
| Teams | Webhook Workflows vers un canal "Courrier" (résumé quotidien, colis en souffrance) ; bot Teams uniquement si la DSI le souhaite. |
| Preuve | QR/PIN + signature ; journal d'audit ; export de rapports. |
| Tracking | Agrégateur payant (Ship24 5 000 crédits/mois à ~99 USD, ou 17TRACK 25 000 crédits/an à ~569 USD) + Okapi La Poste ; abonnement des numéros attendus saisis par les salariés. |
| Mailer de secours | Garder le transactionnel UE configuré en secours si Graph échoue (la couche `Mailer` le permet). |

### 5.5 Questions à poser à la DSI

1. Peut-on enregistrer une application Entra ID et obtenir un consentement administrateur pour `Mail.Send` (application) et `User.Read.All` ?
2. Peut-on créer une boîte partagée "Service Courrier" et appliquer RBAC for Applications ?
3. SMTP AUTH Basic est-il déjà désactivé sur le tenant (calendrier Microsoft : fin décembre 2026) ?
4. Peut-on ajouter SPF/DKIM pour un service tiers si on reste sur du transactionnel ?
5. Quelle politique de conservation pour les signatures et photos (DPO) ?

### 5.6 Tests à faire avant de figer

- 20 vrais colis du service courrier passés dans Ship24 et 17TRACK (essai gratuit) pour mesurer le taux de champs "expéditeur", "nombre de pièces", "poids" réellement renvoyés.
- Un mail de test avec QR code depuis Scaleway TEM vers 5 boîtes Saint Laurent (spam, rendu Outlook, rendu Mail iOS).
- Lecture d'un QR code depuis la PWA iOS hors ligne (API caméra, `BarcodeDetector` non disponible sur Safari iOS, prévoir une librairie JS comme jsQR ou zxing-wasm). [NV]
- Background Sync absent de Safari iOS : valider le rejeu de la file à l'ouverture de l'app. [NV]

---

## Sources principales

- Graph sendMail : https://learn.microsoft.com/en-us/graph/api/user-sendmail?view=graph-rest-1.0
- Graph users delta : https://learn.microsoft.com/en-us/graph/api/user-delta
- RBAC for Applications / Mail.Send : https://office365itpros.com/2026/02/17/mail-send-rbac-for-applications/amp/
- SMTP AUTH Basic (MC786329) : https://mc.merill.net/message/MC786329/compare/2026-01-27T20-11-01-253Z/2024-04-26T00-17-12-6Z
- Retrait connecteurs Teams : https://devblogs.microsoft.com/microsoft365dev/retirement-of-office-365-connectors-within-microsoft-teams/ et https://mc.merill.net/message/MC1181996
- DHL Tracking : https://developer.dhl.com/tracking
- FedEx Track : https://developer.fedex.com/api/en-us/catalog/track.html et https://developer.fedex.com/api/en-us/catalog/track/docs.html
- UPS : https://developer.ups.com (et guides tiers : https://www.miniloop.ai/guides/find-ups-api-credentials)
- La Poste Okapi : https://developer.laposte.fr/products/suivi/latest (page non lisible), https://github.com/debuss/lapostesuivi , Colissimo SOAP : https://www.colissimo.entreprise.laposte.fr/sites/default/files/2021-08/CDC_WebServiceTrackingTL-v2.1_FR.pdf
- DPD : https://www.dpd.com/wp-content/uploads/sites/235/2023/04/DPD-API-documentation-v1-2-1.pdf
- GLS (NL) : https://api-portal.gls.nl/
- 17TRACK : https://www.17track.net/en/api ; prix relevés via https://www.track123.com/blog/track123-vs-17track et https://www.ship24.com/fr/boutiques/suivi-colis-17track
- Ship24 : https://help.ship24.com/en/article/ship24-pricing-and-plans-explained-425d9d/
- AfterShip (indicatif) : https://apps.shopify.com/AfterShip ; TrackingMore : https://capterra.com/p/210336/Trackingmore/
- Scaleway TEM : https://www.scaleway.com/fr/transactional-email-tem/ et https://www.scaleway.com/en/docs/transactional-email/reference-content/tem-capabilities-and-limits/
- Comparatifs transactionnels : https://automationatlas.io/answers/resend-pricing-explained-2026/ , https://costbench.com/compare/postmark-vs-resend/ , https://www.courier.com/integrations/compare/brevo-vs-postmark
- mailto iOS : https://developer.apple.com/forums/thread/681023 ; https://www.courier.com/tools/mailto-link-generator
- PWA iOS push : https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- Envoy : https://envoy.com/products/deliveries/features et https://help.envoy.com/about-delivery-notifications/
- Pitney Bowes : https://www.pitneybowes.com/us/shipping-and-mailing/case-studies/college-package-tracking-sendsuite.html
- Parcel Pending : https://parcelpending.com
- Parcel Tracker : https://www.capterra.com/p/190220/Parcel-Tracker/
- CNIL : https://www.cnil.fr/sites/default/files/2026-04/referentiel_durees_de_conservation_gestion_des_ressources_humaines.pdf
