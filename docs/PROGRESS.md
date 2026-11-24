# BACOLI LIFE — registro progressi

Repository dedicato, indipendente da CAMPANIA LIFE e CAMPANIA CODEX.

Aggiornato: **24 novembre 2026 — milestone 4 pubblicata e verificata live** su https://walkingbad10.github.io/bacoli-life/ (commit `e1788fe`, workflow Pages #9 riuscito, bundle live `index-DAQv4rwW.js`).

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
