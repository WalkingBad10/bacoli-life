# Audit bloccante — sistema di collisioni (`rebuild-2.0`)

Data: 2026-11-25. Branch verificato: `rebuild-2.0`. Ambito: sola lettura del codice e dei dati; nessuna modifica a sorgenti, configurazioni, asset o test. Unico file scritto: questo report.

Metodo: lettura integrale di `src/systems/CollisionSystem.ts`, `src/systems/DebugOverlay.ts`, delle sezioni rilevanti di `src/scenes/WorldScene.ts` e `src/scenes/InteriorScene.ts`, dei generatori `tools/build_map_centro.py`, `tools/build_map_regions.py`, `tools/m6_paving.py`, dei test unitari/E2E e decodifica read-only dei buffer `public/assets/maps/*/collision.bin` e `roads.bin` con le dimensioni dichiarate dai rispettivi `meta.json`.

## 1. Verdetto

**Verdetto: il sistema di collisione “a griglia” funziona; il sistema di collisione “delle facciate visibili” è strutturalmente sbagliato.** Non è stato trovato un percorso ordinario in cui il giocatore ignora un tile solido o un altro attore: `movePlayer()` ignora solo il proprio id (`WorldScene.ts:1143`), la guida solo il veicolo guidato (`WorldScene.ts:1125`), gli NPC solo il proprio id (`WorldScene.ts:1257-1259`). Non è stato trovato nemmeno un buffer corrotto: per tutte e 9 le regioni la lunghezza di `collision.bin` è esattamente `(width*height+7)/8`, `meta.json.solidTiles` coincide con il conteggio dei bit a 1, tutti i `bounds` degli edifici sono dentro la mappa, tutti gli spawn e le stazioni sono `canStand`, e non esiste alcun tile con classe stradale asfalto/basolato (`roads.bin` = 1 o 2) simultaneamente solido.

**Il fenomeno segnalato (“il protagonista attraversa i palazzi”) è però reale e riproducibile come disallineamento tra percepito e collisione.** I solidi sono le poligonali OSM rasterizzate dai generatori (`build_map_centro.py:390-393`, `build_map_regions.py:437-439`); le facciate disegnate sono rettangoli ricostruiti da `bounds` + `facadeWidth` (`WorldScene.ts:692-713`). Su 3.460 edifici, 1.691 hanno oltre il 50% dell’area rettangolare della facciata non coperta da bit solidi; la media è ~46% di area non solida. Caso minimo verificato: `place-1` / `Casa 1` nel centro, `bounds=[116,512,164,567]`, `facadeWidth=768` (48 tile) ma impronta solida che si restringe a 11 tile alla riga 564, 4 alla 565, 1 alla 567 e 0 alla 568: il rettangolo visivo occupa le righe 565-568, mentre la collisione si ferma alla poligonale. Un giocatore con i piedi alla baseline della facciata (`baseY = (maxY+1)*16+8 = 9096`, riga 568) passa senza collisione. Questo è il “passaggiothrough” osservato: non attraversa un muro solido, attraversa la parte della facciata che non è mai stata solida.

**Cause secondarie accertate.** 429/3.460 ingressi (`place.x`, `place.y`) cadono su un tile solido e 580/3.460 non superano `canStand(..., radius=5)`; l’ingresso non viene validato in `enterInterior()` (`WorldScene.ts:1838-1847`) né in `InteriorScene.exit()` (`InteriorScene.ts:765`). Il teleport E2E (`WorldScene.ts:427-430`), il carico salvataggio (`WorldScene.ts:325-333`), l’import (`WorldScene.ts:2401`) e gli arrivi in stazione (`WorldScene.ts:1927-1947`) possono posizionare il giocatore senza passare da `canStand`; `spawnPlayer()` valida solo contro i tile statici (`WorldScene.ts:608-610`), prima che vengano creati gli ostacoli dinamici. Gli NPC fuori schermo saltano l’update ma il loro cerchio solido resta all’ultima posizione (`WorldScene.ts:1230-1233`, `1284`): ostacolo invisibile, non through-wall.

**Perché i test non lo intercettano.** Il test unitario costruisce `CollisionSystem` passando `places` con `footprint` (`tests/unit/CollisionSystem.test.ts:24,30,39`), mentre in produzione `WorldScene.ts:564` passa solo `blocked`: il ramo costruttore che marca le footprint (`CollisionSystem.ts:28-43`) è morto in produzione e i test lo esercitano invece come se fosse la via reale. Il test E2E “il giocatore non attraversa edifici e muri solidi” (`tests/e2e/game.spec.ts:85-101`) usa `findWall()`, che restituisce il **primo tile solido qualsiasi** (`WorldScene.ts:516-531`): nel centro è `(304,2)`, un tile d’acqua, non un edificio; l’asserzione finale è solo `after.x < wall.boundary` dopo 1 s di `KeyD`. Nessun test verifica la corrispondenza tra rettangolo della facciata, bitmask e sprite, né cammina all’interno dell’area visiva di un palazzo. `m5_regions.spec.ts:37` verifica soltanto `solidTiles > 0`; `m6_actors.spec.ts:44-85` sceglie una piazzola libera apposta per non incontrare muri; `m6_traffic.spec.ts:39-49` misura salti <24 px e stall <46, non collisioni con facciate.

**Indirizzo: recupero mirato, non riscrittura totale.** Va riscritto il contratto “rappresentazione edificio ↔ collisione ↔ ingresso↔uscita”. `CollisionSystem.move/canStand`, la decompressione bitmask, i cerchi dinamici e il pathfinding stradale possono essere conservati come primitiva; vanno aggiunti una sorgente di verità geometrica unica per l’edificio, test di invarianza generatore↔runtime e validazioni di posizionamento.

## 2. Cause strutturali con riscontro `file:line`

| # | Causa | Evidenza |
|---|---|---|
| C1 | **Due geometrie diverse per lo stesso edificio.** Il generatore scrive `collision[y][x]=1` solo sui tile dell’impronta poligonale OSM e salva nel JSON solo il rettangolo `bounds`; `WorldScene` disegna un rettangolo centrato su `bounds` con larghezza `facadeWidth`, non sull’impronta. | `tools/build_map_centro.py:239-266` (solo `bounds`), `390-399` (bit solidi); `tools/build_map_regions.py:240-251`, `437-445`; `WorldScene.ts:699-712`. Misura: 527/3.460 `facadeWidth/16` diversi da `bbox width`; 1.691/3.460 facciate con >50% dell’area rettangolare non solida. |
| C2 | **Baseline sprite 8 px sotto l’ultima riga solida.** Le facciate usano `origin(0.5,1)` e `baseY=(maxY+1)*16+8`; l’impronta OSM termina alla riga `maxY`, quindi la riga `maxY+1` non è marcata. Il giocatore campiona `py±5`, perciò può avere i piedi esattamente sulla baseline visiva restando in una riga libera. | `WorldScene.ts:703-712`; `CollisionSystem.ts:83-90`. `place-1`: riga solida 567 = `[150]`, riga 568 = `[116]`; il rettangolo visivo copre 565-568. |
| C3 | **Ingressi non validati.** `entrance_tile()` sceglie `place.x/y` prima che i bit solidi siano scritti e il dato non viene ricontrollato a runtime; `nearestPlace()` usa quella coordinata con raggio 96 px. | `tools/build_map_centro.py:388-393`; `tools/build_map_regions.py:436-439`; `WorldScene.ts:1345-1353`, `1838-1847`; `InteriorScene.ts:754-766`. Misura: 429 ingressi su tile solido, 580 non `canStand` a raggio 5. |
| C4 | **Percorsi di teletrasporto/load senza validazione.** `teleport`, `hud.onLoad`, `importSave`, `finishTrip` e `restartInRegion` scrivono `setPosition`/`state.player` senza `canStand`; `spawnPlayer` controlla solo i tile statici, prima di veicoli, NPC, animali e arredo. | `WorldScene.ts:185-193`, `325-343`, `427-430`, `604-616`, `1902-1947`, `2392-2401`. |
| C5 | **Debug hitbox non mostra il problema.** L’overlay disegna i bit grezzi `collision.bin` (rossi) e i `bounds` (blu), non il rettangolo `facadeWidth` della sprite, non i cerchi dinamici e non l’area “visiva ma non solida”. È disattivato di default. | `WorldScene.ts:546-557`, `317-320`; `DebugOverlay.ts:20`, `81-98`. I bit grezzi e `blocked` hanno la stessa origine (`WorldScene.ts:558-564`), quindi l’overlay è coerente con la collisione ma non con la grafica. |
| C6 | **Sampling puntuale, non swept.** `canStand` campiona 8 punti a distanza `radius`; `move` separa X/Y e suddivide in passi ≤3 px. Non c’è AABB/swept contro poligoni o cerchi. | `CollisionSystem.ts:80-96`, `98-112`. A velocità nominale il tunneling non si verifica: corsa 92×1,85 = 170,2 px/s → 2,84 px a 60 fps (`config.ts:3-6`, `WorldScene.ts:1138`); auto 168 px/s → 2,8 px (`VehicleSystem.ts:11`). Resta un rischio su delta anomali, non la causa osservata. |
| C7 | **Traffico verifica solo l’arrivo del passo.** L’A* di `RoadGraph` usa solo classe stradale e bit statici; l’ostacolo dinamico è controllato con `canStand(nx,ny,...)` sul solo punto finale. | `RoadGraph.ts:73-78`, `96-129`; `WorldScene.ts:1316-1325`. Con passi ~30 px/s × 250 ms ≈ 7,5 px non emerge tunneling, ma il modello non è swept. |
| C8 | **NPC fuori schermo restano solidi.** Il culling salta animazione e aggiornamento ma non rimuove il cerchio registrato; `updateSolid` viene chiamato solo per gli NPC visibili. | `WorldScene.ts:1226-1233`, `1284`; `CollisionSystem.ts:56-59`. |
| C9 | **Cambio regione/restart è pulito, ma non valida la posizione.** Ogni `create()` ricrea `CollisionSystem`, quindi non restano solidi stantardi; `selectRegion` rilegge solo `state.regionId`, `setRegion` usa lo spawn grezzo. | `WorldScene.ts:196-205`, `207-221`, `448-454`, `545-565`; `BootScene.ts:51-56`. Misura: buffer coerenti in tutte le regioni (tabella sotto), spawn tutti validi. |

### Misure deterministiche sui buffer

| Regione | Dimensioni | `solidTiles` = bit a 1 | `meta.json.solidTiles` | byte `collision.bin` = attesi | conflitti strada/solido |
|---|---:|---:|---:|---:|---:|
| centro | 463×722 | 129.975 | 129.975 | 41.786 | 0 |
| baia | 1100×1100 | 146.465 | 146.465 | 151.250 | 0 |
| fusaro | 1095×1100 | 518.490 | 518.490 | 150.563 | 0 |
| lago_miseno | 994×745 | 498.447 | 498.447 | 92.567 | 0 |
| marina_grande | 590×722 | 187.120 | 187.120 | 53.248 | 0 |
| miliscola | 1096×1100 | 548.633 | 548.633 | 150.700 | 0 |
| miseno | 1096×1100 | 509.804 | 509.804 | 150.700 | 0 |
| torregaveta | 1100×1100 | 764.647 | 764.647 | 151.250 | 0 |
| villa_comunale | 329×278 | 59.738 | 59.738 | 11.433 | 0 |

Nessuna regione è priva di solidi; nessun `bounds` fuori bbox; nessuno spawn/stazione su tile solido; nessun tile asfalto/basolato solido. I dati OSM grezzi sono presenti (`bacoli_world.json:8-55` dichiara retrieval e fallback HTTP 200), quindi il problema non è assenza di cartografia.

Il supporto visivo disponibile è coerente col sintomo: `docs/rebuild2/audit/screenshot_user_ollama.md:11` descrive “Personaggio in piedi all’interno di una casa”. È un supporto descrittivo locale, non prova deterministica; la prova deterministica è il disallineamento geometrico misurato sopra.

## 3. Tabella ostacoli

| Ostacolo | Sorgente / creazione | Rappresentazione runtime | `ignoreId` | Note |
|---|---|---|---|---|
| Tile solidi (edifici OSM, acqua, bordo mappa) | `build_map_centro.py:284-289,390-393`; `build_map_regions.py:340-342,437-439`; `m6_paving.py:85-97` non riscrive `collision` | bit LSB-first in `collision.bin` → `blocked` (`WorldScene.ts:558-564`) → `isSolidTile()` (`CollisionSystem.ts:75-78`) | nessuno | Bordo `tx<1`, `ty<1`, `tx>=w-1`, `ty>=h-1` sempre solido. Questa è l’unica collisione che blocca davvero le facciate, ma solo dove il bit esiste. |
| Rettangolo facciata visiva | `place.bounds`, `facadeWidth`, `floors` (`WorldScene.ts:699-712`) | nessun solido dedicato | n/a | Causa C1/C2: è la geometria che il giocatore vede, non quella che urta. |
| Porta / ingresso | `entrance_tile(...)` (`build_map_centro.py:388`, `build_map_regions.py:436`) → `place.x/y` | coordinata usata da `nearestPlace()` e passata a `InteriorScene` | n/a | 429 ingressi solidi; `enterInterior`/`exit` non validano la posizione di ritorno. |
| Giocatore | `spawnPlayer()` (`WorldScene.ts:604-616`) | cerchio `id='player'`, raggio 5 | sé stesso in `movePlayer` (`1143`) | Rimasto solido per NPC/animali/veicoli; rimosso durante la guida (`1765`) e aggiunto alla discesa (`1748`). |
| Arredo urbano (pali, panchine, cartelli) | `placeUrbanProp()` (`WorldScene.ts:722-747`) | cerchio `prop-<key>-<tx>-<ty>`, raggio 3, centro `y-8` | nessuno | Filtra `walkable`, distanza da altri oggetti e 12 px dagli ingressi; non ignora il giocatore. |
| Veicoli posseduti e traffico | `spawnVehicles()` (`WorldScene.ts:840-858`), `spawnTraffic()` (`893-922`), garage (`1646-1665`) | cerchi raggio 6/10/22 (`VehicleSystem.ts:8-14`, `WorldScene.ts:577-582`) | solo il proprio id in guida/traffico (`1125`, `1321`) | A* stradale non considera gli altri cerchi; `findRoadSpot` verifica `canStand` e distanza (`865-890`). |
| NPC | `spawnNpcs()` (`WorldScene.ts:946`) | cerchio `npc-<i>`, raggio 5 | solo il proprio id (`1257-1259`) | A* con `walkable` e `canStand` (`1246-1249`); culling lascia il solido attivo fuori schermo (`1230-1233`, `1284`). |
| Animali | `syncPetSprites()` (`WorldScene.ts:1673-1693`) | cerchio `pet-<id>`, raggio 4 | nessuno nel movimento del giocatore | Rimosso con l’animale. |
| Corrieri | `updateDeliveries()` / `syncCourierSprites()` (`WorldScene.ts:1593-1614`) | solo sprite `moto`, **nessun solido** | n/a | Veicolo visibile in movimento senza CollisionSystem: disallineamento minore ma reale. |
| Interni | `InteriorScene.canStand()` (`InteriorScene.ts:255-272`) | griglia propria della stanza, non condivisa col mondo | n/a | Uscita con `setPosition(returnX, returnY)` senza `canStand` (`InteriorScene.ts:765`). |

## 4. Progetto del nuovo sistema

**Principio guida: una sola geometria autoritativa per edificio.** Non disegnare una cosa e colliderne un’altra.

1. **Modello dati unificato.** Estendere ogni `place` con una geometria esplicita serializzata: `footprint: [[tx,ty],...]` (già calcolata dai generatori) oppure, in alternativa, un poligono in coordinate tile; `bounds` diventa solo il suo AABB usato per disegnare ombra e texture. `facadeWidth` deve essere derivato dal footprint (o dichiarato come scelta artistica esplicita con un `visualScale` e un margine collisione documentato), non scelto indipendentemente (`build_map_centro.py:382-384`, `build_map_regions.py:432`).

2. **Allineamento visivo.** Due opzioni coerenti:
   - *A — collisione segue la grafica:* generare i bit solidi dal rettangolo della facciata (`centerX±facadeWidth/2`, righe coperte da `baseY-buildingHeight` a `baseY`) e riservare un varco esplicito per l’ingresso. Elimina il through-wall percepito ma può chiudere vicoli OSM: va validato sul grafo stradale.
   - *B — grafica segue la collisione:* costruire la sprite partendo dal footprint reale (sprite per larghezza/ingombro o mesh/tiles del contorno), eliminando il rettangolo finto. È la scelta più corretta e riutilizza i poligoni OSM già presenti.
   Consigliata: **B**, con A come fallback temporaneo per le regioni già generate.

3. **Baseline e ingressi.** Definire un’unica costante `FOOT_Y` per il punto di contatto (`baseY`) e fare in modo che l’ultima riga solida coincida con la riga in cui il giocatore poggia i piedi, non con una riga sopra. Calcolare `entrance_tile` **dopo** la rasterizzazione, scegliendo un tile libero adiacente al perimeter e memorizzando `returnX/returnY` già validati con `canStand`. In `enterInterior`/`exit` sostituire `setPosition` con una funzione `placeActorSafely()` che cerca l’anello libero più vicino, come già fa `finishTrip()` (`WorldScene.ts:1927-1942`).

4. **Collisione runtime.** Mantenere `blocked` + cerchi, ma:
   - spostare il raggio del giocatore in configurazione e usare lo stesso valore in `spawnPlayer`, `movePlayer`, `findVehicleSpot` e test;
   - sostituire il campionamento a 8 punti con una query circle-vs-tile che esamini tutti i tile sovrapposti al cerchio (intervallo `floor((x±r)/16)`), eliminando i punti ciechi agli angoli;
   - per veicoli e NPC usare swept circle contro i tile lungo il segmento, non solo il punto arrivo;
   - rimuovere/aggiornare il cerchio degli NPC cullati o mantenere l’update della collisione anche fuori schermo;
   - dare un cerchio ai corrieri o dichiararli esplicitamente non collidevoli e visualizzarli come tali.

5. **Debug.** L’overlay deve poter mostrare tre livelli distinct: bit `blocked` (rosso), AABB/`bounds` (blu) e **rettangolo effettivo disegnato + footprint autoritativo** (verde/giallo), più i cerchi dinamici. Aggiungere un contatore “celle visive non solide” calcolato alla creazione e mostrato nell’hook `__bacoliDebug`.

6. **Test di invarianza (da scrivere prima del refactoring).**
   - Unit: costruire `CollisionSystem` come fa la produzione (solo `blocked`) e verificare che ogni tile della footprint dichiarata sia solido.
   - Integrazione per regione: per ogni `place.bounds`, l’area rettangolare della sprite deve o essere coperta da bit solidi o essere dichiarata come sfondo/varco; soglia di tolleranza esplicita, non implicita.
   - E2E: scegliere un edificio noto (es. `place-1`), teleportare a un punto libero davanti alla facciata, camminare verso il centro del rettangolo visivo per 1-2 s e asserire che `canStand` resti `false` dentro l’area solida; ripetere per ogni direzione e per la corsa con `SHIFT`.
   - E2E porte: per ogni ingresso campionato, verificare che `canStand(place.x*16+8, place.y*16+16)` sia `true` oppure che esista un varco marcato; verificare che `exit()` rientri in posizione valida.
   - E2E traffico/NPC: aggiungere un caso con ostacolo dinamico posto sul percorso e verificare che non venga attraversato.

## 5. Recupero vs riscrittura

**Da recuperare (funzionanti e verificati):**
- `CollisionSystem.canStand/move` come primitiva di movimento a griglia (`CollisionSystem.ts:80-112`), con la suddivisione in passi ≤3 px;
- decompressione bitmask e separazione `blocked` / cerchi dinamici (`WorldScene.ts:545-565`, `CollisionSystem.ts:16-44`);
- `RoadGraph.drivable/route`, `m6_paving.paint` e la generazione OSM dei bit: i buffer sono internamente coerenti e privi di conflitti strada/solido;
- A* pedonale e stradale, il sistema di garage, il debug overlay come base da estendere;
- i test E2E esistenti come rete di non regressione per guida, regioni, traffico e interni: vanno integrati, non eliminati.

**Da riscrivere / correggere:**
- il contratto dati edificio: `bounds` + `facadeWidth` + `collision.bin` devono diventare una sola geometria autoritativa (C1/C2);
- la scelta e la validazione degli ingressi e il ritorno dagli interni (C3);
- tutti i `setPosition` senza validazione (C4), con una sola `placeActorSafely()`;
- il debug hitbox, che oggi non può mostrare il difetto (C5);
- il modello di collisione per attori fuori schermo, corrieri e passi di veicoli/NPC (C7/C8, tabella ostacoli);
- la suite collisioni: i test attuali esercitano un ramo del costruttore mai usato in produzione e un muro d’acqua invece di una facciata.

**Stima di impatto:** il cambiamento è confinato a generatori + `Place` type/data + `WorldScene.spawnProps`/ingressi + test. Non richiede di riscrivere Phaser, il tileset, il pathfinding o il save system. Il rischio principale è che marcare l’intero rettangolo della facciata come solido riduca la percorribilità dei vicoli: per questo la scelta B (grafica che segue il footprint OSM) è preferibile alla semplice chiusura dei rettangoli.
