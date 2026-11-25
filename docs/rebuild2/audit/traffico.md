# Audit traffico — BACOLI LIFE M6 (branch `rebuild-2.0`)

Ambito: solo codice sorgente, generatori, buffer e test presenti in `bacoli-life`. File citati relativi alla radice della repo. Le metriche numeriche sono una riproduzione offline deterministica dei buffer `roads.bin`/`collision.bin` e degli algoritmi `RoadGraph`/`findRoadSpot`; nessun file è stato modificato.

---

## 1. Verdetto

**Le due segnalazioni dell'utente sono fondate.** Non è un difetto di Phaser: è un difetto di modello.

Il "traffico" attuale non è un traffico stradale ma un **A* per tile su una maschera di superficie**:

- `RoadGraph` conosce solo la classe del tile (asfalto/basolato/marciapiede/sterrato), non nodi, archi, corsie, sensi unici, larghezze o raggi di curva (`src/systems/RoadGraph.ts:54-78,96-151`).
- L'A* a 4 vicini, senza penalità di svolta e con heap senza tie-break secondario, produce percorsi a "scala" da centro tile a centro tile: su una riproduzione dei buffer reali, a Baia i 8 percorsi iniziali hanno 602–1148 tile e **293–609 cambi direzione**, cioè una svolta ogni ~2 tile. A Miseno, 23–69 tile e 9–57 svolte.
- I marciapiedi sono esclusi dal grafo (`drivable()` accetta solo classi 1 e 2), ma **footway, path, steps e pedestrian sono mappati come basolato guidabile** (`tools/m6_paving.py:21-26`). Nei geodati generati risultano 465 `footway`, 90 `steps`, 29 `path`, 4 `pedestrian` ways.
- Il bus è `192×52 px` = **12×3,25 tile** alla scala 1 m = 16 px (`tools/generate_assets_scale.py:481-499`, `tests/e2e/game.spec.ts:416-417`), ma ha un cerchio di collisione di raggio 22 px (diametro 2,75 m) e uno sprite **mobile solo in orizzontale**: `vehicle.angle` viene calcolato ma mai applicato allo sprite (`src/scenes/WorldScene.ts:1330,1338`; `src/core/types.ts:37`).

**Teletrasporti runtime: non confermati.** `updateTraffic()` non riposiziona i veicoli: ri-calcola il percorso quando è vuoto o dopo 45 stall (`src/scenes/WorldScene.ts:1297-1306,1322-1325`). Il problema è però reale in due punti diversi: lo spawn può collocare un veicolo fino a **18,4 tile (294 px)** dal punto richiesto (`findRoadSpot()`, `:865-891`), e lo smontaggio sposta il giocatore con ricerca radiale (`toggleVehicle()`, `:1742-1748`). Inoltre il test E2E tollera salti fino a 24 px/250 ms, ~4 volte la velocità del bus (`tests/e2e/m6_traffic.spec.ts:43-44`).

**Il test `m6_traffic.spec.ts` passa ma non verifica nessuno dei difetti sopra**: controlla solo che esistano ≥6 veicoli, che 3 si muovano >12 px, che il salto campionato sia <24 px e che `stalls < 46` (`tests/e2e/m6_traffic.spec.ts:25-50`).

---

## 2. Cause strutturali con evidenze

### 2.1 Il grafo non è un grafo stradale

- `src/systems/RoadGraph.ts:54-78`: le uniche informazioni sono `classes`, `width`, `height`, `solid`; `drivable()` richiede classe 1/2 e `!solid`.
- `src/systems/RoadGraph.ts:96-151`: A* a 4 vicini, costo 1 per tile, euristica Manhattan. Non esistono archi diretti, uno-way, corsie, larghezza, superficie, velocità o penalità di curva.
- `src/systems/RoadGraph.ts:114-127,143-150`: se il goal non è raggiungibile restituisce il percorso parziale verso il nodo più vicino. Non è un salto, ma il veicolo può cambiare destinazione senza mai raggiungere quella dichiarata.
- `src/systems/RoadGraph.ts:154-169`: `pickDestination()` sceglie con hash `hash * 0.01 + min(distance,60)`. L'hash arriva a ~4,29×10⁷×0,01 ≈ 4,3×10⁵, quindi il termine distanza (≤60) è irrilevante: la destinazione è praticamente casuale, non legata a fermate o linee.
- `src/scenes/WorldScene.ts:282-286`: `roads.bin` viene caricato solo per costruire `RoadGraph`; non produce alcun layer stradale ulteriore.
- `src/systems/CollisionSystem.ts:80-96`: `canStand()` campiona 8 punti + centro del cerchio e controlla solo tile solidi e cerchi registered. **Non controlla la classe stradale**. Quindi `drivable()` e `canStand()` sono due definizioni diverse di "dove può stare un veicolo".

### 2.2 I generatori gettano via le informazioni necessarie

- `tools/osm_to_map.py:86-94` e `tools/collect_m5_geo.py:152-155` salvano di ogni way solo `id`, `name`, `kind`, `geometry`: `oneway`, `lanes`, `width`, `maxspeed`, `bus`, `foot`, `access`, `bridge`, `layer` non entrano nei dati. Non sono presenti nei buffer prodotti.
- `tools/m6_paving.py:17-26`: `pedestrian`, `footway`, `path`, `steps` → `cobble` → classe 2, cioè guidabile per `RoadGraph.ts:76-77`. `track` → `gravel` (classe 4, escluso), `service` → asfalto.
- `tools/build_map_regions.py:54-58`: `ROAD_RADIUS` va da 1 a 3 tile, cioè strade da 3 a 7 metri totali (`1 tile = 1 m`, `meta.json`). Non c'è campo larghezza per singola way.
- `tools/build_map_regions.py:351-369`: le strade vengono rasterizzate come dischi di raggio fisso, non come centerline con corsie.
- `tools/m6_paving.py:89-97`: i tile stradali vengono scartati se acqua o collisione; `tools/build_map_regions.py:340-342` rende l'acqua solida. Coerente per il suolo, ma il concetto di "molo" non entra nel modello (vedi 2.6).

Confronto numerico sui 9 buffer `public/assets/maps/*/roads.bin`: 275.965 tile asfalto + 61.429 tile basolato = 337.394 tile guidabili; 809.406 tile marciapiede e 9.718 sterrato. Il 18,2% del "guidabile" è basolato, una quota consistente della quale deriva da percorsi pedonali OSM.

### 2.3 Spawn e orientamento

- `src/scenes/WorldScene.ts:893-923`: nascono 8 veicoli (`bus` a `i=0,4`; `moto` a `i=3,6`; 4 auto), tutti vicino allo spawn della regione.
- `src/scenes/WorldScene.ts:865-891`: `findRoadSpot()` cerca in spirale fino a `ring <= 20` (320 px). Verifica solo `roadGraph.drivable()` del tile centrale, `canStand()` e distanza `radius + otherRadius + 8` dagli altri veicoli (`:884-886`). Non verifica corsia, direzione, ingombro reale o distanza dal punto richiesto.
- Riproduzione sui dati reali: tutti gli 8 veicoli nascono in ogni regione, ma lo scostamento dal punto richiesto arriva a 18,4 tile nel centro (bus `traffic-0`), 17,0 a Marina Grande/Miseno, 17,0 a Miliscola. Non è un errore di A*, ma è un riposizionamento iniziale invisibile al test.
- `src/scenes/WorldScene.ts:831-837`: `createVehicleSprite()` usa `setOrigin(0.5,0.8)` e `setDepth(y)`, senza `setAngle()`.
- `src/scenes/WorldScene.ts:1330`: `vehicle.angle = atan2(dy,dx)...` viene scritto in `VehicleState.angle` ma nessun renderer lo legge (unici usi di `.angle` in `src/`: `src/core/types.ts:37`, `SaveSystem.ts:251`, `VehicleSystem.ts:43`, `WorldScene.ts:902,1330`).
- `src/scenes/WorldScene.ts:1338`: l'unica rotazione visiva è `setFlipX(dx < 0)`. I movimenti verticali e diagonali mostrano comunque il fianco del veicolo. L'asset è disegnato come profilo laterale: ruote a `x=32,154`, finestrini in sequenza orizzontale (`tools/generate_assets_scale.py:484-496`).

### 2.4 Bus: dimensione, collisione e percorso

| Kind | Texture | Dimensione | Tile (1 m = 16 px) | Raggio collisione |
|---|---|---:|---:|---:|
| `moto` | `moto.png` | 40×20 px | 2,5×1,25 m | 6 px |
| `car` | `car_*.png` | 72×40 px | 4,5×2,5 m | 10 px |
| `bus` | `bus.png` | 192×52 px | 12,0×3,25 m | 22 px |

Fonti: `tools/generate_assets_scale.py:440-499`, `src/scenes/WorldScene.ts:577-582`, `tests/e2e/game.spec.ts:416-417`.

- Il cerchio del bus ha diametro 44 px (2,75 m), meno di un quarto della lunghezza dello sprite (192 px). I semi dei veicoli non collidono finché i centri non sono a 44 px (bus-bus) o 32 px (bus-auto) durante il movimento (`src/scenes/WorldScene.ts:1321`, `CollisionSystem.ts:94-95`): due bus possono sovrapporsi visivamente di ~150 px.
- Allo spawn la distanza richiesta è `r1 + r2 + 8` px (`src/scenes/WorldScene.ts:884-886`): due bus bastano 52 px, contro 192 px di lunghezza.
- `src/scenes/WorldScene.ts:1121-1130`: quando il giocatore guida, il raggio passato a `collision.move()` è **sempre 9**, qualunque sia il veicolo. Per un bus sarebbe 9 invece di 22.
- La strada più larga generata è 7 m (`tools/build_map_regions.py:54-58`). Il bus è largo 3,25 m e lungo 12 m: entra in una corsia da 3,5 m ma non ha raggio di volta per le svolte a 90° che l'A* inserisce ogni ~2 tile. Le strade a raggio 1 (3 m) sono più strette della sagoma del bus.
- Il bus non è guidabile dal giocatore: `VEHICLE_CATALOG` lo dichiara (`src/systems/VehicleSystem.ts:8-14`) ma `buyVehicle()` accetta solo `car|moto` (`:38-47`), `canDrive()` richiede `owned` (`:65-67`) e i bus del traffico hanno `owned:false` (`src/scenes/WorldScene.ts:898-904`). `nearestVehicle()` inoltre itera solo `state.vehicles` (`src/scenes/WorldScene.ts:1357-1364`).

### 2.5 Collisioni, marciapiedi, arredo e facciate

- Campionamento dei 9 punti del cerchio di `CollisionSystem.canStand()` su tutti i tile guidabili dei 9 buffer: con raggio 22 (bus) il cerchio esce dalla classe 1/2 nel **69,5%–82,4%** dei casi (minimo Centro, massimo Miseno). Con raggio 10 (auto) nel 21,5%–30,5%. Poiché `canStand()` controlla solo i tile solidi, questi sconfinamenti su marciapiede/classe 0 sono **consentiti dal runtime**.
- `src/scenes/WorldScene.ts:287-300`: l'ordine è `spawnVehicles()` → `spawnTraffic()` → `spawnNpcs()` → `spawnBusStops()` → `spawnUrbanDetails()`. Pali, panchine, segnali e cartelli diventano solidi *dopo* la creazione del traffico (`placeUrbanProp()`, `:722-748`). Vengono posizionati per non sovrapporsi ai veicoli fermi, ma l'A* non conosce questi ostacoli: un bus può ricevere una rotta che passa accanto a una panchina e restare bloccato fino al ri-calcolo dopo 45 stall.
- `src/scenes/WorldScene.ts:699-712`: le facciate vengono disegnate come rettangoli larghi `facadeWidth` (minimo 96 px = 6 tile, `tools/build_map_regions.py:127`) centrati sul bbox OSM, con `floorHeightPx = 52`. La collisione usa invece solo l'impronta poligonale (`src/scenes/WorldScene.ts:562-564`). Riproduzione sui dati reali: drivable tile coperti visivamente da facciate ma collision-free sono 1.373 a Centro, 4.785 a Fusaro, 3.736 a Baia, 1.714 a Torregaveta. È la causa più probabile della percezione "le auto passano dentro gli edifici": la logica è corretta sul footprint, il disegno no.
- `src/scenes/WorldScene.ts:1317`: velocità 22 px/s (bus), 30 (auto), 36 (moto); `:1321-1331` non c'è frenatura, distanza di sicurezza dinamica né gestione della precedenza: in caso di sovrapposizione il veicolo semplicemente non si muove e accumula stall.
- `src/scenes/WorldScene.ts:1322-1325`: `stalls > 45` è contato in **frame**, non in millisecondi: il comportamento dipende dal frame rate.

### 2.6 Fermate, linee bus reali e moli/pontili

- `src/scenes/WorldScene.ts:761-767`: le 67 fermate OSM presenti in `bacoli_world.json` diventano solo cartelli (`bus_stop.png`), ancorati a marciapiede/basolato via `placeUrbanNear()` (`:750-759`). Non sono nodi del grafo, non sono fermate del traffico e non influenzano le destinazioni.
- `src/systems/TransportSystem.ts:47-99,105-156` contiene le linee EAV reali (101, 102, 144, 145, 146, 150, 153) e le stazioni: sono usate dal viaggio rapido/HUD, non dai bus del traffico.
- `src/scenes/WorldScene.ts:917-920,1300-1304`: i bus ricevono la stessa destinazione hash degli altri veicoli. Non seguono `LINES`, non si fermano alle fermate, non hanno capolinea, orario o attesa.
- `tools/generated/m5_osm_raw.json` contiene **60 POI** con `kind = pier` (`man_made=pier`), ma `OSM_KIND` in `tools/build_map_regions.py:69-85` non ha una voce `pier`: alla `:454` questi cadono nel default `"shop"`. In `bacoli_world.json` non esiste alcun place con `kind=pier`; `roads.bin` ha solo le classi 0–4 e l'acqua è solida (`tools/build_map_regions.py:340-342`). I moli, quindi, non sono strade né entità dedicate: non sono percorribili e, quando presenti, sono etichettati come negozi generici.

### 2.7 Copertura dei test

- `tests/e2e/m6_traffic.spec.ts:11-51`: 12 campioni a 250 ms; soglie `step < 24 px`, `distance > 12 px` per almeno 3 veicoli, `stalls < 46`, almeno 6 veicoli. `trafficRoutes` espone `target` e `remaining` (`src/scenes/WorldScene.ts:387-393`) ma il test non li usa.
- `tests/e2e/game.spec.ts:416-417`: fissa `bus = {192,52}` e `car = {72,40}`. Qualsiasi ridimensionamento richiede aggiornare questo contratto.
- `tests/e2e/m6_transport.spec.ts:26-31` verifica che le fermate OSM esistano, non che i bus le servano.
- Nessun test verifica classe del tile sotto il veicolo, corsia, senso unico, angolo dello sprite, ingombro, distanza tra veicoli, fermate servite o moli.

---

## 3. Tabella difetti

| Difetto | Evidenza (file:line) | Effetto misurato / osservabile | Gravità |
|---|---|---|---|
| **Posizionamento casuale** | `WorldScene.ts:865-891` (spirale `ring≤20`), `:893-923` | Scostamento fino a 18,4 tile (294 px) dal punto richiesto; nessun vincolo di corsia/ingresso. I 8 veicoli nascono comunque in tutte le regioni. | Alta |
| **Corsie e sensi unici** | `RoadGraph.ts:96-151`; `osm_to_map.py:86-94`; `collect_m5_geo.py:152-155`; `m6_paving.py:21-26` | A* a 4 direzioni su tile da 3–7 m; nessun offset laterale, nessun uno-way. A Baia 293–609 svolte su 602–1148 tile. Footway/steps/pedestrian (588 ways nei geodati) risultano guidabili come basolato. | Critica |
| **Orientamento sprite** | `WorldScene.ts:831-837,1330,1338`; `generate_assets_scale.py:484-496` | `vehicle.angle` mai applicato; solo `flipX` per `dx<0`; bus e auto restano di profilo anche in movimento verticale/diagonale. | Alta |
| **Bus vs larghezza strada** | `generate_assets_scale.py:481-499`; `WorldScene.ts:577-582,1121-1130`; `build_map_regions.py:54-58` | Sprite 12×3,25 m, cerchio 2,75 m, strade 3–7 m, raggio di guida hardcoded 9 px. Nessun raggio di volta: le svolte a 90° dell'A* sono fisicamente impossibili per il bus. Bus non acquistabile né guidabile (`VehicleSystem.ts:38-47,65-67`). | Critica |
| **Collisioni con classi/arredo/facciate** | `RoadGraph.ts:73-78`; `CollisionSystem.ts:80-96`; `WorldScene.ts:287-300,699-748,1321` | Cerchio bus fuori classe 1/2 sul 69,5–82,4% dei tile guida; auto 21,5–30,5%. Prop inseriti dopo i veicoli e ignorati dall'A*. 1.373–4.785 tile guida coperti visivamente da facciate più larghe dell'impronta. | Critica |
| **Distanze di sicurezza** | `WorldScene.ts:884-886,1321-1331` | Gap allo spawn = 8 px oltre i raggi; in marcia basta `r1+r2`. Due bus (192 px) possono sovrapporsi di ~150 px. Nessun car-following; stall a frame, non a secondi. | Alta |
| **Teletrasporti / ripositionamenti** | `WorldScene.ts:865-891,1742-1748`; `m6_traffic.spec.ts:43-44` | Nessun salto nel loop di update; ma spawn decentrato fino a 294 px e discesa dal veicolo con ricerca radiale. Soglia test 24 px/250 ms ≈ 4× velocità bus (5,5 px/250 ms). | Media |
| **Fermate e percorsi bus reali** | `WorldScene.ts:761-767,917-920,1300-1304`; `TransportSystem.ts:47-99` | 67 fermate OSM sono cartelli; 7 linee EAV esistono solo nel viaggio rapido. I bus del traffico usano destinazioni hash e non fermano. | Alta |
| **Moli / pontili** | `build_map_regions.py:69-85,340-342,454`; `m6_paving.py:89-97` | 60 `pier` OSM non hanno classe dedicata e cadono nel default `shop`; acqua solida, nessun tile guidabile sui moli. | Media |

---

## 4. Progetto per un grafo stradale reale con corsie e vincoli di dimensione

### 4.1 Sorgente dati

1. Estendere i collector (`tools/osm_to_map.py:86-94`, `tools/collect_m5_geo.py:152-155`) per conservare, per ogni way: `highway`, `oneway`, `lanes`, `width`, `maxspeed`, `surface`, `foot`, `bus`, `access`, `bridge`, `tunnel`, `layer`, `name`, `ref` e geometria completa.
2. Generare un manifest `roads_manifest.json` per regione con nodi (coordinate tile), archi (polilinea, classe, senso, numero corsie, larghezza, velocità, flag autobus) e un `surface.bin` derivato. `roads.bin` può restare come layer di rendering, ma deve essere **derivato dallo stesso manifest**, non sorgente indipendente.
3. Escludere esplicitamente dal grafo veicolare `footway`, `path`, `steps`, `pedestrian`, `corridor` e `track`, salvo tag `access=vehicle`/`bus=yes` espliciti.

### 4.2 Corsie e direzione

- Ogni arco diventa una o più **corsie direzionate** con offset dalla centerline. Convenzione: metà larghezza corsia = 1,75 m = 28 px; corsia standard = 3,5 m = 56 px.
- Classi suggerite: `primary/secondary` 2 corsie (7 m totali), `tertiary/residential/unclassified` 1–2 corsie (3,5–7 m), `service` 1 corsia (3,5 m), `pedestrian/steps/path` 0 corsie veicolari.
- Senso unico: archi con `oneway=yes/-1` hanno una sola corsia direzionata; `oneway=no` due. Il router non deve mai percorrere una corsia contromano.
- Ingresso veicoli: nodo di corsia + progresso lungo l'arco, con orientamento = tangente della polilinea. Niente ricerca radiale attorno allo spawn (`WorldScene.ts:865-891`).

### 4.3 Ingombri reali

Sostituire `vehicleRadius()` (`WorldScene.ts:577-582`) con rettangoli orientati (OBB) derivati dagli asset:

| Kind | Ingombro (m) | Ingombro (px) | Margine proposto | Raggio di volta minimo |
|---|---|---|---|---|
| `moto` | 2,5 × 1,25 | 40 × 20 | 0,15 m | ~2 m |
| `car` | 4,5 × 2,5 | 72 × 40 | 0,25 m | ~5 m |
| `bus` | 12,0 × 3,25 | 192 × 52 | 0,25 m | ≥10–12 m |

- Validazione OBB contro: corridor della corsia, tile solidi, cerchi/OBB di altri veicoli, arredo urbano e facciate con maschera sull'impronta OSM.
- Distanza di sicurezza: almeno `0,5 s × velocità` o una lunghezza veicolo, non 8 px costanti (`WorldScene.ts:884-886`).
- Intersezioni: template di svolta con area spazzata; se l'intersezione non soddisfa il raggio del bus, l'arco è vietato ai bus. Niente svolte a 90° a centro tile (`RoadGraph.ts:129`).
- Per il bus: se non si vuole redraw dell'asset, limitarlo a `primary/secondary` con due corsie e percorsi senza curve strette; in caso contrario ridisegnare come sprite top-down/3-4 con 8 direzioni e larghezza coerente con 3,5 m. Il contratto `192×52` in `tests/e2e/game.spec.ts:417` va aggiornato di conseguenza.

### 4.4 Routing e bus reali

- Dijkstra/A* su grafo **diretto di corsie**, con costo = lunghezza/velocità + penalità di svolta + costo di cambio corsia; niente inversione a U tranne che ai nodi che lo consentono.
- Destinazioni scelte tra nodi raggiungibili e compatibili con il tipo veicolo, non con hash dominante (`RoadGraph.ts:163-165`).
- Bus: definire le 7 linee di `src/systems/TransportSystem.ts:47-99` come sequenze di nodi/fermate; ogni bus ha `lineId`, `nextStopId`, tempo di sosta, capolinea. Le 67 fermate OSM (`WorldScene.ts:761-767`) diventano fermate del grafo, non solo cartelli.
- Incroci con conflitto: prenotazione della corsia/nodo per evitare che due veicoli entrino nella stessa area; lo stall va misurato in millisecondi e risolto con attesa/priority, non con cancellazione cieca del percorso (`WorldScene.ts:1322-1325`).

### 4.5 Molì

- Aggiungere un tipo `pier` al manifest, generato dai 60 `man_made=pier` di `tools/generated/m5_osm_raw.json`, con geometria e superficie pedonale.
- I moli restano **non veicolari** per definizione, salvo tag OSM espliciti; l'acqua resta solida (`build_map_regions.py:340-342`). Nessun veicolo deve poter essere instradato su un molo o sull'acqua.

---

## 5. Cosa recuperare vs riscrivere

### Da recuperare

| Elemento | Evidenza | Condizione |
|---|---|---|
| Scala metrica 1 m = 16 px e `floorHeightPx = 52` | `tools/build_map_regions.py:560-562`, `tests/e2e/game.spec.ts:401-404` | Mantenerla come contratto unico; tutti gli ingombri vanno espressi in metri e convertiti a px. |
| Buffer binari compatti e bitmask collisione | `tools/build_map_regions.py:254-267`, `src/scenes/WorldScene.ts:262-286,545-565` | Conservare il formato, ma `roads.bin` diventa derivato del manifest, non sorgente del grafo. |
| Geometria OSM reale di strade/edifici/fermate | `tools/generated/m5_osm_raw.json`, `tools/generated/m6_bus_stops.json`, `src/data/bacoli_world.json` | Riutilizzare le geometrie; arricchire i tag invece di ricostruire. |
| `MinHeap` e schema A* | `src/systems/RoadGraph.ts:8-52,96-151` | Riutilizzabili come meccanismo di ricerca; da applicare al grafo di corsie con penalità di svolta e tie-break. |
| Linee/stazioni EAV reali | `src/systems/TransportSystem.ts:47-156` | Fonte autorevole per rotte e capolinea dei bus del traffico. |
| Hook diagnostici `__bacoliDebug` / `__bacoliTest` | `src/scenes/WorldScene.ts:353-421,425-532` | Estenderli con `laneId`, `heading`, `kind`, `routeEdges`, `nextStop`; sono la base dei test nuovi. |
| Determinismo seed/spawn | `RoadGraph.ts:154-169`, `WorldScene.ts:865-891` | Mantenere la riproducibilità, ma applicarla a scelta di archi/corsie, non a salti radiali. |

### Da riscrivere

1. **`RoadGraph`** (`src/systems/RoadGraph.ts`): da maschera di tile a grafo di corsie direzionate con metadati di larghezza, senso e compatibilità bus.
2. **Collector/generator** (`tools/osm_to_map.py`, `tools/collect_m5_geo.py`, `tools/build_map_regions.py`, `tools/m6_paving.py`): preservare i tag OSM e smettere di trasformare percorsi pedonali in strade guidabili.
3. **`spawnTraffic()` / `findRoadSpot()`** (`WorldScene.ts:865-923`): spawn su corsia con ingombro e orientamento validati, distanza dal punto richiesto esplicita e limitata.
4. **`updateTraffic()`** (`WorldScene.ts:1289-1343`): guida lungo polilinea di corsia, OBB, following distance, stop ai nodi, stall in ms, rotazione sprite.
5. ** sprite veicoli** (`WorldScene.ts:831-837`, `tools/generate_assets_scale.py:440-499`): 4/8 direzioni coerenti o vincolo esplicito a strade orizzontali; ridefinire il contratto bus.
6. **Routine bus** (`WorldScene.ts:917-920,1300-1304`): linee reali e fermate OSM al posto di `pickDestination()` casuale.
7. **Occlusione facciate** (`WorldScene.ts:699-712`): maschera sull'impronta OSM, non rettangolo `facadeWidth`; eliminare i tile guida coperti visivamente.
8. **Test `m6_traffic.spec.ts`**: sostituire le soglie generiche con asserzioni su classe/corsia/ingombro/fermate.

---

## 6. Test necessari

### Unit

- `RoadGraph`/lane graph:
  - ogni nodo ha almeno una corsia entrante e uscita; uno-way `-1` vieta il verso opposto;
  - `footway`, `steps`, `path`, `pedestrian` non sono archi veicolari, nemmeno se classificati `cobble`;
  - parità tra `roads.bin`, manifest e layer di rendering (nessuna divergenza di sorgente);
  - penalità di svolta e divieto di U-turn; percorso verso una fermata raggiungibile, non verso hash casuale.
- Collisioni/ingombro:
  - OBB moto/auto/bus dentro la corsia con margine; rifiuto del bus su corsia da 3 m e su curva con area spazzata insufficiente;
  - distanza minima tra due veicoli in marcia ≥ `0,5 s × velocità`;
  - nessuna sovrapposizione OBB con tile solidi, pali/panchine e impronte edilizie mascherate.
- Bus:
  - sequenza fermate uguale a `LINES` per 101/102/144/145/146/153;
  - sosta a ogni fermata OSM della linea e ripartenza verso la successiva;
  - nessun bus su archi non idonei.

### Integrazione / E2E (tutte le 9 regioni, non solo Centro)

- Esporre in `__bacoliDebug().trafficRoutes` anche `kind`, `heading`, `laneId`, `surface`, `routeEdges`, `nextStop`, `spriteAngle`.
- Ad ogni campione (250 ms):
  - `surface` del tile centrale ∈ {1,2} **e** centro dentro l'offset di corsia;
  - `step ≤ velocitàKind × 0,25 s × 1,2` (bus ≈ 6,6 px, auto 9 px, moto 11 px): la soglia attuale 24 px va abbassata;
  - `spriteAngle` coerente con la tangente della corsia (o frame direzionale atteso), non solo `flipX`;
  - OBB del bus dentro la corsia e senza intersezione con solidi/veicoli;
  - `stalls` misurato in ms e sotto soglia, non contato in frame;
  - tutti gli 8 veicoli generati e in movimento, non solo 3.
- Bus: almeno un bus raggiunge due fermate reali consecutive della propria linea entro un budget di tempo; nessuna destinazione hash senza `lineId`.
- Spawn: distanza tra punto richiesto e posizione iniziale ≤ lunghezza di un arco/corsia; discesa dal veicolo termina su un nodo pedonale adiacente alla corsia, non su ricerca radiale qualunque.
- Molì: i 60 `pier` OSM hanno un'entità dedicata nel manifest; nessun tile acqua/molo è guidabile; nessun veicolo può ricevere una rotta che li attraversi.
- Visivo: conteggio di tile guidabili coperti da facciate deve tendere a 0; aggiornare `tests/e2e/game.spec.ts:416-417` se cambia il contratto dimensionale di `bus.png`.
- Regress: `m6_traffic.spec.ts` deve fallire se si reintroduce `pickDestination()` hash, `setFlipX` senza rotazione o `vehicleRadius()` circolare per il bus.
