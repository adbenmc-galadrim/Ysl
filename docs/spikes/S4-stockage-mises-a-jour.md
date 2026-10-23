# Spike S4 · stockage et mises à jour

Ticket YSL-7. Cahier des charges v2, §10.1 (avec §5.4 et §5.7) : vérifier sur iPhone, en
PWA installée, que Dexie et OPFS ne perdent rien et qu'une nouvelle version est vue sans
réinstaller. Prototype : [`apps/spike-storage`](../../apps/spike-storage).

| Critère     | Seuil                                                                                    |
| ----------- | ---------------------------------------------------------------------------------------- |
| Données     | aucune perte sur les scénarios : mode avion, app tuée, relance, verrouillage en écriture |
| Mise à jour | v2 détectée au retour au premier plan et appliquée sans réinstallation                   |
| Sinon       | ajuster la stratégie de mise à jour ; réexaminer PowerSync seulement si IndexedDB échoue |

« Aucune perte » se lit dans le contrôle d'intégrité de l'app : aucun colis sans photo,
aucune taille ni empreinte SHA-256 différente, aucun trou dans la numérotation, outbox
cohérente. Le contrôle compare ce que Dexie et OPFS contiennent à un registre tenu hors
de Dexie (dans `localStorage`) du nombre de colis validés et du dernier numéro validé :
colis manquants, dernières lignes disparues ou photo d'un colis validé sans sa ligne
comptent comme une perte. Une photo orpheline d'un colis jamais validé (écrite dans OPFS,
colis jamais enregistré) est tolérée et comptée : c'est la trace attendue d'une coupure
entre les deux écritures.

## Appareil

iPhone (D5 : iOS 26), PWA installée sur l'écran d'accueil depuis
https://ysl.shinseo.fr/spike-storage/.

## Ce que fait le prototype

- **Écriture** d'un colis : photo JPEG générée (≈ 2,7 Mo, 3000×4000) écrite dans OPFS par
  un worker, puis le colis et son entrée d'outbox dans une seule transaction Dexie.
  « Écrire 100 colis » en écrit un toutes les 300 ms environ (≈ 40 s au total). Après
  chaque transaction réussie, le registre `localStorage` (`spike-storage:committed`)
  avance : nombre de colis validés et dernier numéro validé.
- **Contrôle d'intégrité** au lancement, au retour au premier plan (après la fin de la
  session d'écriture) et sur « Contrôler » : croise Dexie, OPFS et le registre,
  recalcule les empreintes. L'écran État affiche les colis attendus (registre) et les
  colis présents. Registre absent avec un stockage non vide, ou registre présent avec
  une base vide, est signalé comme une perte ; tout vide sans registre s'affiche
  « stockage vide » (état neuf).
- **Stockage** : `persist()` demandé au lancement et sur bouton ; `persisted()` et
  `estimate()` affichés.
- **Mises à jour** : service worker `vite-plugin-pwa` en mode `prompt` ;
  `registration.update()` et lecture de `version.json` au lancement, au retour au premier
  plan et toutes les 5 min. Bandeau « Nouvelle version disponible » quand un service
  worker attend, masqué pendant une écriture. « Forcer la mise à jour » désinscrit
  seulement le service worker de ce spike (portée `/spike-storage/`) et vide seulement
  ses caches, sans toucher aux données ni aux autres applications de l'origine.
- **Version** : l'heure du build. Une nouvelle version se publie en relançant le
  déploiement sans cache, sans nouveau commit :
  `gh workflow run deploy.yml --ref prod -f force=true`.
- **Journal** : chaque événement, conservé dans `localStorage`. La session est close
  proprement quand l'app passe en `pagehide` ou avant un rechargement de mise à jour ;
  une session non close est signalée « interrompue » au lancement suivant (app tuée ou
  plantage). Une session d'écriture commencée et jamais terminée est signalée
  « Écriture interrompue », même si la session a été close par `pagehide` (iOS peut
  l'émettre en tuant l'app).

## Protocole

Noter à chaque étape le nombre de colis attendu avant, puis le nombre de colis présents
et le verdict du contrôle affichés dans l'écran État, et les comparer. Le contrôle
compare Dexie et OPFS au registre des colis validés tenu hors de Dexie (`localStorage`).

1. Sur l'iPhone, ouvrir https://ysl.shinseo.fr/spike-storage/ dans Safari, puis
   Partager › Sur l'écran d'accueil. Fermer Safari, lancer **Spike S4** depuis l'icône.
2. État : noter `standalone`, `persisté`, usage / quota et la version. Toucher
   **Demander le stockage persistant**, noter le résultat.
3. **Écrire 100 colis**, attendre la fin. **Contrôler** : 100 attendus, 100 colis présents, aucune perte.
4. **Mode avion**. Tuer l'app (balayer depuis le sélecteur d'apps), la relancer depuis
   l'icône : elle doit s'ouvrir hors ligne, contrôle automatique : 100 attendus, 100 colis présents, aucune perte.
5. Noter le nombre de colis affiché avant. Toujours en mode avion, **Écrire 100 colis** ; vers le milieu, **verrouiller** l'iPhone
   30 s, puis déverrouiller. Noter si la session a continué ou s'est arrêtée. Laisser
   finir, ou toucher **Arrêter**. **Contrôler** : noter le nombre de colis affiché après (attendu : avant + colis écrits,
   égal aux colis attendus du registre), aucune perte (orphelines notées).
6. **Écrire 100 colis** et, vers le milieu, **tuer l'app** : noter juste avant le nombre
   de colis écrits affiché dans l'écran. La relancer : « Session précédente interrompue »
   ou « Écriture interrompue » attendu, contrôle sans colis manquant : colis présents
   égal au nombre noté (± le colis en cours), orphelines notées.
7. Couper le mode avion. Noter la version, puis demander la v2 à l'agent et attendre son
   « déployé ». Passer sur une autre app, revenir : bandeau attendu ; noter le délai
   (`detection-delay` dans le journal). **Mettre à jour** : la version change, contrôle
   sans perte.
8. Demander une v3. Revenir dans l'app, puis **Forcer la mise à jour** sans attendre le
   bandeau : la version change, contrôle sans perte.
9. Journal › **Terminer la session**, puis **Exporter le journal** (AirDrop vers le Mac).
10. Noter le nombre de colis avant de laisser l'app. La laisser installée sans l'ouvrir
    plusieurs jours, puis la relancer et comparer : 0 colis signifie que le stockage a été
    effacé, même si le contrôle dit « aucune perte » (« stockage vide »), parce que le
    registre `localStorage` a été effacé avec. Sinon le contrôle dit si Safari a effacé
    une partie du stockage. Si l'observation arrive trop tard, elle sera
    rapportée dans une prochaine PR.

## Résultats

À remplir après le passage sur l'iPhone.

## Verdict

À remplir après le passage sur l'iPhone.
