# BACOLI LIFE — Milestone 6: verifica finale

Data: **25 novembre 2026**. Branch: `m6/checkpoint-20261125`.
La versione live resta la milestone 5 finché questo stato non viene pubblicato.
**Pianura e Napoli 80126 non sono state costruite**: restano solo predisposte nei dati.

## Risultati delle verifiche

| Verifica | Esito |
|---|---|
| `npm.cmd run build` | **OK** · `dist/assets/index-CJjol3t0.js` 2.433,11 kB / gzip 512,45 kB (warning noto sul chunk >500 kB) |
| `npm.cmd test -- --run` | **99/99** test unitari, 19 file |
| `npm.cmd run test:e2e` | **64/64** test, 32 desktop + 32 Android emulato |
| `tools/validate_geography.py` | **OK** · 226 impronte OSM, 30.397 tile strada, 256 luoghi centro |
| `tools/validate_m5_world.py` | **OK** · 9 regioni, 3.800 luoghi, 3.460 edifici, 3.363.319 tile solidi |
| `tools/check_proportions.py` | **OK** · 30 asset campione, 226 edifici, `1 m = 16 px` |
| `tools/check_m5_screenshots.py` | **OK** · 9 regioni, 0 frame duplicati |
| `tools/asset_inventory.py` | **835 PNG**, 487 usati, 347 archiviati, 0 mancanti |

## Copertura E2E aggiuntiva di M6

- `m6_traffic.spec.ts`: 8 veicoli su grafo OSM, passi <24 px/250 ms, nessun
  teletrasporto, rotte A* attive e stalli sotto soglia.
- `m6_actors.spec.ts`: WASD nelle quattro direzioni, animazioni `walk-*`, ombre
  ai piedi, `depth === y` per gli sprite e `depth ombra === y - 1`, nessuna
  sovrapposizione fra pedoni, animali e veicoli.
- `m6_urban.spec.ts`: arredo solo su superfici pedonali/OSM, distanze minime,
  nessun oggetto in mezzo all'asfalto o sull'ingresso dei palazzi.
- `m6_interiors.spec.ts`: 7 template (`hotel`, `lido`, `station`, `fuel`,
  `church`, `bank`, `tobacco`) aperti da luoghi OSM reali, con eredità di
  `placeId`, regione, piani e larghezza facciata; salvataggi v4 conservati
  attraverso ingresso/uscita e reload.
- `m6_transport.spec.ts`: fermate `highway=bus_stop` da OSM, quadro EAV completo
  nel telefono, linee sospese escluse, `tripLine('baia_station') === 'bus_101'`,
  binari solo sulle stazioni ferroviarie attive e zero treni fuori binario.
- `m6_performance.spec.ts`: boot, FPS, heap e numero di texture misurati su
  desktop e mobile; le facciate delle altre regioni entrano in memoria solo
  all'arrivo nella regione.

## QA visivo

- Zona campione (centro storico) in `docs/M6_SCREENSHOTS/00-prima-*`,
  `01-dopo-*` e `02-zona-campione-*`; analisi e difetti corretti in
  `docs/M6_SAMPLE_QA.md`.
- Nove regioni, desktop e mobile, in `docs/M6_SCREENSHOTS/regioni/`; baseline M5
  in `docs/M5_SCREENSHOTS/` ripristinata e immutata.
- Statistiche deterministiche della campione: pixel scuri `0,52% → 6,77%`,
  grigio asfalto `1,89% → 23,52%`, luminanza `128,6 → 136,0`. Il residuo scuro
  è basolato lavico `RGB(65,66,63)`, non asfalto nero.
- Ollama `qwen2.5vl:3b` è stato usato solo come supporto descrittivo; la
  certificazione resta ancorata a screenshot e misure deterministiche.

## Prestazioni misurate (dev server, headless)

| Profilo | Boot | FPS | Heap JS | Texture iniziali | Dopo Torregaveta |
|---|---:|---:|---:|---:|---:|
| chromium-desktop | 2.178 ms | 26 | 133 MB | 307 | 389 |
| mobile-android | 2.017 ms | 48 | 117 MB | 307 | 389 |

Le 307 texture iniziali sono quelle comuni più la sola regione di partenza;
le 389 dopo il viaggio includono le facciate di Torregaveta, non tutte le 835.

## Difetti reali trovati e corretti in fase finale

1. `templateFor()` dava priorità a `kind === 'home'` sul nome OSM: un B&B restava
   un interno generico. Ora il nome/dato OSM guida il template.
2. `InteriorScene` riutilizzava arredi e personale della visita precedente: ora
   `create()` azzera `furniture`, `staff` e `interactionCount`.
3. Il protagonista era bloccato dal proprio solido: `movePlayer()` passa
   `ignoreId = 'player'` al sistema di collisioni.
4. `__bacoliDebug()` leggeva `player.anims` durante il riavvio della scena e
   `update()` muoveva sprite già distrutti mentre il loader caricava le facciate:
   ora entrambe le fasi hanno guardie esplicite. Il caricamento dinamico arriva
   al 100% senza errori console.

## Limiti dichiarati

- Nessun test su smartphone fisico: i controlli touch sono verificati solo in
  emulazione Android.
- Il bundle supera 500 kB (warning Vite noto); il caricamento delle immagini di
  regione è già differito.
- I piani degli edifici OSM restano stime esplicite dall'area dell'impronta,
  perché i tag `building:levels`/`height` non sono presenti nell'area.
- La qualità grafica non è delegata a Ollama né ai soli test: screenshot e
  statistiche qui elencati sono la referenza di certificazione.
