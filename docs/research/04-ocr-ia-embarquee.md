# 04 — OCR et IA embarquée pour la lecture des bordereaux (Courrier YSL v2)

> Recherche menée le **21 octobre 2026**. Toutes les sources ont été consultées à cette date.
> Légende utilisée dans tout le document :
> - **[Fait]** : vérifié dans une source citée (doc officielle, release notes, bug tracker, page de prix).
> - **[Source tierce]** : rapporté par un article ou un agrégateur, non confirmé par l'éditeur.
> - **[Estimation]** : déduction ou ordre de grandeur de notre part, **à mesurer sur iPhone réel**.

---

## 0. Résumé du diagnostic v1

La v1 (Tesseract.js 5, fra+eng) bute sur trois limites propres à Tesseract, pas à la configuration :

1. **Pas de vraie détection de texte multi-orientation.** Tesseract segmente la page en lignes horizontales. Sur une étiquette, l'expéditeur est souvent en petit, en bloc, parfois vertical : il est raté. Faire tourner l'image 4 fois multiplie le temps par 4 (15-25 s).
2. **Mise en page en blocs.** Les étiquettes UPS/DHL/FedEx sont des grilles de cases. La segmentation de Tesseract, prévue pour du texte en paragraphes, fusionne ou coupe ces cases.
3. **Aucun usage des codes-barres.** Le n° de suivi est **toujours** encodé en code-barres sur l'étiquette, et l'OCR est le moyen le moins fiable de le lire.

Le levier principal de la v2 : **lire le code-barres pour le suivi, utiliser un détecteur de texte neuronal (famille PaddleOCR) pour le reste, et faire correspondre le destinataire à l'annuaire interne**. Changer seulement de moteur OCR ne suffit pas.

---

## 1. Moteurs OCR / vision exécutables dans le navigateur sur iPhone

### 1.1 État des API d'accélération sur Safari iOS (octobre 2026)

| API | État sur Safari iOS 26 | Statut |
|---|---|---|
| **WebGPU** | Activé par défaut dans Safari 26 (iOS, iPadOS, macOS, visionOS). WebKit : « WebGPU supersedes WebGL… preferred for new sites and web apps » et « Transformers.js, ONNX Runtime and others all work great in Safari 26 beta ». | **[Fait]** — [WebKit, WWDC25 / Safari 26](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/) |
| **Transformers.js + WebGPU Safari** | La v4.3.0 (16 sept. 2026) active WebGPU pour Safari 26+ (« Enable WebGPU for Safari 26 and above », #1700). Dernière version : 4.3.1 (7 oct. 2026). | **[Fait]** — [releases transformers.js](https://github.com/huggingface/transformers.js/releases) |
| **onnxruntime-web WebGPU sur iOS** | Le tableau de compatibilité officiel de npm liste toujours iOS en `wasm`/`webgl` seulement. Les notes WebGPU ne citent que Chromium/Edge. | **[Fait]** pour la doc, **[Estimation]** : ça fonctionne probablement via Safari 26 (WebKit l'affirme), mais ce n'est pas certifié par Microsoft. À tester. [npm onnxruntime-web](https://npmjs.com/package/onnxruntime-web) |
| **WebNN** | Chrome 146 en origin trial (fév. 2026). WebKit : « No signal », Apple participe au groupe de travail sans annonce d'implémentation. | **[Fait]** — [Intent to Experiment WebNN](https://groups.google.com/a/chromium.org/g/blink-dev/c/5CWKSChYo98), [Phoronix Chrome 146](https://www.phoronix.com/news/Chrome-146-Beta). **À ne pas prévoir pour la v2.** |
| **Mémoire WASM sur iOS** | Bugs WebKit : seulement environ 300-500 Mo allouables de façon fiable, la mémoire disponible baisse après des rechargements, et Safari tue l'onglet au lieu de refuser l'allocation. | **[Fait]** (rapports 2021-2024, iOS 17) — [WebKit 269777](https://bugs.webkit.org/show_bug.cgi?id=269777), [WebKit 221530](https://bugs.webkit.org/show_bug.cgi?id=221530), [WebKit 222097](https://bugs.webkit.org/show_bug.cgi?id=222097). **[Estimation]** : viser moins de 250 Mo de pic mémoire. |

### 1.2 Comparatif des moteurs

| Moteur | Qualité sur photo de document | Texte vertical / multi-orientation | Poids à télécharger | Temps estimé iPhone 15/16 | Licence | Maturité |
|---|---|---|---|---|---|---|
| **Tesseract.js v7** | Bonne sur un scan propre, médiocre sur une photo en biais avec reflets et blocs (constaté en v1). | Faible : OSD 0/90/180/270 sur la page entière, pas par bloc. | Cœur WASM + `fra`/`eng`. **[Estimation]** 5-15 Mo selon les modèles fast/best. | **[Estimation]** 3-6 s par passe sur iPhone récent. v7 annonce **15-35 % plus rapide** que v6 (build `relaxedsimd`). | Apache-2.0 | Très mature. v6 a corrigé une fuite mémoire et désactivé par défaut les sorties non-texte. v7 (fin 2025) ajoute le build relaxed-SIMD. **[Fait]** [v6](https://newreleases.io/project/npm/tesseract.js/release/6.0.0), [v7](https://newreleases.io/project/npm/tesseract.js/release/7.0.0) |
| **Scribe.js** | Surcouche de Tesseract.js : auto-rotation, combinaison des modèles Legacy et LSTM, meilleure précision sur documents difficiles d'après le benchmark des auteurs (ex. 81,5 % → 98,9 % sur un scan). | Auto-rotation légère. Pas de détection de lignes verticales. | Plus lourd que Tesseract.js (double modèle). | Mode « quality » plus lent que Tesseract. | **AGPL-3.0** : risque juridique pour une app d'entreprise servie en réseau. | **[Fait]** [docs Scribe](https://docs.scribeocr.com/tesseract_users.html), [benchmark](https://github.com/scribeocr/ocr-benchmark), [repo (licence)](https://github.com/scribeocr/scribe.js) |
| **PaddleOCR PP-OCRv5 mobile (ONNX)** via `ppu-paddle-ocr` + onnxruntime-web | Nettement meilleure sur photo : détecteur DB (quadrilatères quelconques) + reconnaisseur par ligne. 99,48 % par boîte sur tickets de caisse (bench de l'auteur, M1). | **Bonne** : la détection est indépendante de l'orientation. `rotateVerticalCrops` tourne les lignes verticales avant reconnaissance. Classifieurs optionnels `PP-LCNet_x1_0_doc_ori` (0/90/180/270, ~7 Mo) et `textline_ori` (0/180). | Famille v5 mobile **~12 Mo** (det+rec). Variante `V5_EN_MOBILE_INT8`. | Médiane **~139 ms/image sur Apple M1** (Bun, CPU). **[Estimation]** iPhone 15/16 en WASM Safari : 0,4-1,5 s pour une étiquette, WebGPU annoncé 2-5× plus rapide quand disponible. | MIT (wrapper), Apache-2.0 (modèles) | Wrapper jeune mais actif. Retombe automatiquement de WebGPU vers WASM. **[Fait]** [ppu-paddle-ocr](https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr), [doc_ori](https://huggingface.co/PaddlePaddle/PP-LCNet_x1_0_doc_ori), [textline_ori](https://www.paddleocr.ai/latest/en/version3.x/module_usage/textline_orientation_classification.html) |
| **PaddleOCR PP-OCRv6** (tiny / small / medium) | Nouvelle génération, backbone PPLCNetV4. Reconnaissance : tiny 73,5 %, small 81,3 %, medium 83,2 % (bench interne Paddle, medium +5,1 pts vs v5 server). 50 langues dont 46 latines, ~200 diacritiques ajoutés. | Comme v5 (détection DB). | `ppu-paddle-ocr` : tiny ~6 Mo, small ~30 Mo, medium ~139 Mo. | **[Estimation]** tiny < v5 mobile, small ≈ 2× v5 mobile. | Apache-2.0 | Très récent : modèle par défaut de `ppu-paddle-ocr`. Le bench est celui de l'éditeur. **[Fait]** [PP-OCRv6](https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv6/PP-OCRv6.html), [Roboflow (licence)](https://inference-models.roboflow.com/models/pp-ocrv6/) |
| **docTR / OnnxTR** | Bonne qualité document (db_mobilenet + crnn_mobilenet : ~0,12-0,17 s/page sur CPU serveur). | Détection DB, comme Paddle. | Non publié. **[Estimation]** 15-25 Mo. | Pas de portage navigateur officiel trouvé. | Apache-2.0 | Mature en Python, **pas de chemin web prêt**. [OnnxTR](https://github.com/felixdittrich92/OnnxTR) |
| **Florence-2-base (230 M) via Transformers.js** | Tâches `<OCR>` / `<OCR_WITH_REGION>`. Bon sur scènes, moyen sur petits caractères denses. | Bon. | Poids q4f16 disponibles (onnx-community). **[Estimation]** 150-250 Mo. | **[Estimation]** 3-10 s en WebGPU iPhone, risque de crash mémoire. | MIT | Expérimental sur iOS. [onnx-community/Florence-2-base](https://huggingface.co/onnx-community/Florence-2-base-ft/tree/main) |
| **Petits VLM (SmolVLM-256M/500M, LFM2-VL, Qwen2.5/3-VL, Gemma 3, LightOnOCR, GLM-OCR)** | Peuvent extraire directement un JSON (destinataire, expéditeur…). Qualité OCR fine variable, risque d'hallucination. | Bon. | **[Estimation]** 250 Mo (SmolVLM-256M q4) à plus de 1 Go (2B q4). | Aucune mesure iPhone publiée. SmolVLM-500M annoncé ~0,5 s/image sur laptop. **[Estimation]** iPhone : 5-30 s. | Apache-2.0 / variables | Supportés par Transformers.js v4 (LightOnOCR, GLM-OCR, LFM2-VL, Qwen VL, Gemma3, SmolVLM réactivé en 4.1). **Inadapté en primaire** vu la limite mémoire iOS. [releases](https://github.com/huggingface/transformers.js/releases), [SmolVLM navigateur](https://pyimagesearch.com/2025/10/20/running-smolvlm-locally-in-your-browser-with-transformers-js/) |
| **MediaPipe (Tasks Vision)** | Pas de tâche OCR. Utile seulement pour la détection d'objets ou la segmentation. | — | — | — | Apache-2.0 | Hors sujet pour l'OCR. **[Estimation]** à partir du catalogue connu, non re-vérifié. |
| **zxing-wasm (codes-barres)** | Lecture déterministe : Code 128, DataMatrix, PDF417, QR, MaxiCode (support partiel, voir note). | Toutes orientations. | Lecteur seul : **~1,04 Mio** (v3.1.x). | **[Estimation]** 50-300 ms sur l'image complète. | MIT | Mature. **[Fait]** [README zxing-wasm](https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/README.md) |

**Conclusion §1** : pour l'OCR embarqué sur iPhone, la famille **PaddleOCR (v5 mobile ou v6 tiny/small) en ONNX** domine Tesseract sur les trois défauts de la v1 (orientation, blocs, vitesse), pour un poids comparable (~12-30 Mo). Les VLM embarqués sont prometteurs mais trop lourds et trop risqués en mémoire sur iOS en 2026 : à garder comme expérimentation.

---

## 2. Capacités natives iOS accessibles depuis le web

| Capacité | Accessible depuis une PWA ? | Détail | Statut |
|---|---|---|---|
| **Live Text / VisionKit (API)** | **Non** | VisionKit (`ImageAnalyzer`, `DataScannerViewController`) est une API Swift réservée aux apps natives (iOS 16+, Neural Engine). Aucune passerelle JavaScript. | **[Fait]** [VisionKit](https://developer.apple.com/documentation/visionkit), [WWDC22](https://developer.apple.com/videos/play/wwdc2022/10026/) |
| **Live Text côté utilisateur** | **Oui, manuellement** | L'utilisateur peut sélectionner le texte d'une image affichée (appui long) ou utiliser « Scanner du texte » dans le menu contextuel d'un champ de saisie (fonction iOS 15+). C'est **un excellent repli manuel par champ** (ex. corriger l'expéditeur). | **[Estimation]** (fonction système connue) : vérifier en mode standalone. |
| **Shape Detection API** (`BarcodeDetector`, `TextDetector`) | **Non** | Derrière un feature flag, cassée sur iOS depuis iOS 18. Bug WebKit 281848 toujours **NEW**, non assigné, dernière modification 21/07/2026. Rien sur `TextDetector`. | **[Fait]** [WebKit 281848](https://bugs.webkit.org/show_bug.cgi?id=281848), [Apple Forums](https://developer.apple.com/forums/thread/767761). Utiliser **zxing-wasm**. |
| **`<input type="file" accept="image/*" capture="environment">`** | **Oui** | Ouvre l'appareil photo natif : autofocus, HDR, pleine résolution (12-48 MP). La meilleure qualité d'image, mais aucun guidage de cadrage en direct. | **[Estimation]** (comportement standard iOS connu) |
| **`getUserMedia` en standalone** | **Oui, avec des bugs connus** | Fonctionne, mais plusieurs bugs propres au mode écran d'accueil : la permission est redemandée après un changement de route (hash/router), le flux est coupé par un 2ᵉ `getUserMedia`, échecs sur certains appareils (iOS 17.4.1). Contournement : **un seul flux, acquis dans une vue racine stable, jamais recréé lors de la navigation**. | **[Fait]** [WebKit 215884](https://bugs.webkit.org/show_bug.cgi?id=215884), [212040](https://bugs.webkit.org/show_bug.cgi?id=212040), [245962](https://bugs.webkit.org/show_bug.cgi?id=245962), [273938](https://bugs.webkit.org/show_bug.cgi?id=273938), [Apple Community 06/2025](https://discussions.apple.com/thread/256081579) |
| **Ouverture « comme app web »** | Oui | Safari 26 : tout site ajouté à l'écran d'accueil s'ouvre par défaut comme web app. | **[Fait]** [WebKit Safari 26](https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/) |
| **ImageCapture** | Partiel | Safari 26 ajoute `ImageCapture.grabFrame`. `takePhoto()` (pleine résolution) : non confirmé. | **[Fait]** pour grabFrame (même source). takePhoto **à tester**. |
| **Torche** | Oui | `applyConstraints({advanced:[{torch:true}]})` fonctionne. `getSettings()` renvoyait un état faux sur iOS 18 (corrigé en déc. 2024). | **[Fait]** [WebKit 280970](https://bugs.webkit.org/show_bug.cgi?id=280970). Attention : la torche **augmente les reflets** sur les étiquettes plastifiées, à n'utiliser que dans la pénombre. |
| **Focus / zoom manuels** | Non (probable) | D'après Dynamsoft, `focusMode` et `zoom` ne sont pas supportés sur iOS Safari. | **[Source tierce]** [focus](https://www.dynamsoft.com/codepool/camera-focus-control-on-web.html), [zoom](https://www.dynamsoft.com/codepool/camera-zoom-control-on-web.html). À tester avec `getCapabilities()`. |
| **Stockage hors ligne** | Oui | Depuis Safari 17 : quota par origine jusqu'à **60 % du disque**, global 80 %. Une web app standalone a le même quota que Safari. Éviction possible sous pression disque ou en cas d'inactivité prolongée. | **[Fait]** [WebKit « Updates to Storage Policy »](https://webkit.org/?p=14403). Appeler `navigator.storage.persist()`. 50 Mo de modèles ne posent pas de problème. |

---

## 3. Options serveur / cloud (en renfort)

### 3.1 Hypothèses de calcul
- Photo envoyée **recadrée et redimensionnée** (≈ 1200×1600 px, JPEG q≈0,85, ~250-400 Ko).
- Prompt ≈ 500 tokens texte, sortie JSON ≈ 300 tokens (+ tokens de réflexion éventuels).
- Volume réaliste d'un service courrier : **1 000 à 6 000 étiquettes/mois** **[Estimation]**. Même l'option la plus chère reste sous quelques dizaines d'euros par mois.

### 3.2 Comparatif (prix publics au 21/10/2026, en USD)

| Service | Ce qu'il renvoie | Prix / 1 000 étiquettes | Résidence UE / RGPD | Latence **[Estimation]** | Statut prix |
|---|---|---|---|---|---|
| **Google Cloud Vision** (TEXT/DOCUMENT_TEXT_DETECTION) | Texte + boîtes, pas de champs | **1,50 $** (1 000 premières unités/mois gratuites, 0,60 $ au-delà de 5 M) | Régions UE configurables (endpoint `eu-vision.googleapis.com`), DPA Google Cloud | 0,5-1,5 s | **[Fait]** [Cloud Vision pricing](https://cloud.google.com/vision/pricing) |
| **Google Document AI** | OCR / form parser / extracteurs | 1,50 à 30 $ selon le processeur | Région `eu` | 1-3 s | **[Source tierce]** [Lido](https://www.lido.app/blog/google-ocr-options-explained) |
| **Azure AI Document Intelligence – Read** | Texte + layout | **~1,50 $** (palier F0 : 500 pages/mois gratuites) | Régions France Central / West Europe | 1-3 s (asynchrone) | Prix **[Source tierce]** ([LiteLLM](https://docs.litellm.ai/docs/providers/azure_document_intelligence)). La page officielle affiche « $- ». Palier gratuit **[Fait]** [Azure pricing](https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/) |
| **AWS Textract – DetectDocumentText** | Texte + boîtes | **1,50 $** (Oregon, < 1 M pages) | eu-west-3 Paris existe (code de facturation), prix Paris non confirmé | 1-2 s | **[Fait]** pour Oregon [Textract pricing](https://aws.amazon.com/textract/pricing/), [Vantage](https://cur.vantage.sh/aws/amazontextract/) |
| **Mistral OCR 4 / 4.1** (FR) | Markdown structuré, Document AI / annotations en option | **4 $** standard, **2 $** batch (inutile ici). Annotations : 3-5 $ selon les sources | Éditeur français, auto-hébergement en conteneur possible pour clients régulés | 1-3 s | 4 $ **[Fait]** [docs.mistral.ai pricing](https://docs.mistral.ai/models/pricing). Annotations : sources contradictoires [Solutions Numériques](https://www.solutions-numeriques.com/chez-mistral-ai-locr-gagne-en-puissance-mais-pose-deja-la-question-des-couts/), [Eden AI](https://www.edenai.co/post/mistral-ocr-4-vs-top-document-parsing-apis-features-benchmarks-and-integration-guide) |
| **Claude Haiku 5.5** (LLM vision, JSON structuré) | JSON des champs directement | Image 1200×1600 = ⌈1200/28⌉×⌈1600/28⌉ = 43×58 = **2 494 tokens visuels**. Entrée 0,10 $/M, sortie 0,50 $/M → **≈ 0,5-1 $** | API Anthropic : `inference_geo` = `global` ou `us` seulement, **pas d'option UE**. Pour l'UE : via Bedrock (profils UE) ou Vertex (régions UE), à confirmer | 1-3 s | Formule tokens **[Fait]** [Claude Vision](https://platform.claude.com/docs/en/build-with-claude/vision), géo **[Fait]** [Data residency](https://platform.claude.com/docs/en/build-with-claude/data-residency). Prix : grille Anthropic au 06/10/2026. Coût total **[Estimation]** |
| **Claude Sonnet 5.5** | JSON, meilleure robustesse | 2 $/M entrée, 10 $/M sortie → **≈ 10-20 $** | idem | 2-5 s | idem |
| **Gemini 3.5 Flash-Lite / 3.1 Flash-Lite** | JSON (schéma) | Image en tuiles de 768 px à 258 tokens (≈ 4 tuiles ≈ 1 032 tokens). 3.5 FL : 0,30 $/M entrée, 2,50 $/M sortie → **≈ 1-2 $**. 3.1 FL : 0,25 $/1,50 $ → **≈ 1 $** | API Gemini grand public : traitement **global**. **Vertex AI** : traitement ML dans la région choisie (europe-west1/4…). Les modèles preview n'ont pas de garantie de résidence | 1-2 s | Prix **[Fait]** [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), tuiles **[Fait]** [image understanding](https://ai.google.dev/gemini-api/docs/image-understanding), résidence **[Fait]** [Vertex data residency](https://cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency) + **[Source tierce]** [Requesty](https://www.requesty.ai/eu/gemini) |
| **Gemini 3.8 Flash** | JSON, plus robuste | 0,75 $/3,75 $ par M jusqu'au 31/12/2026, puis doublement → **≈ 2-4 $** | idem | 1-3 s | **[Fait]** même page |
| **OpenAI GPT-5 mini** | JSON | 0,25 $/2 $ par M (texte). Tokens image non vérifiés → **≈ 1-2 $** | Résidence UE proposée sur offre entreprise (non vérifié ici) | 1-3 s | **[Fait]** pour le prix texte [OpenAI](https://developers.openai.com/api/docs/models/gpt-5-mini). Le reste **[Estimation]** |

**Précision attendue [Estimation]** : les OCR cloud (Vision, Textract, Azure Read) lisent quasiment tout le texte, y compris vertical, mais **ne savent pas quel bloc est l'expéditeur**. Il faut garder notre parseur. Les LLM vision (Haiku 5.5, Gemini Flash-Lite) font OCR + compréhension de mise en page en une étape et trouvent l'expéditeur de façon fiable sur les étiquettes standards. Leur risque : inventer un caractère dans un n° de suivi. **Le n° de suivi doit donc toujours venir du code-barres**, jamais d'un LLM.

### 3.3 RGPD (points clés)
- Les étiquettes contiennent des **données personnelles** (nom et adresse d'un salarié destinataire, parfois de particuliers expéditeurs). Il faut un DPA avec le fournisseur, l'inscription au registre des traitements, et une **minimisation** : envoyer uniquement le recadrage de l'étiquette, sans métadonnées EXIF/GPS, et avec désactivation de la rétention ou de l'entraînement quand l'option existe.
- **Ordre de préférence UE [Estimation]** : Mistral (FR) ≈ Azure France Central ≈ Vertex AI europe-west (Gemini) > AWS eu-west-3 (Textract, ou Claude via Bedrock UE) > API directes « global » (Anthropic, Gemini API, OpenAI).
- La résidence seule ne suffit pas : DPA, base légale (intérêt légitime de l'employeur pour la gestion du courrier) et maîtrise des logs restent nécessaires ([Eden AI](https://www.edenai.co/post/how-to-use-openai-claude-gemini-in-europe-without-gdpr-risk)).

### 3.4 Mode hybride recommandé
```
on-device (toujours) ──► score de confiance par champ
   │
   ├─ tous les champs ≥ seuil ──► formulaire pré-rempli, validation humaine
   │
   └─ un champ < seuil
        ├─ réseau dispo + option cloud activée ──► envoi du recadrage (pas de la photo brute)
        │      au backend (proxy, clés jamais dans la PWA) ──► fusion champ par champ
        │      (le cloud ne remplace que les champs faibles ; suivi = code-barres)
        └─ hors ligne ──► formulaire pré-rempli + file d'attente IndexedDB ;
               enrichissement à la prochaine ouverture en ligne
               (pas de Background Sync fiable sur iOS → relancer au démarrage / au retour de focus)
```
Il faut un **proxy serveur** (pour ne pas exposer de clé, faire le rate-limit et journaliser l'usage), même minimal (une fonction serverless en région UE).

---

## 4. Prétraitement : ce qui améliore vraiment la lecture

Classement par gain attendu sur des bordereaux **[Estimation sauf mention]** :

1. **Lecture des codes-barres avant tout OCR** (zxing-wasm, ~1 Mio **[Fait]**). Cela donne le n° de suivi sans erreur, et le transporteur se déduit du format. Formats usuels **[Estimation, connaissance générale à valider sur échantillons]** : UPS = `1Z` + 16 caractères alphanumériques (clé de contrôle) en Code 128, plus un **MaxiCode** qui encode code postal, pays, service et suivi. FedEx = 12/15/20 chiffres + PDF417 riche. DHL Express = 10 chiffres / « JD… » en Code 128. Colissimo/Chronopost = format UPU S10 (`XX123456789FR`, clé modulo 11) ou 13-15 caractères. DPD = 14 chiffres. Les **compteurs « 1/3 », « 1 OF 2 »** sont souvent en clair à côté.
2. **Détection d'orientation globale par classifieur** (PP-LCNet doc_ori, ~7 Mo, 0/90/180/270, 99 % **[Fait]** [HF](https://huggingface.co/PaddlePaddle/PP-LCNet_x1_0_doc_ori)). Une seule inférence (~10-30 ms **[Estimation]**) remplace les 4 passes Tesseract de la v1, soit la plus grosse partie des 15-25 s.
3. **Détecteur de texte neuronal + reconnaissance ligne par ligne** (Paddle DB). C'est ce qui règle le problème des blocs et du texte vertical : chaque boîte est recadrée puis redressée individuellement (`rotateVerticalCrops`), au lieu de redresser la page entière.
4. **Redressement de perspective** : détection du quadrilatère de l'étiquette, puis `warpPerspective`. Avec **jscanify** (MIT, OpenCV.js 4.7, suppression de reflets depuis v1.3.0 **[Fait]** [jscanify](https://github.com/puffinsoft/jscanify)). Limite connue : la détection basique marche bien sur fond contrasté et mal sur fond chargé ([Dynamsoft](https://dynamsoft.com/codepool/web-document-scanner-with-opencvjs.html)). OpenCV.js pèse lourd (**[Estimation]** 8-10 Mo) : le charger **à la demande**, uniquement si l'angle est fort. Alternative légère : estimer l'inclinaison à partir des boîtes du détecteur (médiane des angles), puis rotation sur canvas (cf. `DeskewService` de ppu-ocv).
5. **Binarisation adaptative** (Sauvola/Otsu local) : **utile pour Tesseract, inutile voire nuisible pour Paddle**, qui préfère du gris normalisé. À ne garder que dans le plan B Tesseract.
6. **Relecture par zones** : relancer la reconnaissance sur les boîtes à faible confiance avec agrandissement ×2 et contraste local (CLAHE). Le coût reste faible car ces zones sont rares.
7. **Guidage de prise de vue en direct** (le plus rentable côté qualité d'entrée) :
   - cadre-guide au format étiquette (A6, 4×6") ;
   - **détection de flou** : variance du Laplacien sur une image réduite à 320 px, toutes les 150-200 ms, avec message « Ne bougez plus » ;
   - **détection de reflet** : part de pixels saturés (> 250) en amas, avec message « Inclinez légèrement » ;
   - **capture automatique** quand l'image est nette, stable sur N images et que le code-barres est déjà décodé dans le flux (signal fort que le cadrage est bon) ;
   - torche proposée seulement en faible luminosité.
8. **Capture multi-images** : 2-3 images successives (ou une image par moitié d'étiquette pour les grands formats), puis **vote par champ** (même suivi, même destinataire). Contre les reflets, deux angles différents suffisent : le reflet ne tombe pas au même endroit.
9. **Post-traitement métier** (décisif pour l'expéditeur et le destinataire) :
   - **destinataire** : correspondance floue (Jaro-Winkler / trigrammes) avec **l'annuaire interne** des salariés et services, disponible hors ligne. Un OCR à 85 % suffit alors à retrouver la bonne personne ;
   - **expéditeur** : ancres textuelles (`FROM`, `SHIPPER`, `EXPÉDITEUR`, `SENDER`, `ABSENDER`, `RETURN ADDRESS`) + position (en haut à gauche pour UPS/FedEx) + **liste des expéditeurs déjà vus** (apprise au fil des validations) ;
   - **gabarits par transporteur** (le transporteur vient du code-barres) avec des zones attendues relatives au cadre de l'étiquette.

---

## 5. Pipeline recommandé pour la v2

### 5.1 Pipeline principal (100 % on-device, hors ligne)

| # | Étape | Librairie | Budget temps iPhone 15/16 **[Estimation]** |
|---|---|---|---|
| 0 | Prévisualisation guidée, détection de flou et reflet, capture auto (flux `getUserMedia` unique et persistant). Repli : `<input capture="environment">`. | Canvas + Worker maison | (avant le chrono) |
| 1 | Redimensionnement à ~1600 px de grand côté, conservation de l'original | `createImageBitmap` / OffscreenCanvas | 50 ms |
| 2 | **Codes-barres** (Code 128, DataMatrix, PDF417, MaxiCode, QR) → suivi + transporteur | **zxing-wasm** (Worker) | 100-300 ms |
| 3 | Orientation globale 0/90/180/270 | **PP-LCNet_x1_0_doc_ori** (ONNX) | 30-80 ms |
| 4 | Inclinaison et perspective : angle médian des boîtes. Si l'angle est fort ou la perspective marquée, jscanify (lazy-load). | ppu-ocv / jscanify | 0-400 ms |
| 5 | Détection de texte (quadrilatères) | **PP-OCRv5 mobile det** (ou v6 tiny/small après bench) | 200-600 ms |
| 6 | Reconnaissance par ligne + rotation des lignes verticales + classifieur 0/180 | **PP-OCRv5 mobile rec latin** (ou v6 small, multilingue avec accents) | 400-1 500 ms |
| 7 | Reconstitution des blocs (regroupement spatial), extraction : regex suivi/compteur, ancres expéditeur/destinataire, gabarit transporteur | TS maison | 20-50 ms |
| 8 | Correspondance floue destinataire ↔ annuaire, expéditeur ↔ historique | `fuse.js` ou trigrammes maison | 10-30 ms |
| 9 | Score de confiance par champ, puis formulaire pré-rempli. Si faible et en ligne : renfort cloud (§3.4). | — | — |
| | **Total on-device** | | **≈ 1-3 s** (cible < 5 s tenue avec marge) |

Notes d'implémentation :
- Toute l'inférence dans un **Web Worker** pour garder l'UI fluide. onnxruntime-web en **WebGPU si disponible, sinon WASM**. Le WASM multithread exige **COOP/COEP** (cross-origin isolation, **[Fait]** README ppu-paddle-ocr) : à configurer sur l'hébergement de la PWA.
- **Préchauffer** les sessions ONNX au lancement de l'app (création de session + inférence à blanc) : sinon la 1ʳᵉ photo paie 1-2 s de compilation **[Estimation]**.
- Garder **un seul modèle chargé à la fois si la mémoire est tendue**. Viser moins de 250 Mo de pic (cf. bugs WebKit §1.1).

### 5.2 Cache hors ligne (Service Worker / Cache Storage)

| Élément | Taille |
|---|---|
| PP-OCRv5 mobile det + rec | ~12 Mo **[Fait]** (v6 small : ~30 Mo) |
| PP-LCNet doc_ori (+ textline_ori) | ~7 Mo (+ ~1-6,5 Mo) **[Fait]**, chiffres contradictoires selon les sources |
| onnxruntime-web (binaires WASM / WebGPU) | **[Estimation]** 10-25 Mo |
| zxing-wasm (lecteur) | ~1 Mo **[Fait]** |
| OpenCV.js (optionnel, chargé à la demande) | **[Estimation]** 8-10 Mo |
| Annuaire + historique expéditeurs (IndexedDB) | < 1 Mo |
| **Total** | **≈ 30-55 Mo** (contre ~10-20 Mo en v1), largement dans les quotas Safari 17+ |

Versionner les modèles par URL avec hash, les télécharger **au premier lancement en Wi-Fi** avec une barre de progression, et appeler `navigator.storage.persist()`.

### 5.3 Plan B (si PaddleOCR/ORT ne tient pas sur iPhone : crash mémoire, WebGPU instable, temps > 5 s)

1. Conserver **les étapes 0, 1, 2, 7, 8, 9** (guidage, code-barres, parsing, annuaire, cloud), qui apportent l'essentiel du gain quel que soit le moteur.
2. Remplacer 3 à 6 par **Tesseract.js v7** (build relaxed-SIMD) avec :
   - **OSD unique** au lieu de 4 rotations ;
   - redressement jscanify, puis binarisation adaptative ;
   - **OCR par zones** : découper l'étiquette en 2×3 tuiles et lancer Tesseract en mode `PSM 6`/`11` par tuile, avec rotation à 90° des tuiles où peu de texte horizontal est trouvé ;
   - `tessedit_char_whitelist` sur les zones de suivi/compteur.
   Gain attendu **[Estimation]** : 4-8 s, expéditeur mieux trouvé grâce aux ancres et à l'historique, mais nettement moins robuste que Paddle.
3. Ne pas retenir Scribe.js (AGPL-3.0) sans avis juridique.
4. **Repli manuel ultime** : champ texte + « Scanner du texte » (Live Text du clavier iOS) pour le champ manquant.

### 5.4 Plan C / exploration (hors chemin critique)
- **VLM embarqué** (Florence-2 q4, SmolVLM-256M, LFM2-VL) via Transformers.js 4.3+ WebGPU Safari 26 : à tester sur 30 étiquettes en mode « extraction JSON directe ». À n'adopter que si la qualité dépasse Paddle + règles **et** que le pic mémoire reste < 300 Mo.
- **App native légère** (Swift, VisionKit `DataScannerViewController` + `VNRecognizeTextRequest`) si un jour la PWA ne suffit plus. OCR Apple gratuit, rapide, multi-orientation, mais il faut sortir du modèle PWA (distribution MDM/TestFlight).

### 5.5 Validation proposée avant d'engager le développement
1. Constituer un **jeu de 50-100 photos réelles** (au moins 6 transporteurs, reflets, inclinaisons, texte vertical), annoté à la main : suivi, transporteur, destinataire, expéditeur, nb colis.
2. Banc d'essai sur **iPhone réel** (iPhone 12, le plus ancien supporté, + un récent) en PWA standalone : Tesseract v7 vs Paddle v5 mobile vs Paddle v6 tiny/small, en WASM et en WebGPU. Mesurer temps p50/p95, pic mémoire et exactitude par champ.
3. Même jeu passé en cloud (Haiku 5.5, Gemini Flash-Lite via Vertex UE, Mistral OCR) pour calibrer le seuil de confiance du mode hybride.

---

## Sources principales (consultées le 21/10/2026)
- WebKit — Safari 26 / WebGPU : https://webkit.org/blog/16993/news-from-wwdc25-web-technology-coming-this-fall-in-safari-26-beta/
- WebKit — politique de stockage : https://webkit.org/?p=14403
- WebKit bugs : 281848 (Shape Detection iOS), 280970 (torch), 215884 / 212040 / 245962 / 273938 (getUserMedia standalone), 269777 / 221530 / 222097 (mémoire WASM) — https://bugs.webkit.org/
- Transformers.js releases : https://github.com/huggingface/transformers.js/releases
- onnxruntime-web : https://npmjs.com/package/onnxruntime-web
- WebNN (Chromium) : https://groups.google.com/a/chromium.org/g/blink-dev/c/5CWKSChYo98
- Tesseract.js v6 / v7 : https://newreleases.io/project/npm/tesseract.js/release/6.0.0 , https://newreleases.io/project/npm/tesseract.js/release/7.0.0
- Scribe.js : https://github.com/scribeocr/scribe.js , https://docs.scribeocr.com/tesseract_users.html
- ppu-paddle-ocr : https://github.com/PT-Perkasa-Pilar-Utama/ppu-paddle-ocr
- PP-OCRv6 : https://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv6/PP-OCRv6.html
- PP-LCNet orientation : https://huggingface.co/PaddlePaddle/PP-LCNet_x1_0_doc_ori , https://www.paddleocr.ai/latest/en/version3.x/module_usage/textline_orientation_classification.html
- OnnxTR : https://github.com/felixdittrich92/OnnxTR
- zxing-wasm : https://cdn.jsdelivr.net/npm/zxing-wasm@3.1.3/README.md
- jscanify : https://github.com/puffinsoft/jscanify
- Apple VisionKit : https://developer.apple.com/documentation/visionkit
- Google Cloud Vision pricing : https://cloud.google.com/vision/pricing
- Gemini pricing / image tokens : https://ai.google.dev/gemini-api/docs/pricing , https://ai.google.dev/gemini-api/docs/image-understanding
- Vertex AI data residency : https://cloud.google.com/vertex-ai/generative-ai/docs/learn/data-residency
- Claude vision / data residency : https://platform.claude.com/docs/en/build-with-claude/vision , https://platform.claude.com/docs/en/build-with-claude/data-residency
- Mistral pricing : https://docs.mistral.ai/models/pricing
- AWS Textract pricing : https://aws.amazon.com/textract/pricing/
- Azure Document Intelligence pricing : https://azure.microsoft.com/en-us/pricing/details/ai-document-intelligence/
- OpenAI GPT-5 mini : https://developers.openai.com/api/docs/models/gpt-5-mini
