# BACOLI LIFE — registro progressi

Repository dedicato, indipendente da CAMPANIA LIFE e CAMPANIA CODEX.

Aggiornato: **25 novembre 2026 — M6 completa e verificata, pronta per la pubblicazione**. Ultima versione pubblicata/verificata: milestone 5, commit `336a5dc`, tag `milestone-5-verified`, Pages run #12. Report finale: `docs/M6_FINAL_QA.md`.

## M6 — chiusura della revisione (25 novembre 2026)

Stato: **completa, stabile e verificata**; la live resta M5 fino al deploy finale.
Report dettagliato: `docs/M6_FINAL_QA.md`. In sintesi:

- build OK; **99/99** test unitari e **64/64** E2E (desktop + mobile emitato).
- validators geografia/mondo/proporzioni/screenshot tutti OK.
- 9 regioni con screenshot M6 dedicati; baseline M5 ripristinata e immutata.
- traffico su grafo OSM, collisioni condivise, arredo regolato, interni
  data-driven, fermate bus EAV reali, avvisi completi e caricamento dinamico.
- bug finali corretti: template B&B/chiesa, stato interno riutilizzato,
  protagonista bloccato dal proprio solido, hook/debug e `update()` durante
  il riavvio con loader.
- backup finale creato prima di commit/tag/push; Pianura non avviata.

## CHECKPOINT M6 — punto esatto da cui riprendere (25 novembre 2026)

Stato storico: **era incompleto quando il checkpoint è stato salvato**. Non è più lo stato corrente; la live resta M5 fino al deploy finale.

### Già fatto in M6
- Backup pre-M6: `bacoli-life-20261125-010000-prima-milestone6.zip` (fuori repo, in `bacoli-life-backups/`).
- Piano operativo completo: `docs/M6_PLAN.md` (fasi 0-12, matrice di rischio E2E, criteri di accettazione).
- Audit integrati: asset originali (4 override sicuri + problemi alpha/GrabCut di `extract_original_assets.py`), geografia/trasporti (doppio sistema di coordinate stazioni, fermate bus mancanti, teletrasporti del traffico), performance/rendering (`scale.on('resize')` e `window.keydown` della HUD non rimossi al restart; `BootScene` precarica 9,4 MB).
- Nuovo tileset M6 `public/assets/scale/tileset.png` **256x256** (16x16 frame), GID legacy 1-16 preservati: asfalto caldo `#5F5E58` invece del nero, basolato lavico, lastricato, cordoli, 16 maschere di adiacenza per classe, segnaletica, attraversamenti pedonali, parcheggi.
- Nuovi moduli: `tools/m6_tiles.py`, `tools/m6_paving.py`, `tools/generate_tileset_m6.py`.
- `tools/build_map_centro.py` e `tools/build_map_regions.py` riscritti per usare autotiling deterministico (zero `(x+y)%n` su strade/marciapiedi), coastline OSM anche in presenza di laghi, e scrittura di `roads.bin` per il futuro grafo stradale.
- `tools/check_proportions.py` aggiornato: `tileset.png` atteso `256x256`.

### Stato generazione al checkpoint
- `python tools/build_map_regions.py` **completato**: 9 regioni metriche, `bacoli_world.json` e tutti i buffer riscritti con autotiling M6. Centro invariato `463x722`, 376 luoghi, 226 edifici; Baia 827 luoghi/740 edifici, Fusaro 882/835, Torregaveta 457/414.
- `roads.bin` ora **per regione** in ogni `public/assets/maps/<regione>/`; il file globale obsoleto è stato rimosso. Il sorgente `build_map_regions.py` è corretto di conseguenza per le prossime rigenerazioni.
- `tools/generate_assets_scale.py` ora scrive anche il tileset M6 e `tileset_m5_legacy.png`; **non rieseguirlo** senza controllare gli override originali (`car_white`, `car_blue`, `boat`, `station_eav`, `platform`, `rail`).

### Da fare subito dopo il ripristino (in ordine)
1. Eseguire validators: `validate_geography.py`, `validate_m5_world.py`, `check_proportions.py`, `check_m5_screenshots.py`; poi `npm.cmd run build`, `npm.cmd test -- --run`, `npm.cmd run test:e2e`.Gli hook/selettori E2E e i vincoli Baia devono restare intatti.
4. **Fase 3 del piano**: screenshot "prima/dopo" della zona campione in `docs/M6_SCREENSHOTS/` (centro storico: strada, palazzi, bar visitabile, auto, pedoni, marciapiedi, arredo). Non dichiarare qualità visiva verificata solo perché i test sono verdi.
5. Fase 4-11 del piano: grafo stradale e traffico senza teletrasporti, collisioni reali, arredo urbanistico, palazzi/personaggi, inventario asset, interni, geografia EAV/bus, caricamento dinamico.

### Istruzioni da conservare integralmente (priorità assoluta)
- Qualità visiva, coerenza urbanistica e fedeltà geografica prima del numero di funzioni. **Sospendere l'espansione territoriale**: non iniziare Pianura né Napoli 80126. Prima una zona campione di qualità elevata nel centro storico, poi estensione alle altre regioni.
- Strade: asfalto realistico pixel art, pietra lavica dove reale, marciapiedi, cordoli, attraversamenti, incroci, segnaletica, parcheggi, raccordi e transizioni naturali asfalto/pietra/terra/erba, autotiling con maschere di adiacenza.
- Traffico: grafo stradale OSM, corsie, sensi unici, percorsi validi auto/moto/autobus, sprite orientati, precedenze, distanze di sicurezza, parcheggi compatibili, fermate autobus, treni solo sui binari; eliminare i teletrasporti di `updateTraffic()`.
- Collisioni reali per edifici, muri, recinzioni, veicoli, alberi, lampioni, panchine, mobili e ostacoli naturali; distinguere collisione a terra da rappresentazione verticale; NPC/protagonista/animali su navigazione coerente; verificare movimento reale via Playwright.
- Posizionamento intelligente di lampioni, panchine, cartelli, fermate, alberi, fioriere, tavolini, barche, cassonetti e parcheggi con controlli spaziali; non riempire zone vuote.
- Palazzi con balconi in ferro battuto, persiane, terrazzi, panni stesi, cornicioni, finestre allineate, portoni, intonaco mediterraneo, tetti, grondaie, insegne, ombre, profondità, condizionatori; geometria OSM senza deformare asset.
- Integrare concretamente le tavole fornite (`docs/source_assets/sheets/`), le 9 fotografie (`docs/source_assets/photos/`) e i 102 asset in `public/assets/original/`: ritagliare/rimuovere sfondo e correggere prospettiva; inventario asset usati vs archiviati in `docs/M6_ASSET_INVENTORY.md`.
- Personaggi originali dettagliati, 4 direzioni, animazioni fluide, WASD corretto, ombre, differenze NPC; prospettiva 2D dall'alto a tre quarti uniforme, Stardew Valley solo come riferimento qualitativo (mai copiare asset), ordinamento profondità sul punto di contatto a terra.
- Strumenti da usare concretamente: Phaser 3, Tiled JSON, OSM/Overpass, Shapely/GeoPandas, LibreSprite/Pixelorama, Python/Pillow/OpenCV, Ollama visivo (solo supporto), Playwright.
- Preservare famiglia, abitazioni, lavoro, veicoli, carburante, animali, trasporti pubblici, interni e salvataggi (`SAVE_VERSION = 4`).
- Hook E2E intatti: `__bacoliDebug`, `__bacoliTest`; selettori `#game canvas`, `#hud-clock`, `#hud-panel.open`, `#hud-save`, `E/T/ESC/WASD/SHIFT`; viaggio `baia_station` da `centro` via `bus_101` con arrivo entro 140 px da `(4296,4096)` px.

### Vincoli tecnici chiave
- `1 m = 16 px`; centro `463x722` tile; `solidTiles = 129975`; player `16x32`; auto `72x40`; bus `192x52`; tetto `roof.height = 24`; overlay label `1m=16px` e `solidi`.
- GID correnti: `GRASS..PAVING = 1..8`, acqua `9..12`, `FLOWERS = 16`; update acqua runtime rileva `tile.index >= 8 && <= 11` — **non spostare** i GID dell'acqua.
- Playwright `workers: 1`; usare `npm.cmd`, non `npm`, su PowerShell.

## Stato attuale della revisione M4

### Fonti geografiche usate concretamente
- `src/data/bacoli_geo.json`, derivato da OpenStreetMap/Overpass: 226 edifici con poligono, 1.478 strade, 284 POI.
- `https://www.openstreetmap.org/search?query=Bacoli` e `https://overpass-turbo.eu/` per edifici, strade e POI del centro storico.
- `https://geoportale.urba.cloud/maps/Stradario%20-%20Comune%20di%20Bacoli/viewer/` per verificare la toponomastica comunale (Via Ortensio e Via Spiaggia).
- `https://commons.wikimedia.org/wiki/Category:Bacoli` e `https://comune.bacoli.na.it/vivere-il-comune/galleria-fotografica/` per il contributo fotografico sull'architettura flegrea.
- `https://sit.regione.campania.it/consultazione-fotogrammi` e `https://www.google.com/maps/search/Bacoli+NA/` consultati come riferimento incrociato; la ricostruzione numerica resta ancorata a OSM.
- Fotografie allegate, copiate in `docs/source_assets/photos/` e analizzate in `docs/NEW_ASSETS_ANALYSIS.json`.

### Mappa metrica
- Area ricostruita: `463 x 722` tile = **463 m x 722 m**, proiezione equirettangolare locale, **1 tile = 1 m**.
- Bounds: `S 40.7995 / N 40.8060 / W 14.0775 / E 14.0830`.
- `30.397` tile strada, **376 luoghi**, **226 edifici OSM reali**, spawn `(324, 478)`.
- `ground.bin` 334.286 B, `collision.bin` 41.786 B, `meta.json`; dataset compatto `bacoli_centro.json` con `bounds` rettangolari invece degli elenchi di tile.
- Nessun edificio inventato: `tools/validate_geography.py` verifica che ogni impronta del dataset corrisponda a un poligono OSM proiettato.
- Larghezze facciata native estese fino a **1088 px (68 m)**; i lotti estesi hanno 1–2 piani, non 3–4, per evitare facciate irreali.

### Asset grafici
- **830 PNG nativi** in `public/assets/scale/`, generati senza `setScale` e con scala universale `1 m = 16 px`: adulto 28 px, piano 52 px, automobili 72x40, bus 192x52, treno 320x56.
- Le tre tavole originali sono in `docs/source_assets/sheets/`; le 9 fotografie in `docs/source_assets/photos/`.
- **102 asset** organizzati in `public/assets/original/` nelle 14 cartelle richieste: Buildings, Roads, Interiors, Vehicles, Trains, Stations, Characters, Animals, Furniture, Shops, Beach, Harbor, Vegetation, UrbanProps.
- Manifest: `docs/ORIGINAL_ASSETS_MANIFEST.json` elenca celle di origine, categoria, dimensione e copertura runtime.
- La rimozione dello sfondo usa GrabCut con seed fisso e bordo di fondo, poi maschera per componenti connesse; le texture opache restano opache.
- Solo le silhouette inequivocabili (automobili e barca) sostituiscono gli asset runtime; gli altri ritagli restano riferimento artistico per non introdurre strip o elementi sospesi.
- La stazione EAV in `Stations/station_eav.png` è stata ricostruita in pixel art originale dalla fotografia della stazione (livrea rossa/bianca, tetto metallico, marciapiede).

### Compatibilità e sistemi
- Tutte le funzionalità M3 conservate: collisioni, through-wall, guida, EAV animati, interni, economia, inventario, animali, relazioni, salvataggi v3 e migrazioni.
- `BootScene` precarica solo le combinazioni facciata/tetto/ombra presenti nel dataset, non il prodotto cartesiano completo.
- `DebugOverlay` attivabile con `G`; hook E2E `__bacoliDebug` e `__bacoliTest` preservati.

## Backup effettuati
- `bacoli-life-20261124-160945-prima-revisione-grafica.zip`
- `bacoli-life-20261124-162610-checkpoint-revisione-grafica.zip`
- `bacoli-life-20261124-221200-prima-estrazione-tavole.zip`

## Verifiche della revisione corrente
- `tools/check_proportions.py`: **OK** · 30 asset campione, 226 edifici, scala 1 m = 16 px.
- `tools/validate_geography.py`: **OK** · 226 impronte OSM, 30.397 tile strada, 376 luoghi.
- `npm run build`: riuscito; bundle `index-BaM0tQR5.js` 1.448,39 kB / gzip 391,13 kB (warning noto chunk > 500 kB).
- `npm test`: **94/94** test unitari verdi (18 file).
- `npm run test:e2e`: **30/30** verdi (15 desktop + 15 Android emulato), inclusi scala universale, collisioni, interni, guida, viaggi EAV e debug overlay.
- QA visiva Ollama: **5/5 screenshot** giudicati `OK` (`SCREENSHOT_VISION_REVIEW.md`); OpenCV conferma presenza di dettaglio in desktop/mobile e debug. Il confronto foto ↔ simulatore (`VISION_COMPARISON_M4.md`) mette a confronto l'analisi della fotografia con il giudizio `OK` dello screenshot; resta un controllo indicativo, mentre la verifica decisiva è E2E.
- Verifica live dopo il deploy: canvas presente, clock `08:02 · G1`, `places: 376`, `solidTiles: 129975`, 40 NPC immessi, hook `__bacoliDebug`/`__bacoliTest` funzionanti, `errors: []`.

## Storico Milestone 3 (versione live verificata)
- Mappa estesa 480x680 tile, 303 luoghi, 61.086 tile strada, coste e laghi reali.
- Collisioni reali, veicoli guidabili, traffico, carburante, viaggi EAV animati, interni camminabili, relazioni, animali, casa/arredi, ciclo giorno/notte, smartphone e salvataggi v3.
- Build milestone 3: bundle 1.366,91 kB / gzip 377,38 kB; **59/59** test unitari e **26/26** E2E verdi.
- Pubblicata e verificata live: commit `596797b`, tag `milestone-3-verified`, https://walkingbad10.github.io/bacoli-life/ .

## Limiti dichiarati
- `building:levels` e `height` assenti negli edifici OSM dell'area: il numero di piani resta una stima esplicita dall'area dell'impronta.
- La sagoma costiera è quella già verificata nel progetto: una nuova query Overpass era andata in timeout HTTP 504.
- Nessun test su smartphone fisico: i controlli touch sono verificati solo in emulazione Android.
- Pianura non ancora costruita: solo architettura dati con `active: false`; si procede solo dopo che Bacoli sarà riconoscibile e proporzionata.
