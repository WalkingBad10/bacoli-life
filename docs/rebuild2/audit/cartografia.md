# Audit cartografico — BACOLI LIFE M6 / REBUILD 2.0

Data: 2026-11-25. Ambito: solo file presenti in `C:\Users\rocka\Documents\Progetto predefinito\bacoli-life`, branch `rebuild-2.0`. Le affermazioni dei documenti sono state trattate come ipotesi e verificate su file, buffer e dati grezzi. Unico file scritto da questo audit: il presente report.

## Aggiornamento checkpoint REBUILD 2.0 (25 novembre 2026)

Il corpo di questo documento resta l'audit storico sulla M6 e sul prototipo iniziale. I numeri
"196 edifici / 49 strade / 887 nodi / 325×639 tile / 3 px/m" sono superati dalla pipeline attuale:

- OSM grezzo: `osm_baia_sample.osm`, 1.120.117 byte, 4100 nodi, 456 way, 15 relation,
  bbox `14.0775,40.7995–14.0830,40.8062`.
- Dataset metrico attuale: 353 edifici, 63 strade, 33 POI, 2 aree naturali/landuse,
  4100 nodi e 8534 archi OSMnx, 432,0 x 773,9 m in `EPSG:32633`.
- Mappa di gioco effettivamente caricata dal runtime separato: `433x774` tile, 16 px/m,
  origine `422176.8877929378 / 4517668.951013729`, 335.142 tile, 64.582 solidi,
  29.737 strade, 13.618 marciapiedi, 376 oggetti Tiled.
- Il runtime REBUILD 2.0 carica davvero `sample.tiled.json`, `meta.json`, `focus.json`,
  `lanes.json`, `collision.bin` e `roads.bin` tramite `src/rebuild2/BootScene.ts`;
  questa parte del vecchio verdetto non è più valida per l'anteprima.
- L'overlay non è più assente né a 3 px/m: `docs/rebuild2/data/osm_reference.png` e
  `docs/rebuild2/audit/overlay.png` sono a 16 px/m con la stessa origine del runtime.
- `docs/rebuild2/audit/overlay_metrics.json` registra IoU edifici minimo 0,9979,
  distanza media centroline 0,3835 m, Hausdorff costa 0,6768 m, scarto POI 0 px e
  3 elementi clippati dichiarati (2 strade, 1 area landcover).
- I piani restano stimati: `area_heuristic_v1=352`, `building:levels=1`; le larghezze
  stradali usano `class default=60`, `tag lanes=3`. I campi `levels_source` e
  `width_source` restano obbligatori in ogni rigenerazione.

Il verdetto storico sotto rimane valido per la M6 pubblicata; per REBUILD 2.0 il confronto
cartografico è ora verificabile entro le soglie dichiarate, fermo restando il giudizio visivo dell'utente.

## 1. Verdetto di fedeltà geografica

**Verdetto: fedeltà parziale, non verificabile come cartografia.** Il progetto di produzione M6 usa coordinate OSM reali come *input*, ma non possiede un sistema di riferimento cartografico condiviso tra sorgente, mappa di gioco e overlay. Il prototipo REBUILD 2.0 introduce un CRS e buffer metrici coerenti solo per la zona campione, senza essere collegato al runtime. La ricostruzione M6 resta una rasterizzazione euristica a 1 tile = 1 metro, non una sovrapposizione verificabile.

Cosa è effettivamente reale:

- Il centro copre `40.7995–40.8060 N`, `14.0775–14.0830 E` e produce `463×722` tile (`tools/build_map_centro.py:44-52`), con `1,001 m/tile` in X e `1,000 m/tile` in Y: 226 edifici OSM, 30.397 tile di strada, 256 luoghi, 30 marcatori (`src/data/bacoli_world.json`, regione `centro`). Il validatore conferma che i rettangoli `bounds` delle impronte rasterizzate coincidono con i rettangoli delle impronte OSM proiettate (`tools/validate_geography.py:31-60`), non che i poligoni siano identici.
- Il mondo M5 pubblica 9 regioni, 3.800 luoghi, 3.460 edifici, 372.311 tile di strada (`src/data/bacoli_world.json`). Le 9 regioni derivano da 10 zone OSM grezze (`tools/generated/m5_osm_raw.json`: 1.437 strade, 4.770 edifici, 921 POI, 19 elementi acqua, con sovrapposizioni).
- `docs/rebuild2/data/osm_baia_sample.osm` contiene 2.811 nodi, 271 way, 13 relation (829.368 byte) e copre esplicitamente Via Ortensio e Via Spiaggia (`docs/rebuild2/data/sample_roads.geojson:12,17,18,26,50`). La pipeline REBUILD 2.0 proietta davvero in `EPSG:32633` con PyProj/GeoPandas/OSMnx (`tools/rebuild2_build_geo.py:67-77,139-150`). Il prototipo successivo `tools/rebuild2_build_tiled.py:122-275` genera `public/rebuild2/maps/sample/sample.tiled.json`: 325×639 tile, 16 px/m, 210 footprint object e CRS `EPSG:32633` nelle properties; copre però solo i bounds degli edifici del campione (`:129-131`), non l’intero bbox centro.

Cosa impedisce di parlare di fedeltà cartografica:

- **Nessun overlay geografico nel gioco di produzione.** Ogni cartella in `public/assets/maps/<regione>/` contiene solo `ground.bin`, `collision.bin`, `roads.bin`, `meta.json`; `BootScene.ts:52-56` carica solo questi buffer. `DebugOverlay.ts:3-10,91-98` disegna griglia, tile solidi e **rettangoli** delle impronte presi da `place.bounds` (`WorldScene.ts:548-553`), non vettori OSM. Il prototipo `public/rebuild2/maps/sample/meta.json:1-11` e `tools/rebuild2_build_tiled.py:249-265` pubblicano poligoni e CRS per il campione, ma nessun file in `src/**/*.ts` li carica (verifica grep dedicata); `docs/rebuild2/data/osm_reference.png` è a **3 px/m** (`tools/rebuild2_render_reference.py:12-13`), non alla scala di gioco 16 px/m.
- **La metrica non è condivisa.** Solo 4 regioni sono ~1 m/tile; le altre 6 sono anisotrope pur dichiarando `metersPerTile: 1` e `projection: "equirectangular locale, 1 tile = 1 metro"` (per esempio `public/assets/maps/baia/meta.json:9-18`).
- **La geometria viene semplificata due volte.** Prima in fase di rasterizzazione (raggi stradali per classe, piani stimati, facciate snap), poi in fase di rendering (sprite e collisioni rettangolari).

Conclusione: il centro storico M6 è una buona *rappresentazione ispirata* a OSM; per la mappa di produzione non è possibile rispondere in modo verificabile alla domanda “questa strada/edge/costa corrisponde davvero alla carta?” sovrapponendo la mappa di gioco alla cartografia reale. Il prototipo REBUILD 2.0 fornisce una base metrica solo per il campione, ma non copre l’intero centro ed è scollegato dal runtime. Per Via Ortensio, Via Spiaggia e centro storico serve la pipeline a coordinate metriche condivise descritta al §4.

## 2. Carenze strutturali

| # | Carenza | Evidenza verificata (`file:line` + numeri) | Effetto sulla fedeltà |
|---:|---|---|---|
| 1 | Proiezione locale non metrica e clamp dimensionale | `tools/build_map_regions.py:285-291` limita `width`/`height` a `64..1100` tile e clampa `to_tile()`. Bbox calcolati da `src/data/bacoli_world.json`: `baia` 1348×1778 m in 1100×1100 tile (**1,225 / 1,616 m/tile**), `fusaro` e `miliscola` 1,000/1,313, `miseno` 1,000/1,616, `torregaveta` 1,072/1,414. `public/assets/maps/baia/meta.json:9-18` dichiara invece 1 m/tile. | Distanze, aree e tempi di percorrenza errati fino a +62% sull’asse nord-sud; nessun CRS comune. |
| 2 | M6 senza overlay/vettori; prototipo REBUILD 2.0 non integrato | `public/assets/maps/*/` ha solo 4 file per regione; `BootScene.ts:52-56` li carica; `DebugOverlay.ts:3-10,91-98` è diagnostico e disegna `strokeRect` da `WorldScene.ts:548-553`. Il prototipo genera `sample.tiled.json` con 4 layer e 210 footprint, CRS `EPSG:32633` e 16 px/m (`tools/rebuild2_build_tiled.py:249-275`; `public/rebuild2/maps/sample/meta.json:1-11`), ma non è referenziato da `src/**/*.ts` e non esiste un `overlay.png` di confronto; `docs/rebuild2/data/REPORT.md:33` dice che la sovrapposizione “sarà generata”. | Non esiste confronto pixel-per-pixel tra cartografia e mappa di gioco M6; il prototipo dimostra la fattibilità solo sul campione. |
| 3 | Strade rasterizzate per classe, non per larghezza OSM | `tools/build_map_centro.py:71-75` usa raggi fissi 1/2/3 tile per `highway`; `:296-315` rasterizza con `radius` e marciapiedi `radius+2` (`:308`). `src/data/bacoli_geo.json` ha 1.478 strade ma **0** con `width`, `lanes`, `maxspeed`, `oneway` o `tags`. Il campione REBUILD 2.0 ha `width_m` (`rebuild2_build_geo.py:45-57`), ma non è usato dal generatore M6. | Via Ortensio è `footway`/`service`/`steps` con 2/5/2 m nel campione (`sample_roads.geojson:12,17,50`), ma nella mappa M6 dipende solo dalla classe. |
| 4 | Poligoni OSM ridotti a sprite e rettangoli | `build_map_centro.py:331-345` calcola impronta, `width`, `depth`, `area`; `:371-381` stima i piani dall’area; `:384` sceglie la facciata più vicina tra larghezze discrete 6–68 m. Verifica: scarto max **4,00 m**, medio **0,24 m**, 1 edificio limitato a 68 m. `WorldScene.ts:648-655,699-712` usa `building_${width}_${floors}_${variant}`; `CollisionSystem.ts:29-34` blocca il rettangolo `bounds`. | La sagoma reale sopravvive solo nel buffer `collision.bin`; vista e collisione attore sono rettangolari. |
| 5 | Costa hardcoded invece della coastline OSM | `tools/build_map.py:43-61` definisce `EAST_COAST` (22 punti) e `WEST_COAST` (14 punti); `build_map_centro.py:33,205-218` e `build_map_regions.py:20,314-336` li riutilizzano. La coastline OSM way `437456521` ha 482 vertici, 56 dentro il centro; distanza dalla polilinea hardcoded: max **114,9 m**, media **50,6 m**, **52/56** vertici oltre 5 m. `M4_SCALE_REVISION.md:41-43` giustifica il riutilizzo con un timeout HTTP 504. | Acqua/sabbia non seguono la costa reale; il dato OSM grezzo era invece disponibile. |
| 6 | Taglio ai bordi e marcatori “fantasma” | `build_map_centro.py:105-108` clampa; `:239-245` filtra solo `x<2 or y<2`, non il bordo est/nord. Nel centro **13** POI finiscono sul bordo (per esempio `place-227` Cento Camerelle a `(462,721)`, `place-232` Farmacia Sant’Anna a `(37,721)`). `build_map_regions.py:232-238,447-457` fa lo stesso: totale **85** place sui bordi. Dati grezzi M5: **319/1437** strade (22,2%), **1184/4770** edifici (24,8%), **107/921** POI (11,6%), **17/19** elementi acqua (89,5%) con almeno un vertice fuori griglia. | Attività e POI compaiono dove la coordinata reale è fuori bbox; intere impronte vengono schiacciate sul bordo. |
| 7 | Stazioni fuori bbox ancorate per approssimazione | `tools/build_map_regions.py:530-549` clampa lat/lon e sceglie la strada più vicina, marcando `approximate`. Quattro casi: `lucrino` (40.8294 > nord 40.826) e `lido_fusaro` (40.82888 > nord 40.826) in `fusaro`; `mercato_sabato` (lon 14.058 < ovest 14.06) in `miliscola`; `cuma_station` (40.84915 > nord 40.819) in `torregaveta`. | Il sistema di trasporto mostra fermate plausibili ma non geograficamente corrette. |
| 8 | Provenance HTTP non affidabile | `tools/collect_m5_geo.py:290-312` interroga un solo endpoint Overpass; `m5_osm_raw.json` registra **10/10** tentativi con `errore: URLError: <urlopen error timed out>`. `docs/M5_GEO_AUDIT.md:18-28` descrive invece 5 endpoint con 502, timeout, DNS failure e mirror vuoto. `collect_m5_geo.py:361-406` scrive **49** voci con `http_status: "HTTP 200"` letterale senza eseguire richieste; `docs/M5_GEO_AUDIT.md:61` le definisce “URL effettivamente richiamati (59 voci)”. | Le fonti dichiarate non dimostrano la verifica; solo 10 richieste OSM API sono state realmente eseguite dallo script. |
| 9 | Piano/altezze inventato due volte, in modi diversi | `src/data/bacoli_geo.json` ha 226 edifici ma solo **1** con `building:levels` e **0** con `height`. `build_map_centro.py:371-381` stima 1/2/3 piani dall’area; distribuzione centro: 1 piano=15, 2 piani=160, 3 piani=51. In REBUILD 2.0 `rebuild2_build_geo.py:92-100` scrive `levels=0` per tutti; **0/196** edifici del campione hanno piani o altezza, mentre `docs/rebuild2/data/REPORT.md:26` afferma che siano stimati dall’area. | Il numero di piani non è una misura né una regola coerente; è un’euristica non tracciabile. |
| 10 | Validatori che non verificano la geografia | `tools/validate_geography.py:31-60` confronta solo rettangoli di footprint; `:66-80` controlla soglia `roadTileCount>=20000`, presenza del nome e stringhe sorgente; `:82-92` verifica coordinate intere e dentro griglia. `tools/validate_m5_world.py:52-106` controlla buffer, scala, spawn, ID, bounds e `floors` 1–4; `:108-115` cerca stringhe tipo `openstreetmap`, `overpass`. | I test passano anche con costa sbagliata, larghezze inventate, clamping e assenza di overlay. |
| 11 | Residuo M4 non metrico e zone non pubblicate | `tools/build_map.py:32-34` usa bbox `40.7770–40.8450 / 14.0400–14.0960` in `480×680` tile (~10–11 m/tile); `:43-61` coste hardcoded; `:208-217` laghi a 20 vertici sintetici; `:330-374` palazzi procedurali 2×2/3×3 tile. `src/data/bacoli_places.json` ha 315 luoghi con 243 nomi procedurali. `m5_osm_raw.json` contiene anche `pianura` e `napoli_80126`, ma `bacoli_world.json` pubblica 9 regioni; `docs/M6_PLAN.md:4-6` conferma Pianura/Napoli non giocabili. | Il vecchio mondo non deve essere recuperato come geografia; due zone grezze restano fuori gioco senza documentazione di scopo. |
| 12 | Nessuna altimetria o pendenza | Nessun uso di DEM, `heightmap`, `elevation`, `slope` o proiezione altimetrica nei sorgenti `src/**/*.ts` e `tools/**/*.py` (verifica grep dedicata). `docs/rebuild2/data/sample_roads.geojson:50` contiene una `steps` di Via Ortensio, ma il mondo è piano. | I dislivelli reali di Via Ortensio e delle altre strade non sono rappresentabili. |

## 3. Cosa recuperare e cosa riscrivere

### Da recuperare come input veri

- `docs/osm_bacoli_raw.json` (1.424.294 byte) e `src/data/bacoli_geo.json` (1.093.672 byte: 1.478 strade, 284 POI, 226 edifici): conservare come snapshot storico del centro, non come sorgente finale non documentata (`tools/osm_to_map.py:16,32`).
- `tools/generated/m5_osm_raw.json` (5.082.509 byte): 10 zone, 1.437 strade, 4.770 edifici, 921 POI, 19 elementi acqua. Riutilizzare i dati, ma **non** le voci `sources` con `HTTP 200` fittizio.
- `docs/rebuild2/data/osm_baia_sample.osm` e i relativi GeoJSON/grafo: 196 edifici, 49 strade, 23 POI, 887 nodi, 1.886 archi, `EPSG:32633` (`docs/rebuild2/data/REPORT.md:3-15`). È il miglior nucleo verificabile per Via Ortensio/Via Spiaggia.
- `tools/rebuild2_build_tiled.py:122-275` e `public/rebuild2/maps/sample/`: prototipo già metrico (325×639 tile, 16 px/m, CRS `EPSG:32633`, layer `footprints`, `gid_manifest.json`): da estendere a tutto il bbox centro e integrare nel runtime, non da riscrivere da zero.
- `tools/rebuild2_fetch_osm.py:11-23` (download OSM API reale) e `tools/rebuild2_build_geo.py:45-77,139-150` (larghezze da `width`/`lanes`, proiezione PyProj, GeoJSON e grafo OSMnx): da estendere a tutta l’area target.
- `tools/collect_bus_stops.py:24`: 67 fermate bus OSM reali, 6 nel centro tutte dentro bbox; da mantenere come POI puntuali.
- `tools/validate_geography.py` e `tools/validate_m5_world.py`: da conservare come *harness* e poi estendere con i controlli del §4.

### Da riscrivere

- `tools/build_map_centro.py` e `tools/build_map_regions.py`: eliminare l’equirettangolare locale con clamp, adottare un unico CRS UTM 33N e un unico transform pubblicato; nessun limite 1100 tile; nessuna costa hardcoded; larghezze da tag OSM; piani da tag reali o `null` dichiarato; conservare i vertici dei poligoni.
- `src/scenes/WorldScene.ts:648-712` e `src/systems/CollisionSystem.ts:29-34`: gli sprite possono restare, ma collisione e overlay devono usare i poligoni proiettati, non solo `bounds`.
- `tools/m6_paving.py:21-30,51-141`: l’autotiling è corretto come strata grafica, ma la classificazione delle strade e la segnaletica modulare (`(x*7+y*3+seed)%37` ecc.) non devono essere confuse con geometria stradale.
- `docs/M5_GEO_AUDIT.md`, `docs/M4_SCALE_REVISION.md`, `docs/rebuild2/data/REPORT.md`: correggere provenance HTTP, costa, piani e stato dell’overlay.
- `tools/build_map.py` e `src/data/bacoli_places.json`: archiviare come artefatti M4, non usarli come fonte cartografica.

## 4. Pipeline consigliata per Via Ortensio / Via Spiaggia / centro storico

Obiettivo: una sola coppia di coordinate metriche per OSM, buffer di gioco e overlay di confronto.

1. **Fissare CRS e origine prima di generare qualsiasi tile.**
   - CRS: `EPSG:32633` (UTM 33N, metro).
   - Bbox target: `40.7995–40.8060 N`, `14.0775–14.0830 E` (l’attuale centro, che contiene le due strade).
   - Origine calcolata con PyProj: `E0 = 422181,212 m`, `N0 = 4516909,410 m`, `Nmax = 4517626,093 m`.
   - Griglia UTM risultante: **472×717 tile = 7552×11472 px** a 16 px/m. La griglia attuale `463×722` non è UTM: va sostituita o dichiarata esplicitamente come proiezione affine anisotropa.
   - Regola: `tile_x = floor((E - E0) / 1 m)`, `tile_y = floor((Nmax - N) / 1 m)`, `pixel = tile × 16`.

2. **Rifare il fetch con provenance reale.**
   - Estendere `tools/rebuild2_fetch_osm.py` al bbox target con margine, salvare XML grezzo + timestamp + status HTTP + hash.
   - Non scrivere `HTTP 200` senza `urlopen`; se Overpass fallisce, registrare l’errore vero e usare solo l’API OSM 0.6 (`collect_m5_geo.py:335-340`).
   - Il sotto-bbox REBUILD 2.0 (`14.0788,40.8008–14.0828,40.8062`) copre Via Ortensio e Via Spiaggia ma non tutto il centro: va ampliato.

3. **Proiettare e costruire layer vettoriali verificabili.**
   - PyProj `EPSG:4326 → EPSG:32633`; Shapely per `buffer`, `intersection` e validazione; GeoPandas per scrivere `roads.geojson`, `buildings.geojson`, `water.geojson`, `pois.geojson`; OSMnx per il grafo (`rebuild2_build_geo.py:67-77,139-150`).
   - Mantenere `osm_id`, `name`, `kind`, `width_m` e, campo nuovo, `width_source` (`tag width` / `lanes` / default dichiarato).
   - Strade: `buffer(width_m/2)` in metri, non raggio per classe. Via Ortensio nel campione ha 2 m (`footway`/`steps`) e 5 m (`service`) (`sample_roads.geojson:12,17,50`); Via Spiaggia 7 m (`residential`, `:26`).
   - Edifici: poligoni proiettati; collisione dal poligono; sprite solo come apparenza. Piani da `building:levels`/`height`; se assenti, `floors: null` e regola dichiarata, non numero inventato.
   - Costa/acqua: clipping della coastline OSM e dei waterway, non `EAST_COAST`/`WEST_COAST`.

4. **Rasterizzare in modo deterministico e pubblicare il transform.**
   - In ogni `public/assets/maps/<regione>/meta.json` aggiungere: `crs`, `origin_utm [E0,N0]`, `north_max Nmax`, `geo_bbox`, `tileSizeMeters: 1`, `pixelsPerMeter: 16`.
   - Il prototipo `tools/rebuild2_build_tiled.py:249-275` è già un buon punto di partenza: grid derivata dai bounds, buffer `collision.bin`/`roads.bin`, layer `footprints` e `gid_manifest.json`; va però reso parametrizzabile sul bbox target e allineato al `manifest.json` del punto 1.
   - Pubblicare anche `vector/*.geojson` e `manifest.json` con lo stesso transform. Il formato GeoJSON standard non garantisce CRS custom: il `manifest.json` è la fonte autoritativa del CRS.
   - Nessun clamp silenzioso: gli elementi fuori bbox vanno tagliati dal poligono bbox e conteggiati in `clipped_elements` nel report QA.

5. **Generare overlay di confronto alla scala di gioco.**
   - Portare `tools/rebuild2_render_reference.py` da 3 px/m a **16 px/m**, usando lo stesso `E0/N0/Nmax`; salvare `overlay.png` trasparente con strade, impronte e costa OSM.
   - Il confronto deve essere pixel-per-pixel: `ground.bin`/`roads.bin` da una parte, layer vettoriali dall’altra.
   - Metriche minime da salvare in `docs/rebuild2/audit/overlay_metrics.json`: IoU edifici ≥ 0,95; distanza media centroline strade ≤ 0,5 m; Hausdorff costa ≤ 1 m; scarto POI = 0 px; `clipped_elements` esplicito.

6. **Aggiornare runtime e test.**
   - `BootScene.ts:52-56` carica `manifest.json` e, in modalità debug, `overlay.png`; `DebugOverlay.ts:91-98` disegna i poligoni reali invece dei rettangoli.
   - `tests/unit/ScaleMap.test.ts:19-31` verifica solo i bounds: estendere ai punti UTM. Con l’origine del punto 1, Via Ortensio (`40.80357–40.80544`, `14.07945–14.08175`) cade in tile `x 169–365`, `y 61–266` (pixel `x 2704–5840`, `y 976–4256`); Via Spiaggia (`40.80162–40.80186`, `14.08133–14.08134`) in tile `x 325–326`, `y 458–484` (pixel `x 5200–5216`, `y 7328–7744`).
   - `validate_geography.py` e `validate_m5_world.py` devono fallire se manca `manifest.json`, se il CRS cambia, se un edificio fuori bbox viene clampato o se l’overlay supera le soglie.

7. **Sequenza di accettazione.**
   - Rigenerare il centro con la nuova pipeline; generare `overlay_metrics.json`; eseguire validator; solo poi aggiornare buffer e `bacoli_world.json`.
   - Non toccare le altre 8 regioni finché il centro non passa il confronto; poi applicare lo stesso transform a ciascuna regione, senza limite 1100 tile.

## 5. Approssimazioni da documentare

| Approssimazione | Dove | Stato |
|---|---|---|
| Piani stimati dall’area dell’impronta (1/>700 m², 1/>400 m² e larghezza>34 m, 2/>180 m² o >34 m, 3/>80 m², altrimenti 2) | `build_map_centro.py:371-381`; `M4_SCALE_REVISION.md:44-47`; distribuzione centro 15/160/51 | Già dichiarata, ma non verificabile: 225/226 edifici OSM senza `building:levels` |
| Piani assenti nel campione REBUILD 2.0, nonostante il report dica “stimati dall’area” | `rebuild2_build_geo.py:92-100`; `docs/rebuild2/data/REPORT.md:26`; 0/196 edifici con `levels` | Da correggere |
| Larghezze stradali a raggio fisso per classe (1/2/3 tile), ignorate `width`/`lanes` assenti in `bacoli_geo.json` | `build_map_centro.py:71-75,296-315`; `rebuild2_build_geo.py:45-57` default 2–12 m | Da documentare esplicitamente e poi rimuovere |
| Facciate snap a larghezze discrete 6–68 m; scarto max 4,00 m, medio 0,24 m, 1 caso limitato a 68 m | `build_map_centro.py:53-58,384`; `WorldScene.ts:648-650` | Da dichiarare nel `manifest.json` |
| Sagoma costiera hardcoded (`EAST_COAST`/`WEST_COAST`) con deviazione media 50,6 m e max 114,9 m nel centro | `build_map.py:43-61`; `build_map_centro.py:205-218`; `build_map_regions.py:314-336`; `M4_SCALE_REVISION.md:41-43` | Già dichiarata come “già verificata”, ma non corrisponde alla coastline OSM disponibile |
| Laghi sintetici a 20 vertici nel generatore legacy | `build_map.py:208-217` | Da archiviare come M4 |
| Anisotropia 6 regioni (fino a 1,616 m/tile) pur con meta “1 tile = 1 metro” | `build_map_regions.py:285-291`; `public/assets/maps/baia/meta.json:9-18` | Da correggere o dichiarare con transform reale |
| POI e impronte clampati ai bordi: 85 place su 9 regioni, 13 nel centro; 319/1437 strade, 1184/4770 edifici, 107/921 POI, 17/19 elementi acqua con vertici fuori griglia | `build_map_centro.py:105-108,239-245`; `build_map_regions.py:232-238,447-457` | Da documentare nel QA e poi rimuovere |
| 4 stazioni fuori bbox clampate/ancorate alla strada più vicina | `build_map_regions.py:530-549`; `bacoli_world.json` (`lucrino`, `lido_fusaro`, `mercato_sabato`, `cuma_station`) | Già marcate `approximate` |
| 19 servizi puntuali approssimati: 3 nel centro (Centro consegne, Garage comunale, Pescheria del centro) + 2 in ciascuna delle altre 8 regioni | `build_map_centro.py:531-534`; `bacoli_world.json`; `M4_SCALE_REVISION.md:49-51` | Già dichiarati |
| Overpass non riuscito: 10/10 timeout per zona; fallback OSM API 0.6 | `collect_m5_geo.py:290-340`; `m5_osm_raw.json`; `docs/M5_GEO_AUDIT.md:18-36` | Già dichiarato, ma i dettagli sugli endpoint nel doc non corrispondono ai dati |
| 49/59 voci `sources` con `HTTP 200` mai richieste | `collect_m5_geo.py:361-406`; `docs/M5_GEO_AUDIT.md:61` | Da correggere |
| `pianura` e `napoli_80126` raccolti ma non pubblicati | `m5_osm_raw.json`; `bacoli_world.json`; `docs/M6_PLAN.md:4-6` | Da documentare come fuori scope |
| Mondo piano: nessun DEM, altitudine o pendenza, anche se Via Ortensio contiene `steps` | ricerca grep su `src/**/*.ts` e `tools/**/*.py`; `docs/rebuild2/data/sample_roads.geojson:50` | Da dichiarare |
| Prototipo REBUILD 2.0 metrico ma limitato al campione e non integrato: 325×639 tile, 210 footprint, CRS nelle properties, 16 px/m | `public/rebuild2/maps/sample/meta.json:1-11`; `tools/rebuild2_build_tiled.py:249-275`; nessun riferimento in `src/**/*.ts` | Da estendere a tutto il centro e collegare al runtime |
| Raster di riferimento REBUILD 2.0 a 3 px/m e non integrato nel gioco | `tools/rebuild2_render_reference.py:12-13,73-76`; `docs/rebuild2/data/osm_reference.png` (1013×1955 px) | Da riscrivere a 16 px/m e pubblicare con manifest |
| 243 nomi procedurali e palazzi 2×2/3×3 tile del vecchio `bacoli_places.json` / `build_map.py` | `build_map.py:330-374`; `src/data/bacoli_places.json` (315 luoghi) | Da non recuperare come geografia |
