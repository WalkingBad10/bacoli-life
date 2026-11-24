# M5 — Audit asset originali vs scala 1 m = 16 px

Data: 2026-11-24 · ambito: solo `bacoli-life` · **nessun file di codice modificato**.

## Sintesi operativa

1. **Nessuno sprite appena estratto è drop-in a 16 px/m con alpha corretto.** Le uniche sostituzioni già sicure sono le 4 che il progetto usa già: `car_white`, `car_blue`, `boat`, `station_eav` (file identici byte-per-byte a `public/assets/scale/`).
2. Le tre tavole **non sono fogli di sprite puliti**: hanno già un canale alpha (foglio 1: 29% trasparente, foglio 2: 18,5%, foglio 3: 61,5% semitrasparente) e i soggetti attraversano le linee di griglia. `tools/extract_original_assets.py` converte tutto in RGB, butta via quell'alpha e ricostruisce la maschera con GrabCut.
3. `ImageOps.contain(..., align="bottom")` adatta soggetti larghi e bassi (celle 384×102 del foglio 3) a tele alte (fino a 160 px): **25 dei 53 sprite** hanno il contenuto visibile sotto il 60% dell'altezza dichiarata. Non è un problema di scaling, è un problema di proporzioni della sorgente.
4. Il ridimensionamento LANCZOS lascia il 5–20% di pixel semitrasparenti: antialiasing morbido, non pixel art a 16 px/m. In 4 casi GrabCut ha trattenuto sfondo invece del soggetto (`tree_c` 97% di opachi "colore sfondo", `pergola_b` 69%, chiesa cella 3,3 34%).
5. **Bar, caffè, ristoranti, pizzerie e negozi non hanno facciate a runtime**: nel centro 150 POI su 376 sono marker puntuali e `addMarker()` li disegna tutti come `street_sign` (tranne `beach`→`palm` e `archaeological_site`→`olive_tree`). Il campo `sprite` presente nei dati non viene letto. Le facciate `shop_*` non sostituiscono nulla finché non si aggiunge un key/hook runtime o bounds OSM verificati.
6. Le texture sulle tavole sono opache e alla dimensione giusta, ma **non sono tileabili** (discontinuità media bordi 10–135 livelli RGB): utilizzabili come decal singoli, non come `tiles16`.

---

## Metodo e affidabilità

- Analisi con Pillow 13 + OpenCV 5 su: 3 tavole `docs/source_assets/sheets/` (tutte 1536×1024 RGBA), 9 foto in `docs/source_assets/photos/`, 65 asset estratti dalle celle, 34 fallback e 3 stazioni di `docs/ORIGINAL_ASSETS_MANIFEST.json`, e 831 PNG di `public/assets/scale/`.
- Metriche usate: frazione alpha opaca/semitrasparente, bbox del contenuto, componenti connesse, pixel opachi con colore prossimo allo sfondo, continuità dei bordi per le texture, confronto byte per byte con le controparti `scale/`.
- Ollama `qwen2.5vl:3b` è installato e risponde in modalità testo, ma **il canale vision è attualmente inutilizzabile**: anche su un rettangolo rosso uniforme restituisce solo `@@@@...`; su tavole intere dà `prediction aborted, token repeat limit reached`. Le descrizioni semantiche citate qui sono quindi quelle già salvate in `docs/SHEET_GRID_READ.json`, `docs/PHOTO_REFERENCE_MAPPING.md` e `docs/NEW_ASSETS_ANALYSIS.json`, mentre **tutte le conclusioni quantitative sono state ricalcolate**. `docs/SHEET3_CELL_IDENTIFICATION.json` non è affidabile: 8 righe su 10 sono fallite con HTTP 500 e le righe 1–2 descrivono celle diverse da quelle del foglio 3 attuale.
- Le 9 foto sono fotografie reali prospettiche (525×394 … 3984×2656), non mappe e non sprite: valgono come riferimento di palette/volumi. Solo `698ca65f.png` (stazione EAV) ha prodotto un asset; il resto resta riferimento architettonico, come già documentato in `PHOTO_REFERENCE_MAPPING.md`.

### Criterio usato per "riutilizzabile"

Un asset è considerato **drop-in** solo se: dimensione = chiave runtime già caricata, bbox del contenuto ≥ 70% dell'altezza target, semitrasparenza ≤ 8%, componenti connesse ≤ 2, ≤ 5% di opachi color-sfondo; per le texture anche bordi tileabili.

---

## (a) Cosa è davvero riutilizzabile

### Drop-in già attivi (conservare)

| Originale | Chiave runtime | Dimensione | Alpha | Giudizio |
| --- | --- | --- | --- | --- |
| `Vehicles/car_a.png` | `car_white` | 72×40 = 4,5×2,5 m | 13,8% semi | Identico a `scale/car_white.png` (SHA256 uguale) |
| `Vehicles/car_b.png` | `car_blue` | 72×40 | 15,7% semi | Identico a `scale/car_blue.png` |
| `Harbor/boat.png` | `boat` | 128×48 | 13,3% semi | Identico a `scale/boat.png` |
| `Stations/station_eav.png` | `station_eav` | 192×80 | 0% semi | Identico a `scale/station_eav.png`; derivato da foto, non da tavola |

`Stations/platform.png` (192×24) e `Stations/rail.png` (192×16) esistono nella libreria ma **non sono caricati** da `BootScene`: restano riferimento.

### Riutilizzabili solo dopo ritocco (non sostituire così come sono)

| Originale | Cella | Perché è vicino | Blocco |
| --- | --- | --- | --- |
| `Buildings/facade_1_1.png` | 0,0 | bbox 100% altezza, 2 componenti, semi 6,3% | 11% di opachi color-sfondo; larghezza fissa 208 px vs 33 larghezze runtime |
| `Shops/shop_cafe.png` | 0,0 | bbox 98%, semi 5,2% | 6 componenti + alone; nessuna chiave marker/shop |
| `Shops/shop_restaurant.png` | 1,0 | bbox 92%, semi 5,5% | 6 componenti; nessuna chiave |
| `Shops/shop_trattoria.png` | 2,0 | bbox 89%, semi 5,2% | 4 componenti; nessuna chiave |
| `UrbanProps/arch_flowers_b.png` | 3,1 | bbox 94%, 2 componenti | 15,6% semi → da soglia binaria |
| `UrbanProps/bench.png` | 1,5 | bbox 81%, dimensione già `bench` 64×32 | 22% semi → da soglia binaria |
| `Interiors/kitchen_2.png` | 2,1 | bbox 72%, 1 componente, semi 4,5%, sfondo 4,4% | non esiste uno slot per sfondi interni |

### Texture: usabili come decal, non come tile

`Roads/road_stone_a|b`, `mosaic_a`, `Beach/water_texture|sand_texture`, `Buildings/stone_wall_a..g` sono 100% opache e alle dimensioni target (64×64 o 128×96), ma la discontinuità media ai bordi è LR 10,6–110,6 e TB 34,9–134,8. Vanno o fatte tileabili (specchiare/cucire i bordi) o usate una sola volta come dettaglio.

### Da non usare

- `Furniture/f_*`, `Characters/*`, `Animals/*`, `Trains/train.png`: copy dei vecchi `assets/sprites/`, 32×32 o 16×32, non derivati dalle tavole e non alla scala M4.
- `Buildings/church.png`: la cella (3,3) sovrascrive le altre tre nel manifest; è quella con più residui (34% opachi color-sfondo, 60% dei semitrasparenti vicini allo sfondo).
- `Interiors/kitchen_1|3`, `bedroom`, `bathroom`: 13–37 componenti e 8–11% semi; sono scene, non sprite.
- Tutti gli sprite del foglio 3 con bbox < 60% (vedi tabella seguente).

---

## (b) Celle da rielaborare e come

### Foglio 1 — `b3b88625…` (4×4, celle 384×256)

Le differenze di colore ai bordi delle celle sono uguali a quelle interne (13,0 vs 12,4): gli edifici attraversano la griglia, quindi il ritaglio taglia balconi e cornicioni.

| Cella | Problema misurato | Intervento |
| --- | --- | --- |
| (1,0), (2,0), (2,1), (3,1), (1,2) | contenuto alto solo 56–77% della tela; bande trasparenti in alto | ritagliare sul bbox reale e riadattare a 160 px senza letterbox; non usare `align=bottom` |
| (1,1), (2,2), (3,2), (2,1), (3,1) | 8–12 componenti connesse | rimuovere isole < 20 px e usare l'alpha sorgente invece di GrabCut |
| (0,0), (1,0), (3,0), (2,2) | 9–12,5% di opachi con colore dello sfondo; alone 18–26% | soglia alpha binaria + erosione 1 px + decontaminazione colore |
| (0,3)…(3,3) chiesa | 4 voci manifest → 1 file; vince (3,3) con bbox 60%, 34% sfondo, 60% halo | riestrarre da (0,3) o (1,3) (sfondo 3–4%, halo 14%); altezza target 208 px (4 piani) ma **la chiave `building_*_4_*` non è caricata oggi** |

### Foglio 2 — `fb51c0b3…` (3×3, celle 512×341)

| Cella | Problema | Intervento |
| --- | --- | --- |
| (0,0) `shop_cafe`, (1,0) `shop_restaurant`, (2,0) `shop_trattoria`, (0,1) `shop_bar` | 4–10 componenti, alone 8–26%, bbox 89–98% | separare la vetrina dal contorno, alpha binario, ritagliare a larghezza 256 px = 16 m (o 192/320 in passi da 16) |
| (1,1) `kitchen_1`, (0,2) `kitchen_3`, (1,2) `bedroom`, (2,2) `bathroom` | 13–37 componenti, semi 6–11% | scomporre in arredi 16 px/m (usando `FURNITURE_WIDTH`) oppure scartare: il motore usa pavimenti + `f_*`, non sfondi |
| (2,1) `kitchen_2` | buona geometria ma nessuno slot | trasformare in piastrella/muro o tenere come reference |

### Foglio 3 — `f5b6326b…` (4×10, celle 384×102)

Qui il problema è strutturale: celle larghe e basse con soggetti piccoli in basso, adattate a tele alte. `door_stone` ha bbox alto il 2% e **zero pixel opachi**; `tree_c` ha il 97% di opachi color-sfondo; `pergola_b` il 69%.

| Gruppo | Celle | Intervento |
| --- | --- | --- |
| Fallite | (0,2) `door_stone`, (1,2) `door_accessible`, (3,8) `tree_c`, (2,8) `pergola_b` | ridisegnare maschera manuale o ripartire dall'alpha sorgente normalizzata; `door_stone` è vuoto |
| Troppo basse | (2,0),(2,1) scale; (3,0) arco; (2,2) fioriere; (2,3),(3,3),(2,4),(3,4) recinzioni; (0,5) lampione; (2,5) fontana; (3,5) cactus; (0,6),(1,6) auto; (2,6) scooter; (3,6) bici; (0,7),(1,7),(3,7) alberi/palma; (2,8) pergola; (0,9) roccia; (3,9) barca — bbox 16–50% | ridisegnare all'aspect del target (es. lampione 48×160, palma 96×160, albero 80×112) oppure cambiare le dimensioni target; il solo `contain` non basta |
| Quasi buone | (3,1) `arch_flowers_b` (94%, ma 15,6% semi), (1,5) `bench` (81%, ma 22% semi), (1,3) `drain` (67%) | soglia alpha + rimozione alone, poi uso come nuovo prop |
| Texture | (0,0),(1,0) pavé; (0,1),(1,1),(3,2),(0,4),(1,4),(0,8),(1,8) muri; (0,3) mosaico; (1,9),(2,9) acqua/sabbia | cucire i bordi opposti e portare a 16×16 / multipli, altrimenti restare decal |
| Buone ma senza slot | (3,1) arco fiorito, recinzioni, scale, fontana, scarico, cactus, pergole, scooter, bici | creare nuove chiavi runtime solo se serve; oggi non vengono caricate |

Regola comune: usare l'alpha originale delle tavole (con soglia e cleanup) invece di GrabCut su RGB, e fare il resize con campionamento nearest/binary per mantenere pixel art a 16 px/m; il LANCZOS attuale crea bordi morbidi.

---

## (c) Mappa concreta asset → chiave runtime

> `W` ∈ {96,112,128,…,1088} (33 valori presenti nei dati), `F` ∈ {1,2,3} (nel centro **non esiste il 4° piano**), `V` ∈ {0,1,2,3}. BootScene carica solo 117 chiavi `building_W_F_V`, 95 `roof_W_V`, 33 `shadow_W`.

| Dominio | Chiave runtime reale | Origine consigliata | Stato / azione |
| --- | --- | --- | --- |
| Palazzi residenziali | `building_{W}_{F}_{0}` / `_{2}` / `_{3}` (in base a `facadeVariant`) | `Buildings/facade_1_1..4`, `facade_3_1..4` | Usare come moduli artistici per il generatore; non sostituire le 117 facciate native: solo 8/226 edifici sono larghi 208 px |
| Bar / caffè / gelateria | `building_{W}_{F}_1` per i 4 con bounds + marker `street_sign` per gli altri | `Shops/shop_bar.png`, `shop_cafe.png` | Richiede hook marker o bounds verificati; oggi nessuna facciata bar è disegnata |
| Pizzerie | `building_{W}_{F}_1` + interno template `pizzeria` (floor 2 + `f_*`) | `Shops/shop_restaurant.png`, `shop_trattoria.png` | In `bacoli_centro.json` 11 pizzerie sono `kind: restaurant` ma **nessuna ha bounds**: sono marker `street_sign` |
| Ristoranti / trattorie | `building_{W}_{F}_1` (4 con bounds), marker per gli altri 67 | `shop_restaurant.png`, `shop_trattoria.png` | Stesso limite dei bar |
| Negozi / farmacie / pescheria / poste | `building_{W}_{F}_2`; interni `f_register`, `f_shelf` | `Buildings/facade_2_1..4`, `shop_*` | 12 shop + 9 farmacie + 1 pescheria sono solo marker nel centro |
| Chiesa / luogo di culto | `building_{W}_{F}_3` (servirebbe `F=4`, non caricato) | `Buildings/church.png` riestratto da cella (0,3) o (1,3) | Ridisegnare a 208×208 (4×52) e aggiungere la chiave se si vuole l'altezza piena |
| Mobili interni | `f_bed`, `f_sofa`, `f_table`, `f_chair`, `f_fridge`, `f_stove`, `f_shelf`, `f_tv`, `f_espresso`, `f_register`, `f_bathtub`, `f_toilet`, `f_plant`, `f_washing_machine`, `f_microwave`, `f_desk`, `f_crib` | `Interiors/kitchen_*`, `bedroom`, `bathroom` come riferimento; **non** `Furniture/f_*` (32×32 legacy) | Tenere i PNG procedurali `scale/f_*`; se si vogliono arredi originali, ritagliarli dalle celle a `FURNITURE_WIDTH` (14–40 px) |
| Vegetazione | `olive_tree` (80×112), `palm` (96×160); marker `palm` per `beach`, `olive_tree` per siti archeologici | `Vegetation/tree_a|b|c.png`, `palm.png` | **Non sostituire**: nativi hanno bbox 78–84%, estratti 16–37% |
| Vegetazione senza chiave | da creare: `cactus`, `pergola`, `pergola_b`, `planters_flowers`→`flowerpot` | `cactus`, `pergola*`, `planters_flowers` | Richiedono nuovo caricamento in BootScene; oggi inutilizzati |
| Arredo urbano | `bench` (64×32), `lamp` (48×160), `flowerpot` (32×32), `trash_bin` (32×48), `street_sign` (40×64), `parking_sign` (48×64), `umbrella` (96×64), `cafe_table` (80×48), `boat` (128×48) | `UrbanProps/bench`, `lamp`, `planters_flowers`; `Harbor/boat` | Solo `bench` è candidato dopo cleanup alpha; `lamp` va ridisegnato (contenuto 16% dell'altezza) |
| Arredo senza chiave | da creare: `fountain`, `drain`, `fence_metal_a..d`, `stairs_flowers_a|b`, `arch_flowers_a|b` | Tabelle foglio 3 | Nessun consumo runtime; `arch_flowers_b` e `drain` sono i meno danneggiati |
| Suolo / materiali | `tiles16`: frame 5–6 pavé, 3–4 sabbia, 9–12 acqua, 13 muro, 8 lastrico, 16 fiori (indici 1-based del generatore) | `road_stone_a|b`, `sand_texture`, `water_texture`, `stone_wall_*`, `mosaic_a` | Solo dopo render tileabile; oggi le texture non lo sono |

---

## (d) Quali asset procedurali sostituire

### Sostituire / mantenere le sostituzioni già fatte

| Chiave procedurale | Con cosa | Condizione |
| --- | --- | --- |
| `car_white`, `car_blue`, `boat`, `station_eav` | originali già copiati in `scale/` | già attivi; nessuna azione |
| `bench` | `UrbanProps/bench.png` | dopo soglia alpha (22% semi → <8%) |
| `building_208_3_0/1/2` | `facade_1_1` e le migliori `facade_*` | solo per gli 8 edifici larghi 208 px e solo dopo pulizia sfondo; guadagno limitato |
| `building_208_3_3` | `church.png` | dopo riestrazione da cella (0,3)/(1,3) e taglio a 160 px (o nuova chiave 4 piani) |
| `tiles16` frame 5,6,13,9–12,3–4 | texture del foglio 3 | solo rese tileabili; in caso contrario lasciare il tile procedurale |

### Non sostituire

- `building_W_F_V` per le altre larghezze, `roof_W_V`, `shadow_W`: nessuna controparte sulle tavole; le facciate estratte sono 208/256 px contro 96–1088 px.
- `olive_tree`, `palm`, `flowerpot`, `trash_bin`, `street_sign`, `parking_sign`, `umbrella`, `cafe_table`, `fisher`, `casina`: gli originali sono più piccoli, sfuocati o mal ritagliati.
- `f_*` (arredi), `player`, `npc_*`, `pet_*`, `train`, `bus`, `moto`, `car_red`, `car_yellow`, `room_floors.png`: gli originali sono fallback 32×32 o non esistono sulle tavole.
- `street_sign` per bar/ristoranti/negozi: il problema non è la grafica ma che manca un hook che scelga un'icona di attività; risolverlo non significa sostituire lo sprite con `shop_*` così com'è.

### Nuove chiavi da considerare (richiederebbe modifica codice, non fatta)

`cactus`, `fountain`, `drain`, `fence_metal_a..d`, `stairs_flowers_a|b`, `arch_flowers_a|b`, `pergola`, `pergola_b`, `scooter`, `bicycle`, `door_stone`, `door_accessible`.

---

## Priorità consigliata

1. **Non toccare** i 4 override già identici; sono l'unica parte solida dell'estrazione attuale.
2. Riestrarre le celle fallite del foglio 3 partendo dall'alpha sorgente (non da GrabCut): `door_stone`, `tree_c`, `pergola_b`, poi il gruppo "troppo basse".
3. Riscrivere il passaggio di fit: ritaglio sul bbox + resize nearest a dimensione finale corretta, invece di `contain(align=bottom)` con LANCZOS.
4. Riestrarre la chiesa da (0,3)/(1,3) e risolvere il fatto che quattro voci del manifest puntino allo stesso file.
5. Solo allora valutare nuove chiavi per i POI commerciali: senza bounds o hook marker, le facciate `shop_*` restano solo riferimenti artistici.

*Verifica ripetibile: gli script di misura usati sono stati eseguiti in `C:\Users\rocka\AppData\Local\Temp\opencode\` (fuori dal progetto); il repository contiene solo questo report.*
