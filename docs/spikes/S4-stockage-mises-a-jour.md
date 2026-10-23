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
cohérente. Une photo orpheline (écrite dans OPFS, colis jamais enregistré) est tolérée et
comptée : c'est la trace attendue d'une coupure entre les deux écritures.

## Appareil

iPhone (D5 : iOS 26), PWA installée sur l'écran d'accueil depuis
https://ysl.shinseo.fr/spike-storage/.

## Ce que fait le prototype

- **Écriture** d'un colis : photo JPEG générée (≈ 2,7 Mo, 3000×4000) écrite dans OPFS par
  un worker, puis le colis et son entrée d'outbox dans une seule transaction Dexie.
  « Écrire 100 colis » en écrit un toutes les 300 ms environ (≈ 40 s au total).
- **Contrôle d'intégrité** au lancement, au retour au premier plan (après l'écriture en
  cours) et sur « Contrôler » : croise Dexie et OPFS, recalcule les empreintes.
- **Stockage** : `persist()` demandé au lancement et sur bouton ; `persisted()` et
  `estimate()` affichés.
- **Mises à jour** : service worker `vite-plugin-pwa` en mode `prompt` ;
  `registration.update()` et lecture de `version.json` au lancement, au retour au premier
  plan et toutes les 5 min. Bandeau « Nouvelle version disponible » quand un service
  worker attend, masqué pendant une écriture. « Forcer la mise à jour » désinscrit le
  service worker et vide ses caches, sans toucher aux données.
- **Version** : l'heure du build. Une nouvelle version se publie en relançant le
  déploiement sans cache, sans nouveau commit :
  `gh workflow run deploy.yml --ref prod -f force=true`.
- **Journal** : chaque événement, conservé dans `localStorage` ; une session non terminée
  est signalée au lancement suivant (app tuée ou plantage).

## Protocole

Noter à chaque étape le nombre de colis et le verdict du contrôle affichés dans l'écran
État.

1. Sur l'iPhone, ouvrir https://ysl.shinseo.fr/spike-storage/ dans Safari, puis
   Partager › Sur l'écran d'accueil. Fermer Safari, lancer **Spike S4** depuis l'icône.
2. État : noter `standalone`, `persisté`, usage / quota et la version. Toucher
   **Demander le stockage persistant**, noter le résultat.
3. **Écrire 100 colis**, attendre la fin. **Contrôler** : 100 colis, aucune perte.
4. **Mode avion**. Tuer l'app (balayer depuis le sélecteur d'apps), la relancer depuis
   l'icône : elle doit s'ouvrir hors ligne, contrôle automatique 100 colis, aucune perte.
5. Toujours en mode avion, **Écrire 100 colis** ; vers le milieu, **verrouiller** l'iPhone
   30 s, puis déverrouiller. Noter si la session a continué ou s'est arrêtée. Laisser
   finir, ou toucher **Arrêter**. **Contrôler** : aucune perte (orphelins notés).
6. **Écrire 100 colis** et, vers le milieu, **tuer l'app**. La relancer : « Session
   précédente interrompue » attendu, contrôle sans colis manquant (orphelins notés).
7. Couper le mode avion. Noter la version, puis demander la v2 à l'agent et attendre son
   « déployé ». Passer sur une autre app, revenir : bandeau attendu ; noter le délai
   (`detection-delay` dans le journal). **Mettre à jour** : la version change, contrôle
   sans perte.
8. Demander une v3. Revenir dans l'app, puis **Forcer la mise à jour** sans attendre le
   bandeau : la version change, contrôle sans perte.
9. Journal › **Terminer la session**, puis **Exporter le journal** (AirDrop vers le Mac).
10. Laisser l'app installée sans l'ouvrir plusieurs jours, puis la relancer : le contrôle
    dit si Safari a effacé le stockage. Si l'observation arrive trop tard, elle sera
    rapportée dans une prochaine PR.

## Résultats

À remplir après le passage sur l'iPhone.

## Verdict

À remplir après le passage sur l'iPhone.
