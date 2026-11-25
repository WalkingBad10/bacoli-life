# REBUILD 2.0 — audit consolidato e verdetto strutturale

Data: 25 novembre 2026. Branch: `rebuild-2.0`. Stato: **checkpoint di anteprima, non versione ufficiale**.
La Milestone 6 resta online e immutata; nessun deploy di REBUILD 2.0 è stato effettuato.

## Verdetto

| Dominio | Verdetto | Azione |
|---|---|---|
| Architettura M6 | **Recuperare la logica, riscrivere la pipeline** | M6 conserva famiglia, economia, carriera, salvataggi, animazioni e hook diagnostici. La scena, i buffer e il caricamento dell'anteprima sono separati in `src/rebuild2/*`, `rebuild2.html` e `vite.config.ts`. |
| Motore grafico | **Recuperare Phaser 3, riscrivere il rendering** | Pixel-art, zoom e camera sono corretti; riscritti depth, ombre, occlusione, atlas, layer Tiled e nearest-neighbor. |
| Collisioni | **Riscrivere** | Poligoni OSM reali, swept collision con sliding, buffer solidi, OBB veicoli, A* su griglia metrica, debug F1. |
| Cartografia | **Riscrivere con CRS condiviso** | `EPSG:32633`, origine `422176.8877929378 / 4517668.951013729`, 16 px/m; overlay e metriche generate da GeoJSON e buffer effettivamente caricati. |
| Traffico | **Riscrivere** | Grafo OSMnx `retain_all=True`, 931 corsie, 551 guidabili, 51 compatibili bus, veicoli su corsie reali con orientamento applicato. |
| Asset grafici | **Riscrivere con tavole originali** | Atlas generati a dimensione metrica, palette dalle fotografie, nessun marker testuale o rettangolo colorato nella scena giocabile. |
| Level design | **Riscrivere con regole spaziali** | Arredo posizionato solo su marciapiede/area verde verificati; zero oggetti su acqua, edifici o mezzi. |
| QA | **Riscrivere** | OpenCV sullo screenshot segnalato, misure cartografiche con soglie, Vitest geometrico, Playwright reale da 4 direzioni senza teletrasporti. |

## I cinque domini strutturali obbligatori

1. **Cartografia verificabile** — `docs/rebuild2/audit/cartografia.md`, `docs/rebuild2/data/REPORT.md`, `docs/rebuild2/audit/overlay_metrics.json`.
2. **Rendering e asset** — `docs/rebuild2/audit/motore-grafico.md`, `docs/rebuild2/audit/asset-grafici.md`, `public/rebuild2/assets/assets_manifest.json`.
3. **Collisioni e navigazione** — `docs/rebuild2/audit/collisioni.md`, `src/rebuild2/CollisionWorld.ts`, `src/rebuild2/Pathfinding.ts`, `tests/unit/rebuild2_geometry.test.ts`.
4. **Traffico e mobilità** — `docs/rebuild2/audit/traffico.md`, `src/rebuild2/LaneNetwork.ts`, `public/rebuild2/maps/sample/lanes.json`.
5. **Level design e QA visiva** — `docs/rebuild2/audit/level-design.md`, `docs/rebuild2/audit/controllo-qualita.md`, `docs/rebuild2/audit/confronto_visivo.md`, `tests/e2e/rebuild2_quality.spec.ts`.

## Stato misurato del checkpoint

- OSM grezzo: 1.120.117 byte; 4100 nodi, 456 way, 15 relation.
- Dataset metrico: 353 edifici, 63 strade, 33 POI, 2 aree naturali/landuse; 432,0 x 773,9 m.
- Mappe: 433x774 tile, 335.142 tile, 64.582 solidi, 29.737 strade, 13.618 marciapiedi, 376 oggetti.
- Overlay: IoU edifici minimo 0,9979; distanza media centroline 0,3835 m; Hausdorff costa 0,6768 m; scarto POI 0 px; 3 elementi clippati dichiarati.
- Attraversamento della scena: `ready: true`, 353 edifici, 42 arredi, 4 veicoli, 7 NPC con A* attivo, zero errori console.
- Confronto screenshot: blu 0,05% / 2 componenti, verde 0%, marker testuali assenti; il giudizio finale resta all'utente.

## Approvazione

REBUILD 2.0 è un'anteprima separata. La pubblicazione ufficiale e qualsiasi modifica alla live M6 restano bloccate fino all'approvazione visiva esplicita dell'utente.
