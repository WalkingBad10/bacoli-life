# BACOLI LIFE — Milestone 6: piano operativo

Stato: **in corso**. Backup prima della revisione: `bacoli-life-20261125-010000-prima-milestone6.zip`.
Vincoli invariati: M4/M5, `1 m = 16 px`, adulto 28 px, piano 52 px, `centro` `463x722`,
`SAVE_VERSION = 4`, hook `__bacoliDebug`/`__bacoliTest`, viaggio Baia da `centro` via `bus_101`
con arrivo entro 140 px da `(4296,4096)`, Pianura/Napoli non giocabili.

## Cause dei difetti visibili (verificate)

1. `generate_assets_scale.py` disegna l'asfalto con `shadow` `#1B2C33` e `ink` `#0C1823`:
   la strada appare nera. `build_map_centro.py` e `build_map_regions.py` assegnano
   `ASPHALT`/`COBBLE` con `(x+y)%5`, quindi **texture casuali senza adiacenza**.
2. Non esiste autotiling: non ci sono maschere di adiacenza, cordoli, throughzze,
   segnaletica orizzontale o parcheggi. Le strade sono semplici dischi di tile.
3. `spawnTraffic()` crea 8 veicoli con `spawn.x + (i-4)*7` e li "ripara" con
   `findVehicleSpot()`; `updateTraffic()` li riporta a `spawn +/- 8/10` tile quando
   sono bloccati: sono teletrasporti, non traffico su rete stradale.
4. `spawnUrbanDetails()` distribuisce oggetti ogni 4 luoghi con offset `+/-2` tile:
   posizionamento per indice, non per regole urbanistiche.
5. `InteriorScene` ha 13 template, ma `church`, `bank`, `tobacco` sono irraggiungibili
   e il `placeId` passato da `WorldScene` non viene usato. Mancano hotel, lido,
   stazione, distributore come interni visitabili.
6. Le coordinate stazione M4 (`Station.position`) e M5 (`region.stations`) non sono
   raccordate; mancano fermate bus nel mondo e adiacenze tra regioni; le coastline
   vengono ignorate quando esiste un lago.

## Ordine di intervento

| Fase | Intervento | File principali | Criterio di accettazione |
|---|---|---|---|
| 0 | Backup e piano | `docs/M6_PLAN.md`, backup pre-M6 | backup presente, piano firmato |
| 1 | Tileset M6: asfalto chiaro, basolato lavico, marciapiedi, cordoli, throughze, segnaletica, parcheggi, raccordi | `tools/m6_tiles.py`, `tools/generate_tileset_m6.py`, `tools/generate_assets_scale.py` | 256 tile indicizzati, nessun nero dominante, GID legacy 1-16 stabili |
| 2 | Autotiling e pavimentazione deterministica su OSM | `tools/m6_paving.py`, `tools/build_map_centro.py`, `tools/build_map_regions.py` | maschere di adiacenza coerenti, zero pattern `(x+y)%n` nelle strade |
| 3 | Zona campione del centro + screenshot prima/dopo + QA | `docs/M6_SCREENSHOTS/`, `docs/M6_SAMPLE_QA.md` | strada, palazzi, bar, auto, pedoni, marciapiede e arredo visibili; nessuna sovrapposizione |
| 4 | Grafo stradale, corsie, traffico e veicoli parcheggiati | `tools/m6_paving.py`, `src/scenes/WorldScene.ts`, `src/systems/TrafficSystem.ts` | veicoli solo su tile stradali, orientamento, distanze di sicurezza, zero teletrasporti |
| 5 | Collisioni reali e navigazione condivisa | `src/systems/CollisionSystem.ts`, `src/systems/Pathfinding.ts`, `WorldScene` | NPC/protagonista/animali non attraversano impronte e oggetti solidi |
| 6 | Arredo urbano regolato (lampioni, panchine, cartelli, fermate, alberi, fioriere, tavolini, barche, cassonetti, parcheggi) | `WorldScene`, generatori | nessun oggetto casuale o sovrapposto |
| 7 | Palazzi, personaggi, profondità | `tools/generate_assets_scale.py`, `WorldScene` | balconi/persiane/terrazzi/panni/AC/insegne, 4 direzioni WASD corrette, depth by feet |
| 8 | Asset forniti: inventario uso effettivo | `docs/M6_ASSET_INVENTORY.md`, `tools/extract_*` | solo asset con alpha/prospettiva corretti entrano in runtime |
| 9 | Interni e sistemi di vita | `InteriorScene`, `types.ts`, `SaveSystem`, nuovi sistemi | template richiesti raggiungibili, interazioni coerenti, salvataggi v4 compatibili |
| 10 | Geografia e trasporti | `TransportSystem`, `build_map_regions.py`, `WorldScene` | fermate bus reali, coste con laghi, avvisi EAV, nessuna stazione inventata |
| 11 | Prestazioni e caricamento dinamico | `BootScene`, `WorldScene`, `CollisionSystem` | solo regione attiva in memoria, FPS/memoria/tempo di boot misurati |
| 12 | Verifica finale e pubblicazione | validator, build, test, Playwright, docs, Pages | tutto verde + screenshot QA + commit/tag/push |

## Matrice di rischio sui test esistenti

- **Alto**: dimensioni/solidTiles del centro, hook Baia/`bus_101`, firme hook E2E,
  dimensioni sprite verificate (`playerFrame`, `car`, `bus`, `roof`).
  Non modificare valori, solo materiali e logica interna.
- **Medio**: buffer `ground.bin` (i GID cambiano ma `firstGid`, `tileWidth` e
  `solidTiles` restano verificati); aggiornare `check_proportions.py`.
- **Basso**: nuovi file/asset, nuovi campi opzionali nei meta, documentazione.

## Nota sulla qualità

Il superamento dei test tecnici non certifica la qualità grafica. Le soglie visive
vengono verificate con screenshot dedicated, statistiche deterministiche e confronto
con le fotografie di riferimento; Ollama è solo un supporto descrittivo e non viene
usato come unico giudizio.
