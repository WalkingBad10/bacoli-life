# REBUILD 2.0 — Audit asset grafici

Ambito: solo `bacoli-life`, branch `rebuild-2.0`. Analisi **read-only**: non sono stati modificati codice, config, asset o altri progetti; unico file scritto è questo report.

Fonti esaminate: `public/assets/original/**`, `public/assets/scale/**`, `tools/generate_assets*.py`, `tools/m6_tiles.py`, `tools/generate_tileset_m6.py`, `tools/asset_inventory.py`, `tools/extract_original_assets.py`, `docs/M6_ASSET_INVENTORY.md`, `docs/AI_VISION_ANALYSIS.md`, `docs/ORIGINAL_ASSETS_MANIFEST.json`, `docs/SHEET_GRID_READ.json`, `docs/M5_ASSET_AUDIT.md`, `docs/rebuild2/data/REPORT.md`, `src/scenes/BootScene.ts`, `src/scenes/WorldScene.ts`, `src/systems/AssetKeys.ts`.

Metodo: conteggi deterministici con Python 3.12 + Pillow 13 (dimensioni, canale alpha, colori unici, diff tra frame), confronto SHA256 fra `original/` e `scale/`, lettura dei generatori e dei dati OSM della zona campione. Le descrizioni AI sono state usate solo come supporto: `docs/M5_ASSET_AUDIT.md` documenta che il canale vision di `qwen2.5vl:3b` non è affidabile.

---

## 1. Verdetto sulla qualità effettiva

**Verdetto: la segnalazione dell'utente è fondata.** La grafica non è rudimentale perché mancano le tavole: è rudimentale perché **le tavole originali non entrano nel runtime** e il gioco disegna quasi tutto con rettangoli e poligoni generati da `Pillow.ImageDraw`.

Fatti misurati:

- `public/assets/scale/`: **835 PNG**, di cui **487 caricati** a runtime (249 facciate, 144 tetti, 37 ombre, 14 personaggi, 24 prop/veicoli, 17 arredi, 2 tileset); **347 archiviati**, 0 chiavi mancanti (`docs/M6_ASSET_INVENTORY.md`, ricalcolato con `tools/asset_inventory.py`).
- `public/assets/original/`: **99 PNG**. Solo **6** sono byte-identici a un file in `scale/`; **nessun** file di `original/` è caricato per nome da `src/` (`BootScene` legge solo `assets/scale/**` e, per i due animali, `assets/sprites/**`).
- I generatori usano una palette dichiarata di **19 colori** ma con **18 voci effettive** (`tools/generate_assets_scale.py`, `P`): un edificio generato ha **7–12 colori**, un personaggio **8 colori**. Gli originali estratti dalle tavole hanno mediana **10.318 colori** per `Buildings`, **34.715** per `Shops`, **21.023** per `Interiors`: sono immagini dipinte/renderizzate, non pixel art a 16 px/m.
- Il confronto con la zona campione (`docs/rebuild2/data/REPORT.md`) mostra uno **scarto di scala** interno: persona 28 px (ok), porta **24 px vs 34 px attesi**, piano **52 px vs 29 px attesi**, auto **72 px vs 64 px**, autobus **192 px vs 176 px**.
- L'alpha è formalmente corretto (RGBA, sprite con fondo trasparente e ombre semitrasparenti), ma le facciate generate sono **rettangoli 100% opachi** (`building_432_3_0.png`: alpha 255 su tutto) e le facciate originali hanno copertura mediana **0,441** con buchi e alone.
- Prospettiva: il suolo è ortho/top-down 16×16 px, gli edifici sono **billboard frontali** ancorati in basso, i tetti sono strisce separate e i veicoli sono viste laterali **ruotate di qualsiasi angolo** (`WorldScene.ts:1330`). È un ibrido, non una prospettiva coerente.

Aspetti positivi da conservare: griglia 1 m = 16 px, tileset M6 con autotiling e GID legacy stabili (`m6_tiles.py`), mapping OSM deterministico (`AssetKeys.ts`), presenza nel codice di balconi, persiane, terrazzi, panni, cornicioni, condizionatori e insegne. Il problema è la **qualità di dettaglio e la quantità di varianti**, non l'assenza totale degli elementi.

---

## 2. Asset recuperabili vs da ricostruire

### 2.1 Recuperabili subito (già nel runtime, contenuto identico)

| File originale | Chiave runtime | Dimensioni | Nota |
|---|---|---|---|
| `public/assets/original/Vehicles/car_a.png` | `car_white.png` | 72×40 | SHA256 identico |
| `public/assets/original/Vehicles/car_b.png` | `car_blue.png` | 72×40 | SHA256 identico |
| `public/assets/original/Harbor/boat.png` | `boat.png` | 128×48 | SHA256 identico |
| `public/assets/original/Stations/station_eav.png` | `station_eav.png` | 192×80 | SHA256 identico; derivato da foto, non da tavola |

`Stations/platform.png` (192×24) e `Stations/rail.png` (192×16) sono byte-identici alle controparti `scale/` ma **non sono caricati** da `BootScene`: recuperabili con una chiave, non con un ritaglio.

### 2.2 Recuperabili dopo ripulitura o come riferimento artistico

| File | Stato | Azione |
|---|---|---|
| `public/assets/original/Buildings/facade_1_1..4.png`, `facade_3_1..4.png` (208×160) | copertura mediana 0,59; ~10k colori; larghezza fissa | usare come **moduli artistici** (balconi, fiori, cornicioni), non come drop-in: il runtime usa 37 larghezze da 96 a 1088 px |
| `public/assets/original/Shops/shop_bar.png`, `shop_cafe.png`, `shop_restaurant.png`, `shop_trattoria.png` (256×192) | 4–10 componenti, alone alpha; 29k–35k colori | riferimento per vetrine/tende/insegne; serve uno slot runtime per i POI commerciali |
| `public/assets/original/UrbanProps/arch_flowers_b.png`, `bench.png`, `drain.png` | bbox 67–94%, semitrasparenza 15–22% | soglia alpha binaria + decontaminazione, poi nuove prop |
| `public/assets/original/Interiors/kitchen_2.png` | bbox 72%, geometria buona | riferimento per arredi; il motore usa `f_*`, non sfondi |
| `public/assets/original/Buildings/church.png` | versione manifest peggiore (residui di sfondo) | **riestrarre** dalla cella (0,3)/(1,3), non riutilizzare il file attuale |
| `public/assets/original/Roads/*`, `Beach/*`, `Buildings/stone_wall_a..g` | opache, dimensioni 64×64 / 128×96 | **non tileabili** (discontinuità ai bordi); usare come decal singoli o cucire i bordi |
| `docs/source_assets/sheets/b3b88625-*.png`, `fb51c0b3-*.png`, `f5b6326b-*.png` (1536×1024) | tavole 4×4 / 3×3 / 4×10 | fonte primaria da riestrarre con alpha sorgente; oggi solo referenza |
| `docs/source_assets/photos/*.png` (9 foto) | prospettiche, 525×394 … 3984×2656 | palette/volumi; solo la stazione EAV ha prodotto un asset |

### 2.3 Da ricostruire

| Gruppo | File/chiavi | Motivo |
|---|---|---|
| Edifici | `public/assets/scale/building_*.png` (592), `roof_*.png` (148), `shadow_*.png` (37) | 4 varianti, 19 colori, nessun lato/sfondatura; i 4 piani generati non sono mai usati dai dati OSM |
| Personaggi | `player.png`, `npc_1..12.png`, `npc_fisher.png` (64×128) | 8 colori, 2 sole pose uniche, direzioni quasi identiche |
| Veicoli | `car_*.png`, `bus.png`, `train.png`, `moto.png` | vista laterale ruotata, nessuna vista frontale/rear/top |
| Interni | `f_*.png` (17) | rettangoli sfumati; le scene `Interiors/` non hanno slot |
| Terreno | `tileset.png`, `room_floors.png` | logica autotiling valida, texture piatte e ripetitive |
| Animali | `public/assets/sprites/pet_dog.png`, `pet_cat.png` | unica grafica legacy ancora caricata, non in scala M6 |

Nota: `public/assets/ai/` contiene un solo file (`roof_terracotta.png`, 16×16) generato da Pollinations e **non caricato**; la pipeline AI di `tools/generate_ai_assets.py` non è entrata nel prodotto.

---

## 3. Cause strutturali della grafica rudimentale (con evidenze)

1. **Le tavole sono fuori dal percorso di caricamento.** `BootScene.preload()` (`src/scenes/BootScene.ts:47-79`) carica `assets/scale/*`, `assets/maps/*` e `assets/sprites/pet_*`; in `src/` non esiste alcun riferimento a `assets/original`, `shop_*`, `facade_*`, `stone_wall_*`, `water_texture` o `kitchen_*`. Risultato: 99 originali su disco, 0 usati come file.
2. **L'estrazione butta via l'alpha buono e lo ricostruisce male.** `tools/extract_original_assets.py:141-170` converte la cella in RGB, stima il fondo e usa `cv2.grabCut`, poi morfologia e componenti ≥20 px; `fit_sprite()` usa `ImageOps.contain(..., LANCZOS)` con `align="bottom"` (`:187-193`). Copertura mediana 0,441, minimo 0,0204; 4 celle catastrofiche (`door_stone` vuoto, `tree_c` 97% sfondo, `pergola_b` 69%, chiesa 34%). `docs/M5_ASSET_AUDIT.md` riporta 25/53 sprite con contenuto sotto il 60% dell'altezza. Le tavole invece **hanno già un alpha utilizzabile** (foglio 3: 61,5% semitrasparente).
3. **Diffusione di scala incompatibile.** `facade_*` sono 208×160 = 13 m × 10 m visivi; il runtime genera 37 larghezze (96–1088 px) e 4 piani (56/108/160/212 px). Delle 592 facciate generate, solo 249 combinazioni sono referenziate da OSM e il valore `floors=4` non compare mai nei dati. `shop_*` sono 256×192 ma non esiste una chiave `shop_*`: i bar/ristoranti sono marker (`cafe_table`, `umbrella`, `street_sign` — `WorldScene.ts:674-684`).
4. **Il generatore M6 è più povero del suo predecessore.** `tools/generate_assets_scale.py` ha 4 varianti, 18 colori effettivi, una sola insegna «BAR» in glyph 3×5 (`:369-379`). `tools/generate_assets.py:418-472` aveva 12 stili, 6 layout, cinque parole (`BAR`, `CAFFE`, `PIZZA`, `RIST`, `NEGOZIO`), riflessi del mare, panni e balconi arredati; quel generatore è stato accantonato per errori di scala ma la sua ricchezza artistica non è stata riportata nel nuovo.
5. **Dettagli presenti ma minimizzati.** In `generate_assets_scale.py`: `balcony()` è una lastra 38×3 + ringhiera 6 px (`:277-288`); `win()` ha persiane da 2 px e 5 listelli (`:239-262`); `terrace_parapet()` 3 px + puntelli 5 px (`:323-329`); `laundry_line()` 1 px di corda e fino a 4 rettangoli 7×5-8 (`:299-310`); `ac_unit()` 14×9 (`:313-320`); il cornicione è 4 px (`:191, 226-233`). Sono elementi «di supporto», non dettagli leggibili.
6. **Prospettiva ibrida.** Il tileset (`m6_tiles.py`) è top-down 1 tile = 1 m; le facciate sono rettangoli frontali con `setOrigin(0.5, 1)` e profondità `y` (`WorldScene.ts:706-713`); il tetto è un rettangolo 24 px separato. I veicoli ricevono `vehicle.angle = atan2(...)` e `setFlipX(dx < 0)` (`:1330-1338`): un sprite laterale ruotato e specchiato non può rappresentare correttamente le 8 direzioni.
7. **Animazioni 4 direzioni solo sulla carta.** `BootScene.ts:60-64,83-91` carica fogli 64×128 e crea 4 animazioni da 4 frame 16×32. Misurando `player.png`: i frame 0 e 2 della stessa riga sono identici (2 pose uniche); la riga 1 differisce dalla riga 0 di soli 4 pixel e la riga 3 di 4 pixel. Inoltre `person()` disegna `direction==2` come **di spalle** e `direction==3` come profilo, mentre `DIRECTIONS = ['down','left','right','up']` mappa riga 2 su «right» e riga 3 su «up»: destra e alto sono scambiati.
8. **Strumentazione povera e frammentata.** Il prodotto finale è quasi interamente `Pillow.ImageDraw`; OpenCV/NumPy servono solo a estrarre/analizzare (`extract_original_assets.py`, `inspect_asset_sheets.py`, `extract_asset_sheets.py`); Ollama `qwen2.5vl:3b` è usato come supporto descrittivo e giudicato inaffidabile per la visione; Pollinations ha prodotto 1 asset inutilizzato. Non risultano file, script o dipendenze per **LibreSprite, Pixelorama o ImageMagick** in `README.md`, `package.json` o `tools/`. Esistono tre generatori di tileset sovrapposti (`generate_assets.py`, le funzioni `t_*` di `generate_assets_scale.py`, `m6_tiles.py`): solo quest'ultimo scrive il `tileset.png` effettivo (`:1260-1262`), fonte di drift.

---

## 4. Piano di ricostruzione per la zona campione

Zona: `docs/rebuild2/data/osm_baia_sample.osm`, bbox 14.0788,40.8008–14.0828,40.8062; 205 edifici, 49 strade, 23 POI, 887 nodi/1886 archi, 363,8 × 834,4 m → **5820 × 13350 px a 16 px/m**.

| Fase | Azione concreta | Criterio di accettazione |
|---|---|---|
| A. Contratto di scala | Fissare: suolo 16 px/m, persona 28 px, porta 34 px, piano visivo 29 px, auto 64 px, autobus 176 px (valori di `REPORT.md`). Allineare `FLOOR_PX` da 52 a 29 e ricalcolare le altezze dei 205 edifici. | Nessun edificio con porta più bassa del personaggio; differenze <5% sui cinque riferimenti |
| B. Riestrazione tavole | Ripartire dai 3 file `docs/source_assets/sheets/*.png` usando l'alpha sorgente (soglia binaria, rimozione alone, ritaglio sul bbox); **non** GrabCut su RGB e non LANCZOS; nearest neighbor a multipli di 16 px. Rifare `door_stone`, `tree_c`, `pergola_b`, chiesa. | Copertura ≥70%, semitrasparenza ≤8%, componenti ≤2 per sprite |
| C. Kit di facciate ortografiche | Costruire moduli frontali (nessuna prospettiva) da combinare per larghezza OSM: intonaco/mattoni/tufo/colorato; finestra 14×20 con persiane 3 px; porta 14×34; balcone 38×8 con ringhiera e 2 fioriere; cornicione 4 px; parapetto terrazzo; pluviale; panni 7×6; condizionatore 14×9; insegne 5×7 (`BAR`, `CAFFE`, `PIZZA`, `RIST`). | Almeno 3 varianti riconoscibili per tipologia; zero facciate ottenute da singolo rettangolo pieno |
| D. Vetrine commerciali | Usare `shop_bar/cafe/restaurant/trattoria` come riferimento per moduli bar/pizzeria (tenda a strisce, vetrina, forno, insegna leggibile); collegare il modulo al POI OSM invece del marker `cafe_table`/`umbrella`. | I 23 POI della zona campione mostrano un volto commerciale coerente |
| E. Personaggi e veicoli | Fogli 64×128 con **4 direzioni visivamente distinte** (≥20 px di differenza tra righe) e 4 frame reali; correggere la mappa righe `down/left/up/right`. Veicoli a 64×36 (auto) e 176×44 (bus) con sprite per direzione/orientamento, non rotazione di vista laterale. | Nessuna riga duplicata; nessun veicolo specchiato/ruotato in modo non fisico |
| F. Suolo e arredo | Rendere tileabili le texture di `Roads/`, `Beach/`, `stone_wall_*` (cucitura dei bordi) e integrarle nel GID di `m6_tiles.py`; aggiungere come decal `arch_flowers_b`, `fountain`, `stairs_flowers`, `fence_metal_*` dove il grafo OSM lo consente. | Nessuna discontinuity >10 livelli RGB ai bordi dei tile |
| G. QA visiva | Screenshot della zona campione a 5820×13350 (viewport campione), confronto con le 9 foto e con i colori dominanti di `AI_VISION_ANALYSIS.md`; misurare alpha, bbox, conteggio colori e diff frame. | Report con numeri, non solo giudizio «OK»; niente rettangoli colorati come facciata finale |

Il piano richiede modifiche a generatore e hook runtime: **non eseguite in questo audit**, che resta documentale.

---

## 5. Inventario minimo richiesto

Target in pixel a 16 px/m; fra parentesi lo stato attuale.

| Dominio | Asset minimo | Dimensioni target | Stato oggi |
|---|---|---|---|
| **Bar** | facciata modulo 16 m con vetrina; porta 14×34; 2 finestre 14×20 + persiane; tenda a strisce 160×12; insegna «BAR» ≥24×8; 2 tavolini 16×12 + sedie 8×12; ombrellone 32×40; condizionatore 14×9; interno: pavimento 16×16, bancone 80×24, espresso 16×20, cassa 14×16, mensola 32×16, frigo 20×32 | modulo assente; POI = `cafe_table` | `shop_bar.png` (256×192) solo referenza; `scale/f_espresso/register/shelf/fridge` esistono ma sono rettangoli |
| **Pizzeria** | facciata con vetrina + tenda + insegna «PIZZA»; forno a legna 48×32 (esterno visibile o interno); bancone 80×24; 4 tavoli 32×20 + 8 sedie; mensola legna 32×16; porta 14×34; panni/piante sul balcone se presente | modulo assente; POI = `umbrella` | `shop_restaurant.png`, `shop_trattoria.png` referenza; nessun forno dedicato |
| **Casa** | 3 facciate (intonaco / mattoni / tufo) per larghezza OSM multipla di 16; finestra 14×20 con persiane 3 px e fioriera; porta 14×34; balcone 38×8 con ringhiera + 2 piante; cornicione 4 px; parapetto terrazzo; pluviale 2 px; panni stesi 7×6; condizionatore 14×9; tetto 24 px (piano / tegole) + ombra | `building_*.png` 592 con 4 varianti, finestre 14×16, porta 16×24, piano 52 px | ricostruire da zero sul kit della fase C |
| **NPC** | foglio 64×128 per ogni variante: 4 direzioni × 4 frame, figura 28 px, ombra separata; almeno 6 silhouette/abiti distinti (residenti, barista, pescatore, turista, lavoratore, bambino) con cappello/accessori; idle 2 frame | 14 fogli esistono ma 2 pose uniche e direzioni quasi identiche | `scale/player.png`, `npc_1..12.png`, `npc_fisher.png` da rigenerare |
| **Veicoli** | auto 64×36 in 3 colori + 4 viste (fronte/retro/destra/sinistra) + ombra; autobus 176×44 (laterale + frontale); scooter 32×20; bicicletta 28×16; moto 32×20; treno 256×44; segmenti stradali e parcheggi già nel tileset | auto 72×40, bus 192×52, treno 320×56, tutti a vista laterale ruotata | `scale/car_*.png`, `bus.png`, `train.png`, `moto.png` da ricostruire; `car_white/blue` e `boat` da conservare |

---

## Evidenze minime ripetibili

- Conteggi: `tools/asset_inventory.py` → 835 file in `scale/`, 487 usati, 347 archiviati.
- Identità byte: SHA256 di tutti i PNG di `original/` contro `scale/` → 6 corrispondenze (`car_a`, `car_b`, `boat`, `platform`, `rail`, `station_eav`).
- Colori/alpha: `Image.open(f).convert('RGB').getcolors()` e `getchannel('A').getextrema()` su un campione di 17 file (facciate generate 7–12 colori e alpha 255; facciate originali ~10k colori e copertura 0,38–0,62; personaggi generati 8 colori e copertura 0,483).
- Frame: diff pixel fra celle 16×32 di `scale/player.png` → `[0, 40, 0, 49]`; diff fra direzioni a frame 0 → `[0, 4, 36, 4]`.
- Proporzioni: `docs/rebuild2/data/REPORT.md` (28 / 34 / 64 / 176 / 29 px) contro `tools/generate_assets_scale.py` (`FLOOR_PX=52`, porta 16×24, auto 72×40, bus 192×52, treno 320×56).
