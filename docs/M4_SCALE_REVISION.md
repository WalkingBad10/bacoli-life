# Revisione grafica e geografica — scala universale

Stato: **pubblicata e verificata live** (commit `e1788fe`, tag `milestone-4-verified`, https://walkingbad10.github.io/bacoli-life/).

## Scala universale

| Elemento | Metri reali | Pixel |
| --- | ---: | ---: |
| 1 tile | 1,00 | 16 |
| Adulto | 1,75 | 28 |
| Piano edilizio | 3,25 | 52 |
| Palazzo 3 piani | ~9,75 | 160 |
| Palazzo 4 piani | ~13,00 | 212 |
| Automobile | 4,5 × 2,5 | 72 × 40 |
| Autobus | 12,0 × 3,25 | 192 × 52 |
| Treno | 20,0 × 3,50 | 320 × 56 |

La conversione è applicata a personaggi, facciate, veicoli, arredi, vegetazione e
strade. Gli asset sono disegnati alla risoluzione finale: non si usano sprite
vecchi ingranditi e le facciate non vengono mai deformate con `setScale`.

## Area ricostruita

`tools/build_map_centro.py` genera una mappa **463 × 722 tile**, cioè
**463 × 722 metri**, con proiezione equirettangolare locale:

- sud `40.7995`, nord `40.8060`
- ovest `14.0775`, est `14.0830`
- 226 edifici reali da OpenStreetMap
- 30.397 tile di strada da OSM, con marciapiedi larghi 1–2 m
- spawn su Via Spiaggia vicino alla piazzetta sul mare

Priorità: **Via Ortensio, Via Spiaggia e centro storico**. Le altre frazioni
restano raggiungibili con la rete EAV e i sistemi di viaggio già esistenti, ma
non sono state ricostruite a questa scala. Pianura non è stata iniziata.

## Fonti e approssimazioni dichiarate

- Edifici, strade e POI: `src/data/bacoli_geo.json`, ottenuto via OSM/Overpass.
- Toponomastica verificata anche sullo stradario comunale del geoportale di Bacoli.
- Sagoma costiera: `EAST_COAST` già verificata nel progetto. Una nuova query
  Overpass del 24/11/2026 è andata in timeout HTTP 504, quindi la sagoma
  aggiornata non è stata inclusa.
- Numero di piani: i tag `building:levels`/`height` sono assenti negli edifici
  OSM dell'area. La stima finale è: `area > 700 m²` → 1 piano;
  `area > 400 m²` con larghezza > 34 m → 1 piano; `area > 180 m²` o larghezza
  > 34 m → 2 piani; `area > 80 m²` → 3 piani; altrimenti 2 piani.
  Ogni edificio dichiara `source` nei dati generati.
- Garage, centro consegne e pescheria del centro sono segnaposto dichiarati come
  approssimati: servivano a conservare le meccaniche M4 senza inventare luoghi
  geografici non verificati.

## Livelli separati

- `ground`: suolo, strade, marciapiedi, acqua, sabbia, fiori.
- `collision.bin`: bitmask dei tile solidi; le impronte OSM sono aggiunte da
  `CollisionSystem`.
- `shadow_*.png`: ombra degli edifici, disegnata sotto la facciata.
- `building_*_*.png`: facciata nativa, con porte, finestre, balconi e persiane.
- `roof_*.png`: copertura come livello separato.

Il protagonista usa la profondità `y`; gli edifici usano la base del footprint.
Chi è dietro un edificio viene quindi coperto correttamente dalla facciata.

Le facciate native vanno da **96 a 1088 px** (6–68 m), con passo 16 px.
`FACADE_WIDTHS`, il generatore, i buffer, i test e i controlli di proporzione
usano la stessa tabella. L'impronta OSM resta la sorgente delle collisioni; la
facciata è la misura discreta più vicina all'ingombro reale.

## Asset

`tools/generate_assets_scale.py` produce **830 PNG nativi** in
`public/assets/scale/` con seed deterministico e palette flegrea approvata.

Le tre tavole artistiche sono state analizzate e ritagliate in
`public/assets/original/` (102 asset nelle 14 cartelle richieste). Il
`docs/ORIGINAL_ASSETS_MANIFEST.json` registra cella di origine, categoria,
dimensione finale e uso runtime. La rimozione sfondi usa GrabCut con seed
fisso; solo automobili e barca, la cui silhouette è inequivocabile, hanno
sostituito le controparti procedurali in runtime. Gli altri ritagli restano
come riferimento artistico per evitare elementi sospesi.

La stazione EAV è stata ricostruita in pixel art originale dalla fotografia
della stazione: tetto metallico, pilastri in cemento, livrea rossa/bianca e
marciapiede con linea gialla. Non è stata collocata come edificio nella mappa:
entro i bounds del centro ricostruito cade solo la fermata bus di Bacoli centro,
mentre Baia e Fusaro sono fuori area. L'asset resta quindi nella libreria
`Stations/` e nella documentazione, senza introdurre una stazione ferroviaria
inventata. Gli hook `__bacoliDebug`/`__bacoliTest` e i selettori E2E sono
invariati.

## Verifiche prima della pubblicazione

- [x] Integrazione di `bacoli_centro.json` e dei buffer `centro/*` in Boot/World.
- [x] Verifica visiva confronto foto ↔ edificio, persona ↔ auto/bus/treno.
- [x] Test E2E proporzioni, collisioni, porte, profondità e interni.
- [x] QA OpenCV + Ollama sugli screenshot aggiornati.
- [x] Build e test unitari (94/94).
- [x] Ciclo E2E finale completo desktop + Android emulato: 30/30 verdi.
- [x] Backup finale (`bacoli-life-20261124-224000-revisione-m4-verificata.zip`), commit `e1788fe`, push e deploy Pages #9.
- [x] Smoke test live: canvas, clock, hook, 376 luoghi e zero errori console.
