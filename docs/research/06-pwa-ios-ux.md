# 06 - PWA iOS 26 et UX pour "Courrier YSL"

Date de la recherche : 21 octobre 2026. Périmètre : contraintes techniques PWA iOS/iPadOS 26 (volet A), UX et direction visuelle (volet B).

Légende : **[V]** = vérifié sur une source primaire ou quasi primaire lue pendant cette recherche (WebKit, Apple, W3C, doc éditeur). **[S]** = source secondaire ou anecdotique (blog, forum, une seule source). **[NV]** = non vérifié, à tester sur un vrai iPhone avant d'en dépendre. Les limites de l'outil de recherche (résultats parfois anciens, pas d'accès à caniuse ni aux release notes iOS 26.x complètes) sont signalées dans la section "Non vérifié".

---

## A. Contraintes techniques PWA iOS / iPadOS 26

### A1. Stockage : quota, éviction, règle des 7 jours

| Point | Statut | Détail | Source |
|---|---|---|---|
| Règle des 7 jours ITP | **[V]** | ITP supprime les cookies JS et tout le stockage "script-writeable" (IndexedDB, localStorage, SessionStorage, caches et enregistrements de service worker) après 7 jours sans interaction utilisateur avec le site. | https://webkit.org/tracking-prevention/ |
| Exemption des PWA ajoutées à l'écran d'accueil | **[V]** | "The first-party domain of home screen web applications is exempt from ITP's 7-day cap on all script-writeable storage." Le stockage est aussi séparé de Safari. Conséquence : **l'app doit être installée sur l'écran d'accueil**, pas utilisée dans un onglet Safari. | https://webkit.org/tracking-prevention/ |
| Quotas (iOS 17+) | **[V]** | Une web app standalone a les mêmes quotas qu'une app navigateur : jusqu'à 60 % du disque par origine, 80 % au total. Ce sont des plafonds, pas des garanties : gérer `QuotaExceededError`. | https://webkit.org/blog/14403/updates-to-storage-policy/ |
| Autres causes d'éviction | **[V]** | Dépassement du quota global, pression de stockage système, inutilisation prolongée (ITP). Éviction par origine entière, ordre LRU, sauf origine avec page active ou en mode persistant. | https://webkit.org/blog/14403/updates-to-storage-policy/ |
| `navigator.storage.persist()` | **[V]** partiel | WebKit l'accorde "based on heuristics, such as whether the site is opened as a Home Screen Web App". Persistent storage listé depuis iOS 15.2, API d'estimation de quota depuis iOS 17. | https://webkit.org/blog/14403/updates-to-storage-policy/ ; https://firt.dev/notes/pwa-ios/ |
| Garantie réelle de `persist()` | **[S]** | Un utilisateur de forum dit qu'il faut le redemander à chaque ouverture et qu'aucune doc Apple ne dit s'il est plus fort qu'ITP. | https://developer.apple.com/forums/thread/710157 |

**Recommandations**
1. Installer l'app sur l'écran d'accueil est une condition fonctionnelle, pas un confort : afficher un écran d'onboarding "Ajouter à l'écran d'accueil" si `navigator.standalone` / `display-mode: standalone` est faux, et ne pas démarrer une saisie offline hors standalone.
2. Appeler `navigator.storage.persist()` au démarrage en standalone, puis lire `persisted()` et `estimate()` et afficher l'état dans un écran Réglages > Diagnostic. Ne pas supposer que ça garantit quoi que ce soit.
3. Traiter le stockage local comme un cache de la file de sync, pas comme la source de vérité unique : une saisie hors ligne non synchronisée est le seul vrai risque de perte. Afficher un compteur "N colis en attente de sync" et une alerte si > 0 depuis plus de 24 h. Prévoir un export de secours (fichier JSON via Web Share) des éléments non synchronisés.
4. Demander à l'IT si l'app peut être déployée via MDM comme "web clip" pour éviter les installations manuelles **[NV]** (non recherché).

### A2. IndexedDB vs OPFS vs SQLite wasm (PowerSync)

Faits vérifiés (article PowerSync + doc SDK web) :
- wa-sqlite propose plusieurs VFS. **IDBBatchAtomicVFS** (IndexedDB) : large compatibilité, nécessite Asyncify ou JSPI, une transaction à la fois, perf dégradée à partir de ~100 Mo. **OPFSCoopSyncVFS** : OPFS synchrone, multi-connexion avec verrou exclusif par transaction, pas de COOP/COEP requis, bonne perf > 1 Go. **AccessHandlePoolVFS** : une seule connexion. **OPFSWriteAheadVFS** (avril 2026) : Chrome uniquement (`readwrite-unsafe`), inutilisable sur Safari. **[V]** https://www.powersync.com/blog/sqlite-persistence-on-the-web
- Safari : OPFS sync access handles depuis 16.4, IDBBatchAtomicVFS depuis 15.4 ; `readwrite-unsafe` non supporté ; JSPI non supporté ; OPFS indisponible en navigation privée ; `RangeError: Maximum call stack size exceeded` observé avec IDBBatchAtomicVFS sur grosses requêtes (pas avec OPFSCoopSyncVFS). **[V]** même source.
- Un SharedWorker ne peut pas accéder aux sync access handles sur Chrome/Safari. **[V]** même source.
- PowerSync web : "Full multi-tab support relies on shared web workers, which are disabled by default on Android, iOS, and Safari". `enableMultiTabs` vaut `false` par défaut sur iOS/Safari. Pour Safari, la doc recommande **OPFSCoopSyncVFS** pour un multi-onglet stable. Les opérations DB tournent dans des web workers (`useWebWorker: false` désactive aussi le multi-onglet). **[V]** https://docs.powersync.com/client-sdks/reference/javascript-web
- Sur Capacitor, les access handles OPFSCoopSyncVFS peuvent être fermés quand l'app passe en arrière-plan (erreurs au retour). **[V]** (article PowerSync) ; pertinent par analogie pour une PWA iOS mise en arrière-plan, mais **[NV]** pour Safari standalone : à tester (verrouiller l'iPhone en plein milieu d'une transaction, revenir, vérifier).

**Lecture pour Courrier YSL**
- Une PWA standalone sur iPhone = un seul "onglet" : le multi-tab n'est quasi pas un sujet côté iPhone. Il l'est côté desktop si l'agent ouvre deux onglets. PowerSync gère le cas par défaut (un worker par onglet, un seul onglet synchronise).
- Choix pressenti : PowerSync Web + wa-sqlite avec **OPFSCoopSyncVFS** comme VFS principal, IDBBatchAtomicVFS en repli. Volumétrie du problème (quelques milliers de colis, annuaire de destinataires) très inférieure aux seuils de perf (100 Mo). L'avantage OPFS est donc la robustesse (pas de stack overflow), pas la vitesse.
- Alternative plus simple si l'offline se limite à "file d'attente d'envoi + cache de lecture" : Dexie/IndexedDB + file d'attente maison + TanStack Query persistée. Moins de dépendances wasm, mais il faut écrire la sync, la résolution de conflits et les migrations. À arbitrer avec le document backend de ce dossier de recherche.
- Les photos (blobs) ne vont pas dans SQLite : les stocker dans OPFS/IndexedDB (blobs) avec une table de métadonnées et un statut d'upload. **[V]** OPFS dispo depuis iOS 15.2, `WritableStream` de fichiers depuis iOS 26.0 (https://firt.dev/notes/pwa-ios/ et https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). Les blobs IndexedDB sur iOS ont une histoire de bugs **[NV]** : privilégier OPFS pour les photos.

### A3. Service worker, vite-plugin-pwa / Workbox, mise à jour

- `registerType: 'autoUpdate'` force `skipWaiting` et `clientsClaim` ; risque documenté de perte de données pour un utilisateur en train de remplir un formulaire. `prompt` est recommandé pour les apps avec formulaires. Passer d'autoUpdate à prompt plus tard est pénible. **[V]** https://vite-pwa-org.netlify.app/guide/auto-update.html
- Pour Courrier YSL : **`registerType: 'prompt'`** avec `useRegisterSW` (hook React du plugin). Afficher un bandeau "Nouvelle version disponible : Mettre à jour" non bloquant, proposé seulement quand il n'y a pas de lot en cours (voir B). Mise à jour forcée possible entre deux lots.
- **Piège iOS : l'app standalone n'est quasiment jamais déchargée** et peut continuer à exécuter l'ancien code. Plusieurs rapports (WebKit bug 199110, forums Ionic, TMS) décrivent des PWA iOS qui gardent d'anciens assets jusqu'à redémarrage de l'appareil ou réinstallation. **[S]** (rapports anciens iOS 12-13 et anecdotiques) https://bugs.webkit.org/show_bug.cgi?id=199110
- Contournements à implémenter (logique standard, **[NV]** sur iOS 26, à valider sur appareil) :
  - appeler `registration.update()` au démarrage, sur `visibilitychange` (retour au premier plan) et toutes les ~30-60 min si l'app reste ouverte ;
  - servir `sw.js` et `index.html` avec `Cache-Control: no-cache` côté serveur (le fichier SW ne doit jamais être mis en cache longuement) ;
  - exposer la version de build dans Réglages et dans un endpoint `/version.json` consulté en ligne ; si la version serveur est plus récente que la version locale, afficher le bandeau même si le SW ne l'a pas détectée ;
  - prévoir un "Forcer la mise à jour" (désinscrire le SW, vider les caches de l'app, recharger) qui ne touche jamais aux données utilisateur non synchronisées.
- Navigation Preload dispo depuis iOS 15.4, `updateViaCache` depuis iOS 15. **[V]** https://firt.dev/notes/pwa-ios/
- Stratégie de cache : précache de l'app shell (Workbox `generateSW` ou `injectManifest`), runtime caching `StaleWhileRevalidate` pour l'annuaire si lecture HTTP, **ne jamais** mettre en cache les mutations. Les mutations passent par la file locale (SQLite/outbox), pas par le SW.
- Depuis iOS 26, tout site ajouté à l'écran d'accueil s'ouvre en web app par défaut, et un manifeste n'est plus requis. **[V]** https://webkit.org/blog/17333/webkit-features-in-safari-26-0/ Fournir quand même manifeste + balises `apple-touch-icon` : l'`apple-touch-icon` l'emporte sur les icônes du manifeste, les icônes `maskable`/`monochrome` sont ignorées, l'icône SVG n'est prise que dans le manifeste (iOS 26). **[V]** https://firt.dev/notes/pwa-ios/ (page secondaire, mais détaillée).

### A4. Caméra (getUserMedia) en standalone

- `getUserMedia` fonctionne dans les web apps depuis iOS 13 ; `ImageCapture.grabFrame` ajouté dans Safari 26 ; contrôles caméra avancés non supportés. **[V]** https://firt.dev/notes/pwa-ios/ ; https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- **Permissions redemandées : oui, c'est un problème réel et ouvert.**
  - WebKit bug 215884 : réinvite à chaque changement de hash/route dans une web app (iOS 13). Réduit en iOS 14.5, mais la permission n'est pas conservée entre sessions. Rapports jusqu'à iOS 18.5 (juin 2025) : la web app redemande la caméra et le réglage Safari revient à "Ask". **[V]** https://bugs.webkit.org/show_bug.cgi?id=215884
  - Le 3 février 2026, un ingénieur WebKit précise que ce bug ne couvre que les resets liés à la navigation hash, et que la **permission persistante pour les web apps** est une demande séparée ; un nouveau bug (327237) a été ouvert le 12 octobre 2026. **[V]** même page. Donc au 21 octobre 2026 : **pas de garantie de permission persistante**, supposer une invite à chaque lancement.
  - Autres bugs : un second `getUserMedia` peut tuer le flux existant (bug 245962, iOS 16), flux mort après relance (bug 252465) corrigé dans un cas par redémarrage de l'appareil, panne spécifique à un modèle d'iPhone (bug 273938, iOS 17.4.1). **[S]** (résultats de recherche, statuts non relus) https://bugs.webkit.org/show_bug.cgi?id=245962 ; https://bugs.webkit.org/show_bug.cgi?id=252465 ; https://bugs.webkit.org/show_bug.cgi?id=273938
- **Contournements de conception**
  1. **Un seul `getUserMedia` par session d'écran**, le `MediaStream` vit dans un composant/contexte au-dessus du routeur, jamais recréé lors d'un changement d'écran. Les onglets du bas ne démontent pas la caméra : la vue Scan est masquée (CSS) plutôt que démontée, ou la caméra est stoppée proprement puis relancée par un geste utilisateur.
  2. Éviter les navigations qui changent `location.hash` pendant que la caméra tourne ; utiliser l'History API (routeur React avec `pushState`) plutôt que le hash router, ou un routeur en mémoire pendant le scan (la solution "abstract mode" est rapportée dans le fil du bug, **[S]**).
  3. Écran de démarrage de la caméra avec un gros bouton "Activer la caméra" (geste utilisateur) : c'est de toute façon requis pour lancer lecture/permission de façon fiable, et on explique que iOS va redemander l'autorisation.
  4. **Plan B toujours présent** : `<input type="file" accept="image/*" capture="environment">` ouvre l'app Appareil photo native, fonctionne sans permission getUserMedia, une photo par validation. Plus lent mais robuste. Et saisie manuelle du destinataire.
  5. Gérer `track.onended`, `visibilitychange` (reprendre le flux au retour au premier plan), erreurs `NotAllowedError` / `NotReadableError` avec un message clair et un bouton "Réessayer".
  6. Option : demander à l'IT de pousser le réglage Safari "caméra : autoriser" pour le domaine, via MDM **[NV]**.
- **Lecture de codes-barres** : `BarcodeDetector` natif est annoncé en Safari 17+ par la doc d'un package tiers, contredit par un blog plus ancien. **[S/NV]** https://pub.dev/documentation/mobile_scanner/latest/ ; https://eringen.substack.com/p/barcode-scanning-on-ios-the-missing . Plan : détecter la fonctionnalité, sinon `zxing-wasm` (~2 Mo, chargé à la demande, mis en précache du SW). Pour un courrier, l'OCR de l'étiquette est probablement plus utile que le code-barres (voir B). L'OCR est hors périmètre de ce document.

### A5. Background Sync et alternatives

- Background Sync, Periodic Background Sync et Background Fetch : **non supportés sur iOS**. **[V/S]** https://firt.dev/notes/pwa-ios/ (tableau de compatibilité d'un expert reconnu) ; fil Apple : https://developer.apple.com/forums/thread/694805
- **Alternative** : la sync est pilotée par l'app au premier plan :
  - file d'attente locale (outbox) dans SQLite, avec identifiants client idempotents (UUID v7 générés côté client) pour que les rejeux soient sans effet ;
  - déclencheurs : `online` event, `visibilitychange` visible, ouverture de l'app, fin de chaque lot, bouton "Synchroniser" manuel, minuteur toutes les N secondes tant que l'app est visible ;
  - PowerSync gère déjà le téléversement de la file via `uploadData` avec reprise ; les photos sont téléversées par une file séparée, reprise à chaque démarrage ;
  - ne pas se fier à `navigator.onLine` seul (vrai en Wi-Fi captif) : tester avec une requête légère `HEAD /health`.
  - indicateur permanent d'état de sync (en ligne / hors ligne / N en attente / erreur).
- Web Push peut réveiller le SW (utile pour déclencher une sync), mais voir A6 pour les contraintes.

### A6. Web Push, Badging, Wake Lock

- **Web Push** : réservé aux web apps ajoutées à l'écran d'accueil (iOS 16.4+) ; la demande de permission doit suivre un geste utilisateur ; intégration aux Modes de concentration. **[V]** https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ . **Declarative Web Push** (notification sans JS du SW) disponible depuis iOS/iPadOS 18.4. **[V]** https://webkit.org/blog/16574/digital-credentials-api/
- Pour cette app, le Push est de second ordre (l'agent est l'émetteur, la notification des destinataires passe par e-mail/Teams/Slack côté backend). Utile éventuellement pour alerter l'agent (colis en attente de remise depuis > N jours). Piège rapporté : abonnement push silencieusement en échec quand le SW ne contrôle pas encore la page (Discourse). **[S]** https://meta.discourse.org/t/push-notification-subscription-in-ios-pwa-silently-failing-because-of-sw-not-controlling-the-app/402645
- **Badging API** (`setAppBadge`/`clearAppBadge`) : iOS 16.4+, web apps installées. **[V]** https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ . Usage : nombre de colis en attente de remise. Le badge n'est mis à jour que quand l'app tourne ou reçoit un push : ne pas en faire une source d'information fiable.
- **Screen Wake Lock** : dans les web apps installées, cassé jusqu'à iOS 18.4, corrigé depuis. **[V]** https://webkit.org/blog/16574/digital-credentials-api/ (mention du correctif 18.4) ; bug 254545 https://bugs.webkit.org/show_bug.cgi?id=254545 . Utile pour garder l'écran allumé pendant un lot. Demander le verrou dans un `try/catch`, le reprendre sur `visibilitychange`, il peut être révoqué.

### A7. Web Share, share target, file input

- **Web Share API** : depuis iOS 12.1 (Share 2.0, fichiers, iOS 15). **[V/S]** https://firt.dev/notes/pwa-ios/ . Utile pour exporter un récapitulatif ou le JSON de secours.
- **Web Share Target** (manifeste `share_target`) : **non supporté** sur iOS. **[S]** https://firt.dev/notes/pwa-ios/ (absence indiquée ; **[NV]** pour iOS 26 précisément). Conséquence : pas de "partager vers Courrier YSL" depuis Photos/Mail. Alternative : bouton "Importer depuis la photothèque" (`<input type="file" accept="image/*" multiple>`).
- **`<input type="file" capture>`** : `capture="environment"` sélectionne la caméra arrière sur iOS. **[S]** https://blog.filestack.com/upload-jpg-file-mobile-traps/ . En Safari 26, les `File` assignés par programme affichent le bon nom. **[V]** https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Piège EXIF : d'anciennes versions de Mobile Safari ignoraient l'orientation EXIF lors du `drawImage` sur canvas ; WebKit bug 203482 / 207088. **[S/NV]** pour iOS 26 : tester. Mitigation : `createImageBitmap(file, { imageOrientation: 'from-image' })` **[NV]** (non vérifié sur Safari ; la recherche n'a rien trouvé), ou lecture explicite de l'orientation EXIF.

### A8. Vibration, haptique

- **Vibration API : non supportée sur iOS.** **[V/S]** https://firt.dev/notes/pwa-ios/
- Contournement connu : un `<input type="checkbox" switch>` (haptique ajouté en Safari 18 d'après les release notes) déclenché via son `<label>`. **[V]** pour l'existence de l'haptique du switch (https://developer.apple.com/documentation/safari-release-notes/safari-18-release-notes.md) ; **[S]** pour le détournement programmatique, avec un bug WebKit demandant de l'exiger au moindre geste utilisateur (https://bugs.webkit.org/show_bug.cgi?id=285120) et une affirmation isolée qu'iOS 26.5 l'aurait corrigé (**[NV]**, une seule source : https://rapidtoolset.com/en/tool/ios-haptics-tester).
- Conclusion de conception : **ne jamais compter sur l'haptique iOS.** Remplacer par un triplet visuel + sonore + animation : flash de bordure vert, bip court (Web Audio, déclenché après un geste utilisateur pour déverrouiller l'audio), et animation de "carte" qui rejoint la file. Sur Android et desktop, `navigator.vibrate` en amélioration progressive derrière une détection de fonctionnalité. Proposer un réglage "Sons" et "Retour haptique" (désactivable, par accessibilité et pour l'environnement de bureau).

### A9. View Transitions

- Same-document View Transitions : Safari 18. Cross-document : Safari 18.2, avec View Transition Classes/Types et événements `pageswap`/`pagereveal`. **[V]** https://developer.apple.com/tutorials/data/documentation/safari-release-notes/safari-18_2-release-notes.md ; https://developer.chrome.com/docs/web-platform/view-transitions/cross-document
- Safari 26 : correctifs mineurs (stacking context avec `will-change`, scintillement canvas). **[V]** https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- Usage : `document.startViewTransition()` autour des changements d'état React pour les transitions liste → détail ; détection de fonctionnalité + `prefers-reduced-motion`. **Pas pour la vue caméra** (risque de scintillement de la vidéo, **[NV]**). Garder les transitions < 250 ms.

### A10. Mémoire et traitement d'image

- Safari limite la surface d'un canvas à **16 777 216 pixels** (≈ 4096 × 4096) et impose un budget mémoire total pour tous les canvas (valeurs rapportées 224-384 Mo selon version, dépend de l'appareil). Les canvas non référencés peuvent continuer à compter ; contournement : `canvas.width = canvas.height = 0` avant de libérer. **[S]** https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/ ; https://www.pqina.nl/blog/total-canvas-memory-use-exceeds-the-maximum-limit/ ; https://developer.apple.com/forums/thread/112218
- Un appareil photo d'iPhone récent produit des images de 12 à 48 Mpx : **réduire avant de dessiner**. Recommandation : traiter les photos une par une (jamais en parallèle), cibler ~1600 px sur le grand côté, JPEG qualité 0.8, via `createImageBitmap` avec `resizeWidth/resizeHeight` si supporté **[NV]** sinon `<img>` + canvas, libérer `ImageBitmap.close()`, travailler dans un Worker si `OffscreenCanvas` est dispo **[NV]**.
- HEIC : Safari 17+ décode nativement, les autres navigateurs non. **[S]** https://libraries.io/npm/heic-normalize . L'input `capture` renvoie généralement du JPEG sur iOS ; la photothèque peut renvoyer du HEIC converti ou non **[NV]**. Normaliser en JPEG côté client.
- Les crashs d'onglet par manque de mémoire en rafale sont le risque principal d'un scan de 50 colis : écrire chaque photo en OPFS dès sa prise, ne garder en mémoire que des vignettes (≤ 200 px), nettoyer les `URL.createObjectURL` (`revokeObjectURL`).

### A11. Tableau des pièges (synthèse)

| Piège | Impact | Contournement |
|---|---|---|
| Usage dans un onglet Safari, pas installé | Éviction 7 jours, pas de Push, pas de standalone | Onboarding "Ajouter à l'écran d'accueil", garde-fou au démarrage |
| Caméra redemandée | Friction à chaque lancement | Flux unique au-dessus du routeur, bouton d'activation, repli `capture` |
| SW ancien jamais rechargé | Utilisateur bloqué sur ancienne version | `update()` sur resume, `version.json`, prompt, "Forcer la mise à jour" |
| Pas de Background Sync | Données en attente tant que l'app n'est pas ouverte | Sync pilotée par l'app, compteur d'attente, outbox idempotente |
| Pas de Vibration API | Pas de retour tactile fiable | Retour visuel + sonore |
| Canvas 16 Mpx / mémoire | Crash en rafale | Réduction avant dessin, traitement séquentiel, OPFS |
| Pas de share target | Pas d'import depuis Photos/Mail | Bouton d'import via `<input type=file>` |
| Mode privé : OPFS indisponible | Échec d'ouverture BDD | Repli IDBBatchAtomicVFS, message clair |
| Verrous OPFS à la mise en arrière-plan | Erreur au retour **[NV]** | Réouverture de la BDD sur `visibilitychange`, tests sur appareil |

---

## B. UX et design

### B1. Références et benchmarks

- **Envoy Deliveries** : enregistre un colis en prenant une photo de l'étiquette ; OCR du nom du destinataire, rapprochement avec l'annuaire, notification automatique (e-mail, Slack, Teams, push) ; si le nom n'est pas lu, le colis est enregistré sans notification et marqué en alerte jaune dans l'écran "Up next" ; journal des livraisons séparé en en attente / remis, recherche par nom, preuve de remise par signature ou photo, relances programmées. **[V]** (pages d'aide Envoy) https://help.envoy.com/how-to-record-deliveries/ ; https://help.envoy.com/using-the-delivery-log/ ; https://help.envoy.com/about-delivery-notifications/ . À retenir : **ne jamais bloquer la saisie** quand la reconnaissance échoue, enregistrer et signaler.
- **Scandit, guide d'usabilité du scan** : trois principes (démarrer la caméra vite, aider à viser, donner un retour fort) ; surbrillance de chaque code détecté + son/haptique ; scan continu seulement si les lectures accidentelles sont improbables, sinon pause avec surcouche persistante ; ne pas réduire la zone de scan au point de "scanner à travers un trou de serrure". **[V]** https://docs.scandit.com/data-capture-sdk/web/best-practices-for-usability.html
- **Shopify** : un développeur demande le scan continu parce que rouvrir le scanner à chaque article est pénible en entrepôt. **[S]** https://community.shopify.dev/t/expose-continuous-barcode-scanning-to-embedded-apps-in-shopify-mobile/36549
- **Salesforce mobile** : exemples de scan continu et multi-codes. **[S]** https://developer.salesforce.com/docs/atlas.en-us.256.0.mobile_offline.meta/mobile_offline/use_barcodescanner_example_continuous.htm
- Non étudiés faute de sources atteintes : apps de livreurs (Amazon Flex, DHL, UPS), Shopify POS en détail, DataWedge de Zebra. **[NV]** : les patterns ci-dessous en tiennent compte uniquement par recoupement avec Scandit et Envoy.

### B2. Pattern "scan en rafale"

1. **Caméra ouverte en permanence** pendant un lot : une capture = un geste (appui sur un gros bouton obturateur en bas, zone du pouce, ou détection automatique de l'étiquette si fiable). Pas de modale de confirmation par colis.
2. **File de colis du lot en cours** : bandeau de vignettes en bas de la vue caméra (compteur "7 colis"), la dernière capture s'anime vers le bandeau. Chaque vignette porte un état : OK, à vérifier (point d'attention), échec.
3. **Traitement asynchrone** : l'OCR/extraction et le rapprochement tournent en arrière-plan sur les captures déjà faites pendant que l'agent continue. L'agent n'attend jamais le résultat.
4. **Revue en fin de lot** ("Terminer le lot") : liste des colis, **triée avec les cas à faible confiance en premier**, actions groupées, puis validation du lot en un geste. Les cas sûrs sont préremplis et sélectionnés par défaut.
5. **Doublons** : détecter une re-capture du même colis (même code-barres/étiquette) et proposer "Déjà scanné" plutôt que créer une entrée.
6. **Annuler** : toast "Colis ajouté, Annuler" pendant ~5 s, plutôt qu'une confirmation avant.
7. **Reprise de lot** : si l'app est tuée en cours de lot, le lot est restauré au prochain lancement (brouillon persistant dans SQLite).

### B3. Formulaires de vérification, champs à faible confiance

- Afficher le **résultat d'extraction comme une proposition**, jamais comme un fait : champ prérempli + marqueur visible quand la confiance est faible (bordure ambre, icône, libellé "à vérifier") et jamais seulement par la couleur (WCAG 1.4.1).
- Un seul champ à faible confiance à la fois : focus automatique dessus, clavier approprié (`inputmode`, `autocomplete="off"`), suggestions du destinataire issues de l'annuaire (3 meilleures correspondances en puces tapables, pas de menu déroulant).
- Les champs à forte confiance sont repliés/compacts : on ne montre pas 8 champs à relire.
- Bouton principal unique "Valider et suivant" en bas (zone du pouce), "Passer" secondaire, aperçu de la photo zoomable (pincer pour zoomer) au-dessus du formulaire.
- Contrainte de taille de police : **au moins 16 px** dans les `<input>` pour que Safari iOS ne zoome pas automatiquement au focus **[S/connu]** ; ne pas désactiver le zoom (voir B6).
- Brouillon enregistré à chaque champ ; pas de perte si on quitte.

### B4. Recherche instantanée, actions groupées

- Recherche locale (SQLite) : résultats à chaque frappe, sans réseau, tolérante aux accents et à l'ordre des mots ; destinataires = annuaire local, colis = journal local. Historique/suggestions récentes, effacement en un tap.
- Filtres en puces (En attente, Remis, À vérifier, Aujourd'hui) plutôt que formulaire de filtres.
- Actions groupées : **mode sélection** déclenché par appui long ou bouton "Sélectionner", barre d'actions en bas ("Marquer remis", "Notifier de nouveau", "Supprimer"). Une action destructive passe par annulation (toast) plutôt que par dialogue, sauf suppression définitive.
- "Tout sélectionner" par destinataire ou par lot pour la remise groupée (un destinataire qui récupère 6 colis).

### B5. États vides, erreurs, chargement

- **États vides** : une phrase + une action ("Aucun colis en attente. Scanner un lot"). Ne pas laisser un écran blanc.
- **Erreurs** : dire ce qui s'est passé, ce qui est sauvé, et quoi faire ("Pas de réseau. 12 colis sont enregistrés sur cet iPhone et partiront dès le retour de la connexion."). Hors ligne n'est pas une erreur : c'est un état normal, affiché discrètement (pastille), pas bloquant.
- **Skeleton screens vs spinners** (NN/g) : spinner pour 2-10 s ; skeleton pour les chargements de page ou de liste de moins de 10 s ; barre de progression au-delà de 10 s ou pour les envois (upload photos) ; sous ~1 s, rien du tout. Les skeletons ne sont pas une panacée (une étude Viget de 2017 rapporte des attentes perçues plus longues qu'avec un spinner). **[V/S]** https://nngroup.com/articles/skeleton-screens/ (via résumé) ; https://www.nngroup.com/videos/skeleton-screens-vs-progress-bars-vs-spinners/
- Conséquence pour une app offline-first : **les données sont locales, donc la plupart des listes s'affichent en < 100 ms** : peu de skeletons nécessaires. Les réserver aux premiers chargements, à la première synchro, aux images/vignettes et aux écrans qui attendent le réseau (annuaire en première installation). Le skeleton doit reprendre la géométrie exacte du contenu pour éviter les décalages de mise en page.
- **UI optimiste** : toute écriture est immédiatement visible (écriture locale), l'état "en attente de sync" est un petit indicateur sur l'élément, pas un blocage. Retour arrière explicite si le serveur rejette (élément en erreur avec action "Corriger").

### B6. Accessibilité (WCAG 2.2)

- **Taille de cible** : WCAG 2.2 SC 2.5.8 (AA) exige 24 × 24 px CSS minimum, avec exceptions d'espacement. **[V]** https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html . La recommandation de 44 px vient de SC 2.5.5 (AAA, valeur non relue dans cette recherche, **[NV]** sur la page) et des HIG Apple (44 pt). **Règle du projet : 44 × 44 px minimum**, 56 px et plus pour les actions principales d'usage à une main.
- **Zoom** : ne pas poser `user-scalable=no` ni `maximum-scale=1` dans la balise viewport (WCAG 1.4.4, redimensionnement du texte). Utiliser une taille de police ≥ 16 px dans les champs pour éviter le zoom automatique.
- **Contraste** : texte 4,5:1, gros texte et composants 3:1 (WCAG 1.4.3, 1.4.11). Vérifier en mode sombre aussi. **[connu, source W3C non relue]**
- Respecter `prefers-reduced-motion` (couper les transitions non essentielles), `prefers-color-scheme`, le texte dynamique (unités `rem`).
- Cibles espacées d'au moins 8 px, pas de geste complexe sans alternative (WCAG 2.5.1, 2.5.7 : pas de glisser-déposer seul ; le swipe pour supprimer doit avoir un bouton équivalent).
- Focus visible, labels explicites, `aria-live="polite"` pour les confirmations de scan et l'état de sync ; compatibilité VoiceOver à tester (au minimum lecture des vignettes et du compteur de lot).
- Ne pas transmettre l'information par la couleur seule (états du lot : icône + texte).

### B7. Haptique, sons, mode sombre, navigation

- **Haptique** : voir A8. Non fiable sur iOS ; prévoir un double canal visuel + sonore. Sons courts distincts : succès, à vérifier, erreur.
- **Mode sombre** : suivre `prefers-color-scheme` avec bascule manuelle (Réglages). Noir (#000) pur sur OLED OK, mais éviter le blanc pur sur noir pur pour de longs textes (adoucir à ~#F2F2F2). Pour la vue caméra, interface sombre toujours.
- `<meta name="theme-color">` et `apple-mobile-web-app-status-bar-style` adaptés ; `viewport-fit=cover` + `env(safe-area-inset-*)` pour l'encoche et la barre d'accueil.
- **Navigation par onglets en bas** : 3 ou 4 destinations maximum, cibles de 44 px et plus, état actif clair (icône pleine + libellé), conservation de l'état de chaque onglet, le bouton central "Scanner" mis en avant (zone du pouce). Éviter les gestes bord à bord qui entrent en conflit avec le geste "retour" système d'iOS Safari.
- **Usage à une main, debout** : toutes les actions fréquentes dans le tiers inférieur de l'écran ; pas de menu hamburger ; pas d'action critique en haut à gauche.
- Verrouiller l'orientation en portrait n'est pas fiable en PWA iOS (Screen Orientation partiel **[V/S]** https://firt.dev/notes/pwa-ios/) : concevoir un paysage acceptable.
- Pas d'overscroll "pull-to-refresh" natif en standalone : fournir un bouton ou un geste maison si nécessaire (la donnée est locale, ce n'est pas indispensable).

### B8. Architecture d'information (écrans)

Navigation par 4 onglets en bas :

1. **Scanner** (onglet central, par défaut au lancement)
   - Vue caméra plein écran + bandeau de la file du lot en cours + compteur.
   - Bouton obturateur, bascule lampe, import depuis la photothèque, saisie manuelle.
   - "Terminer le lot" → **Revue du lot** (liste triée par confiance, formulaire de vérification en feuille modale, validation groupée) → **Récapitulatif** (N colis enregistrés, N notifications en attente, N à compléter).
2. **Colis** (journal)
   - Barre de recherche instantanée, filtres en puces (En attente, À vérifier, Remis).
   - Liste groupée par destinataire ou par date ; sélection multiple ; détail d'un colis (photo, destinataire, historique, statut de sync, actions : remis, renotifier, corriger, supprimer).
3. **Remise** (retrait par un destinataire)
   - Recherche par nom → colis en attente de la personne → "Remettre tout" avec preuve (signature ou photo, comme Envoy) en option.
4. **Réglages**
   - État de synchronisation et file d'attente, diagnostic du stockage (persisté, espace), version de l'app et "Forcer la mise à jour", sons/haptique, thème, aide "Ajouter à l'écran d'accueil", annuaire (forcer la resynchronisation), déconnexion.

Éléments transverses : pastille d'état hors ligne/sync dans l'en-tête, bandeau de mise à jour non bloquant, toasts d'annulation, onboarding (installation, permission caméra) au premier lancement. Un rôle admin (annuaire, export, rapports) relève plutôt d'une interface desktop et peut être hors de ce premier périmètre.

### B9. Trois principes de design

1. **Le geste d'abord, la machine ensuite.** Un colis = un geste. L'agent ne reste jamais bloqué par la reconnaissance, le réseau ou une confirmation : on capture tout de suite, on traite en arrière-plan, on ne demande à l'humain que ce qui est incertain, à la fin du lot. (Envoy : enregistrer même sans lecture du nom ; Scandit : scan continu sans reprises.)
2. **Un seul chemin évident par écran, dans la zone du pouce.** Une action principale (gros bouton en bas), des actions secondaires discrètes, 4 onglets, aucun menu caché. Chaque écran répond à "que fait-on ensuite ?" sans lire.
3. **L'état est toujours visible et jamais anxiogène.** L'agent sait en un coup d'œil ce qui est enregistré sur l'iPhone, ce qui est synchronisé, ce qui attend sa vérification. Hors ligne est un état normal, les erreurs disent ce qui est sauvé et quoi faire, tout est annulable.

### B10. Direction visuelle (inspirée de l'esprit Saint Laurent, sans le logo)

Sobriété éditoriale : le luxe par la retenue, la typographie et l'espace, pas par l'ornement. **Ne pas utiliser le logo ni de lettrage reproduisant la marque.** Valider avec le client l'usage de l'identité visuelle de l'entreprise.

- **Couleurs** : noir (#0A0A0A) et blanc cassé (#FAFAF8) comme base ; gris neutres (#6B6B6B texte secondaire, #E7E7E4 filets). Un seul accent fonctionnel pour les états (ambre sobre pour "à vérifier", vert profond pour "OK", rouge brique pour l'erreur), toujours doublé d'un pictogramme. Aucun dégradé ni ombre portée marquée ; séparation par filets fins de 1 px.
- **Typographie** : titres en capitales à fort interlettrage, sans empattement géométrique ou grotesque, poids moyen (références possibles : Inter/Geist en police variable libre pour le corps ; pour les titres, un grotesque à fort caractère type "Neue Haas Grotesk"-like libre comme Inter Tight ou Archivo). Corps ≥ 16 px, interligne généreux. Les polices sont auto-hébergées et précachées (pas de CDN : offline). Choix à confirmer ; les polices commerciales exigeraient une licence.
- **Composants** : shadcn/ui en base, thématisé par variables CSS (`--radius` faible ou nul, 0-4 px pour un rendu net), bordures 1 px, boutons pleins noirs avec texte blanc (inverse en sombre), gros rayons évités. Icônes au trait fin (Lucide).
- **Mouvement** : transitions courtes (150-250 ms), `ease-out`, translation + fondu, aucune animation décorative, `prefers-reduced-motion` respecté.
- **Imagerie** : les photos de colis sont le seul "visuel" ; vignettes carrées, coins vifs, pas d'illustrations ludiques dans les états vides (pictogramme au trait + phrase).
- **Mode sombre** : natif et équivalent en qualité, pas une réflexion tardive (noir profond, filets #262626).

### B11. Choix d'implémentation UX liés à la stack

- React + Vite + TS + Tailwind + shadcn/ui : ok. Les composants Radix de shadcn ont des cibles par défaut souvent < 44 px (ex. boutons `sm`, cases à cocher) : **surcharger les tailles** dans le thème.
- Éviter les bibliothèques de dialogues qui piègent le focus caméra ; privilégier des feuilles du bas (type "drawer", vaul) pour les formulaires de vérification, en veillant à ce qu'elles ne démontent pas le flux vidéo.
- Gestion d'état serveur : requêtes sur SQLite via PowerSync (`useQuery` réactif) : les listes se mettent à jour d'elles-mêmes après la sync, pas de logique d'invalidation.
- Tests : appareils réels (au moins un iPhone récent et un plus ancien), scénarios sur Safari standalone : mode avion, verrouillage pendant un lot, bascule vers une autre app et retour, relance après 8 jours **[NV]** (l'exemption ITP est documentée mais jamais vérifiée de bout en bout ici).

---

## C. Récapitulatif vérifié / non vérifié

**Vérifié [V]**
- Exemption des web apps de l'écran d'accueil de la règle ITP des 7 jours (WebKit, tracking-prevention).
- Quotas 60 % / 80 % du disque, causes d'éviction, `persist()` accordé selon heuristiques dont le mode Home Screen (WebKit, storage policy).
- Comportement de wa-sqlite/PowerSync sur Safari : VFS, `readwrite-unsafe` absent, JSPI absent, SharedWorker sans access handles, multi-onglet désactivé par défaut sur Safari/iOS, OPFSCoopSyncVFS recommandé (blog et doc PowerSync).
- Bug de permission caméra en web app : prompts après navigation, permission non persistante entre sessions, nouvelle demande de permission persistante ouverte le 12 octobre 2026 (bug 215884).
- Web Push iOS (écran d'accueil, geste utilisateur), Badging (16.4+), Declarative Push (18.4), Wake Lock corrigé en 18.4 (articles WebKit).
- View Transitions : same-document Safari 18, cross-document Safari 18.2 (notes Apple et Chrome).
- Safari 26 : tout site ajouté à l'écran d'accueil s'ouvre en web app, manifeste non requis.
- `autoUpdate` vs `prompt` de vite-plugin-pwa, risque de perte de données avec autoUpdate.
- WCAG 2.2 SC 2.5.8 : 24 px minimum.
- Fonctionnement d'Envoy Deliveries, guide d'usabilité Scandit.

**Source secondaire / anecdotique [S]**
- Absence de Background Sync, Vibration, Web Share Target sur iOS (tableau de Maximiliano Firtman, cohérent avec le fil Apple, mais pas relu sur iOS 26.x).
- SW qui reste ancien en standalone (bugs anciens, forums).
- Limites canvas 16 Mpx et budget mémoire, valeurs variables selon version.
- Bugs getUserMedia 245962, 252465, 273938 (statut actuel non relu).
- Détournement haptique via `checkbox switch`.
- Règle NN/g 2-10 s / 10 s (résumés, article complet non relu).

**Non vérifié [NV] : à tester sur appareil avant de s'engager**
- Statut précis de `BarcodeDetector` sur Safari iOS 26 (sources contradictoires).
- `createImageBitmap` avec `imageOrientation`/`resizeWidth` sur Safari, `OffscreenCanvas` en Worker, orientation EXIF sur canvas en iOS 26, HEIC depuis la photothèque.
- Fermeture des access handles OPFS à la mise en arrière-plan en Safari standalone (observé seulement sur Capacitor).
- Effet des view transitions sur une vidéo caméra.
- Détournement haptique corrigé en iOS 26.5 (une seule source).
- Comportement exact de `persist()` (garantie réelle) et vérification de bout en bout de la rétention après > 7 jours d'inactivité en web app.
- `share_target` sur iOS 26 précisément, valeur 44 px de SC 2.5.5, contraste 4,5:1 (connus, source W3C non relue ici).
- Réglage MDM de la permission caméra et déploiement via web clip.
- Apps de livreurs, Shopify POS, Zebra DataWedge : non étudiés en profondeur.
- Notes de version iOS 26.1 à 26.x : seule la page "Safari 26.0" a été lue ; des changements ultérieurs peuvent exister.

---

## D. Prochaines étapes suggérées

1. Prototype jetable de 1 jour sur iPhone réel : standalone + `getUserMedia` + navigation entre onglets + verrouillage/retour + capture 12-48 Mpx en rafale de 50 photos, pour valider A4, A10 et le point de fermeture OPFS.
2. Spike PowerSync Web avec `OPFSCoopSyncVFS` sur Safari iOS (ouverture, écriture en rafale, retour d'arrière-plan, mode privé).
3. Banc de test de mise à jour du SW : déployer v1 puis v2 et vérifier la reprise sur `visibilitychange` en standalone.
4. Maquettes des 4 écrans (Scanner, Revue du lot, Colis, Remise) avec le principe "geste d'abord" et test avec l'agent du courrier sur un lot réel.

## Sources principales

- https://webkit.org/tracking-prevention/
- https://webkit.org/blog/14403/updates-to-storage-policy/
- https://webkit.org/blog/17333/webkit-features-in-safari-26-0/
- https://webkit.org/blog/16574/digital-credentials-api/
- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://bugs.webkit.org/show_bug.cgi?id=215884
- https://bugs.webkit.org/show_bug.cgi?id=254545
- https://www.powersync.com/blog/sqlite-persistence-on-the-web
- https://docs.powersync.com/client-sdks/reference/javascript-web
- https://vite-pwa-org.netlify.app/guide/auto-update.html
- https://firt.dev/notes/pwa-ios/
- https://developer.apple.com/documentation/safari-release-notes/safari-18-release-notes.md
- https://developer.apple.com/tutorials/data/documentation/safari-release-notes/safari-18_2-release-notes.md
- https://developer.chrome.com/docs/web-platform/view-transitions/cross-document
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://nngroup.com/articles/skeleton-screens/
- https://docs.scandit.com/data-capture-sdk/web/best-practices-for-usability.html
- https://help.envoy.com/how-to-record-deliveries/
- https://pqina.nl/blog/canvas-area-exceeds-the-maximum-limit/
