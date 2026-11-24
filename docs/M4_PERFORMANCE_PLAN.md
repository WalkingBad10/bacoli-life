# BACOLI LIFE — Piano di performance / Milestone 4

Data: 2026-11-24. Documento di sola analisi: **non modifica alcun file di gioco**.
Il roadmap (`docs/ROADMAP.md`) chiama “Fase 6” l’ottimizzazione; qui si usa la
nomenclatura **M4** richiesta per questo piano.

Fonti lette: `vite.config.ts`, `package.json`, `src/main.ts`,
`src/scenes/BootScene.ts`, `src/scenes/WorldScene.ts`, `docs/PROGRESS.md`
(più letture di contesto: `AudioSystem`, `Hud`, `CollisionSystem`,
`Pathfinding`, `NpcRoutineSystem`, `InteriorScene`, `TransitScene`,
`playwright.config.ts`, `tests/e2e/game.spec.ts`). Dimensioni verificate con
PowerShell/.NET su `dist/` e `public/assets/`.

---

## 1. Baseline misurata

### 1.1 Bundle e rete

| Elemento | Misura reale | Nota |
| --- | --- | --- |
| `dist/assets/index-CxkSJq6s.js` | **1.366.908 B** (1,30 MiB), gzip **375.062 B** | warning Vite >500 kB (`PROGRESS.md` riporta 1.366,91 kB / 377,38 kB) |
| `phaser/dist/phaser.esm.min.js` | 1.197.130 B, gzip 317.470 B | ~88 % del JS raw, ~85 % del gzip: Phaser domina il bundle |
| `phaser/dist/phaser-arcade-physics.min.js` | 1.086.308 B, gzip 284.145 B | **-110.822 B raw / -33.325 B gzip** rispetto a ESM completo |
| `howler/dist/howler.min.js` | 36.173 B | peso trascurabile |
| `public/assets/maps/bacoli.json` | **1.422.574 B**, gzip **43.666 B** | caricato **due volte** in `BootScene` (`tilemapTiledJSON` + `json`) |
| Layer `ground` | 480×680 = 326.400 indici, tutti 1..16 | 326.400 numeri JS dopo il parse |
| Layer `collision` | 326.400 valori, **154.782 solidi** | altri 326.400 numeri JS dopo il parse |
| 98 PNG | 108.134 B totali | di cui 48 facciate = **77.376 B** (1,6 kB media) |
| 41 sprite PNG | 16.274 B | 9 character sheet + veicoli, arredi, props |
| 5 WAV audio | **1.921.708 B** totali | gzip li porta solo a ~1.473.000 B: il codec è il problema |
| CSS | 4.033 B | ok |

Il payload iniziale è quindi ~4,8 MB raw (o ~2,45 MB se il server applica gzip
a JS/JSON). **La mappa compressa e l’audio WAV, non le immagini, sono i pesi
reali del caricamento.**

### 1.2 Contenuto del mondo / oggetti a schermo

Dati misurati/derivati dal codice:

- 303 luoghi, **281 con footprint** ⇒ 281 sprite `building_fine_*` creati in
  `spawnProps()`.
- `for (i += 3)` ⇒ circa **101** palme/ulivi.
- **54** dettagli urbani (`spawnUrbanDetails()`).
- **24 NPC** (`NPC_PROFILES`), **8 veicoli di traffico**, 1 veicolo iniziale,
  **9 lampade + 9 glow**, **9 barche**, ~9 prop fissi, 1 player, 1 overlay,
  opzionale emitter pioggia.

Display list di `World`: **≈500 GameObjects** (281 + 101 + 54 + 9 + 9 + 9 + 9
+ 24 + 8 + 1 + … + tilemap layer). Le texture sono circa 100 (98 file + 2
canvas `glow`/`raindrop`): poche e piccole, quindi il collo di bottiglia non è
la memoria GPU ma **ordinamento, batch e aggiornamenti per frame**.

Costo per frame osservato nel codice:

- `setDepth(y)` ogni frame su player, 24 NPC, 8 veicoli traffico, animali:
  **~34-36 chiamate/frame**. In Phaser 3 `Depth.set` chiama
  `displayList.queueDepthSort()`, quindi **la display list di ~500 oggetti
  viene riordinata ogni frame**.
- `Hud.update()` scrive `innerHTML`, `className`, `style.width` e testo
  **ogni frame**, anche quando ora/denaro/tempo non cambiano.
- `updateNpcs()`: `routineSlot()` fa `NPC_PROFILES.find()` per NPC per frame
  (fino a ~576 confronto/frame), `anims.play(..., true)` ogni frame, e fino a
  **3 A* per frame** (`pathBudget = 3`, `findPath` con `maxNodes = 6000` e
  `open.sort()` dentro il ciclo).
- `waterTiles` fino a 1400 tile: ciclo e assegnazione `tile.index` ogni 260 ms.
- `AudioSystem` è un field initializer di `WorldScene`: i 5 `new Howl(...)`
  partono con `preload: true` ⇒ **1,92 MB scaricati al boot**, prima ancora del
  gesto utente che avvia l’audio.

Nota mobile: con `CAMERA_ZOOM = 2` e viewport CSS Pixel 7 (412×915) si vedono
circa 13×29 tile, **meno** del desktop 1280×720 (circa 40×23). Il problema su
smartphone non è il numero di tile visibili ma il backbuffer ad alta densità
(lo screenshot storico è 1082×2202 px fisici), il fill rate e il lavoro CPU per
frame descritto sopra.

---

## 2. Priorità e impatto atteso

| Priorità | Azione | Impatto stimato | Sforzo | Rischio |
| --- | --- | --- | --- | --- |
| **P0-1** | Compattare la mappa in binario e caricare una sola volta | -1,05 MB raw (-74 %), -12 kB gzip, -1 parse, -326k numeri JS | 1-2 gg | basso |
| **P0-2** | Audio lazy + codec lossy | 0 byte audio al boot; -1,4…1,6 MB raw dopo conversione | 1 gg | basso |
| **P0-3** | Eliminare `setDepth` per frame e cache HUD | rimozione sort di ~500 oggetti/frame, meno reflow DOM | 0,5-1 gg | basso |
| **P1-1** | Build Phaser “arcade only” | -111 kB raw / -33 kB gzip (~8-9 %) | 0,5 gg | medio |
| **P1-2** | `manualChunks` + sogliatura documentata | 0 byte in meno; cache migliore, warning governato | 0,5 gg | basso |
| **P1-3** | Dynamic import di `Interior`/`Transit` e delle loro texture | -30…60 kB JS iniziale, ~14 kB texture differite | 1 gg | medio (hook E2E) |
| **P1-4** | Culling/intervalle su acqua, pioggia, NPC | picchi CPU più bassi, FPS più stabili | 1 gg | basso |
| **P2-1** | Pool + separazione dati/logica NPC | 50-100 pedoni con costo simile agli attuali 24 | 3-5 gg | medio |
| **P2-2** | Atlas facciate + pooled facciate per chunk | -50 kB rete potenziali, meno batch/sort | 2 gg | medio |
| **P2-3** | Custom build Phaser ancora più stretto | -200…400 kB raw *da misurare* | 3-5 gg | alto |

**Valutazione onesta sul warning >500 kB:** con Phaser completo un singolo
chunk <500 kB raw non è realistico senza rinunciare a funzionalità del motore.
L’obiettivo sano è: (a) separare Phaser in un chunk vendor cached, (b) ridurre
gzip e tempo di boot con P0/P1, (c) dichiarare esplicitamente l’eccezione
Phaser con `chunkSizeWarningLimit` **solo dopo** aver misurato che il chunk
applicativo resta piccolo. Non usare la soglia come unico “fix”.

---

## 3. P0 — interventi a maggior ritorno

### P0-1 · Mappa: 1,42 MB JSON ×2 → 367 kB binario ×1

Stato attuale in `BootScene.preload()`:

```ts
this.load.tilemapTiledJSON('bacoli', 'assets/maps/bacoli.json');
this.load.json('mapdata', 'assets/maps/bacoli.json'); // stesso URL, secondo parse
```

`WorldScene.loadCollision()` rilegge `cache.json.get('mapdata')` e costruisce
`Uint8Array(326400)`. `WorldScene.create()` usa il tilemap Tiled per il layer
`ground`.

Piano:

1. Nuovo tool offline (proposto `tools/pack_map.mjs`, non creato ora) che legga
   `public/assets/maps/bacoli.json` e produca:
   - `bacoli-ground.bin`: 326.400 byte, indice tile 1..16 (u8, senza separatori).
   - `bacoli-collision.bin`: 40.800 byte, 1 bit per tile (154.782 bit a 1).
   - `bacoli-map.meta.json`: `<500 B` con `width=480`, `height=680`,
     `tileWidth=16`, `tileHeight=16`, nome tileset `base`.
2. In `BootScene`: `load.arrayBuffer('groundBin', ...)`,
   `load.arrayBuffer('collisionBin', ...)`, `load.json('mapmeta', ...)`.
   Rimuovere entrambi i caricamenti di `bacoli.json`. Tenere il file Tiled
   originale solo come sorgente del tool (non più pubblicato in `dist/`).
3. In `WorldScene.create()`: ricostruire le righe dal buffer e usare
   `this.make.tilemap({ data: rows, tileWidth: 16, tileHeight: 16 })`, stessa
   tecnica già usata da `InteriorScene` con `data: grid`. Poi
   `map.addTilesetImage('base', 'tiles16')` (verificare il nome con un build).
4. In `loadCollision()`: ricostruire `blocked[i] = (bits[i >> 3] >> (i & 7)) & 1`
   e passare l’`Uint8Array` a `CollisionSystem`; i footprint dei 303 luoghi
   continuano a essere applicati dal costruttore di `CollisionSystem`.

Risultato atteso:

| | Prima | Dopo |
| --- | --- | --- |
| File mappa raw | 1.422.574 B, caricato 2 volte | 367.200 B + meta, 1 sola volta |
| Gzip della mappa | 43.666 B ×2 | 28.125 + 3.457 = **31.582 B** |
| Numeri JS dopo parse | 652.800 | 0 array di numeri (solo typed array) |
| Request HTTP | 2 | 3 (2 bin + 1 meta), tutte piccole |

Fallback più semplice se si vuole evitare il cambio di API: pubblicare
`bacoli.json.gz` (43.666 B) e decompressarlo con `DecompressionStream` in
`BootScene`, mantenendo un solo `tilemapTiledJSON` costruito a mano. Risparmio
solo sul transfer (~12 kB gzip e una request), non sul parse.

### P0-2 · Audio: non scaricare 1,92 MB prima del gioco

`src/systems/AudioSystem.ts` crea 5 `Howl` con `preload` implicito `true`.

Piano:

1. `preload: false` su tutti i suoni.
2. `start()` carica solo `music`, `sea`, `gulls` (e imposta `Howler.volume`),
   dopo il primo `keydown`/`pointerdown` — Phaser/Howler richiedono comunque un
   gesto utente.
3. `setWeather('rain')` carica `rain` la prima volta; `ringBell()` carica
   `bell` alla prima occorrenza.
4. Convertire i WAV sorgente in OGG/MP3 (Howler sceglie il formato supportato),
   tenendo WAV solo come fallback se necessario. Stima: 1,92 MB → 0,3-0,5 MB.

Impatto: **0 byte audio nella critical path**, risparmio di 1,4-1,6 MB raw.
Verifica: `page.on('response')` non deve vedere `.wav` prima del primo input.

### P0-3 · Profondità e HUD: togliere lavoro ripetuto ogni frame

**Depth.** In `WorldScene` i punti caldi sono `movePlayer()`,
`updateNpcs()`, `updateTraffic()`, `updatePetSprites()`. Invece di
`setDepth(y)` a ogni frame:

- quantizzare a `Math.floor(y / 16)` e chiamare `setDepth` **solo se il bucket
  cambia** (un NPC che cammina a 30 px/s cambia bucket ~2 volte/s, non 60);
- oppure mettere solo gli attori in un `Phaser.GameObjects.Layer` dedicato e
  ordinare quello, lasciando la display list principale statica (facciate,
  alberi, lampade restano a profondità fissa);
- mantenere `overlay` (9000) e pioggia (9500) fuori dal layer attori.

**HUD.** `Hud.update()` deve memorizzare `lastClock`, `lastWeather`,
`lastMoney`, `lastEnergy`, `lastHunger` e scrivere il DOM solo se il valore
cambia; usare `textContent` invece di `innerHTML` per la chip meteo (oggi
ricrea HTML ogni frame). L’energia cambia solo quando si corre: aggiornare a
10 Hz è sufficiente.

**Altri piccoli cycle:**

- `applyWeather()`/overlay/glow: l’alpha cambia con `daylight` ma può essere
  quantizzato a 1/60 e aggiornato ogni ~100 ms senza differenza visibile.
- `waterTiles`: restringere il ciclo ai tile che intersecano
  `cameras.main.worldView` (con margine di 1 tile) e portare l’intervallo da
  260 ms a 400 ms su mobile; il numero di tile animati passa da 1400 a poche
  decine.
- `anims.play(..., true)` per NPC: chiamarlo solo quando cambia `dir` o quando
  il path passa da vuoto a non vuoto; `anims.stop()` solo sul cambio a vuoto.

Impatto atteso: rimozione di ~35 `queueDepthSort()`/frame e di ~60 scritture
DOM/frame; minore varianza del frame time su Android emulato.

---

## 4. P1 — riduzione reale del bundle e code splitting

### P1-1 · Phaser “arcade only”

Il gioco non configura `physics` e non usa Matter; `BootScene` però importa
`phaser` completo. Opzione concreta:

```ts
// vite.config.ts
export default defineConfig({
  resolve: {
    alias: { phaser: 'phaser/src/phaser-arcade-physics.js' },
  },
  // ...
});
```

L’entry `phaser/src/phaser-arcade-physics.js` include Tilemaps, Particles,
Animations, Cameras, Input, Tweens e Arcade Physics, ma non Matter. Il confronto
tra i minified distribuiti dà **-110.822 B raw / -33.325 B gzip**.

Acceptance: `npm run build` + 26/26 E2E + screenshot QA identici. Se l’interop
CJS/ESM di Vite fallisce, provare come fallback l’UMD
`phaser/dist/phaser-arcade-physics.js`; se fallisce ancora, **revertire** e
passare a P2-3. I tipi TypeScript restano quelli di `phaser`.

### P1-2 · `manualChunks` (cache, non miracoli)

```ts
build: {
  target: 'es2022',
  outDir: 'dist',
  assetsInlineLimit: 0, // mantenere: evita base64 dentro il JS
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules/phaser')) return 'phaser';
        if (id.includes('node_modules/howler')) return 'howler';
      },
    },
  },
  // DOPO aver misurato i nuovi chunk:
  // chunkSizeWarningLimit: 1200,
}
```

Effetto: `phaser-*.js` ~1,1 MB (cached a lungo), `index-*.js` ~150-250 kB
(contenente tutto il codice BACOLI LIFE e `bacoli_places.json` da 87 kB),
`howler-*.js` ~36 kB. **I byte totali non cambiano**: il vantaggio è
invalidazione/caching e la possibilità di dire che il chunk applicativo è
<500 kB. La soglia va alzata solo con un commento che documenti il motivo.

### P1-3 · Dynamic import delle scene poco usate

Oggi `src/main.ts` importa tutte e quattro le scene:

```ts
import { BootScene } from './scenes/BootScene';
import { WorldScene } from './scenes/WorldScene';
import { InteriorScene } from './scenes/InteriorScene';
import { TransitScene } from './scenes/TransitScene';
// ...
scene: [BootScene, WorldScene, InteriorScene, TransitScene],
```

Piano:

1. `main.ts` registra solo `BootScene`.
2. `BootScene.preload()` avvia `const worldPromise = import('../scenes/WorldScene')`
   in parallelo al caricamento asset; `create()` fa
   `this.scene.add('World', new WorldScene(), true)` dopo l’await. Mostrare un
   testo di loading minimo nel frattempo.
3. `WorldScene.enterInterior()` e `travel()` fanno
   `await import('../scenes/InteriorScene')` / `../scenes/TransitScene`,
   registrano la scena e poi la lanciano.
4. Spostare fuori da `BootScene` le texture esclusive:
   `room_floors.png` (379 B) e le 13 `f_*.png`, caricate in `preload()` di
   `InteriorScene` (o in un loader comune richiamato prima del `scene.launch`).
   `Train.png` (263 B) non è usato da nessuna parte: rimuoverlo dal preload.
5. Rimuovere anche le 6 texture legacy `building_0..5` (11.556 B): il codice
   usa solo `building_fine_*`.

Nota E2E: `__bacoliTest.travel()` e la pressione di `E` diventano asincroni;
i test devono già usare `waitForFunction` su `__bacoli.scene.getScene(...)`,
come oggi.

Impatto: -30…60 kB di JS iniziale e ~14 kB di texture in meno al boot; guadagno
principale è la critical path più corta, non il warning.

### P1-4 · Caricamento dinamico delle zone/facciate

Le 48 facciate pesano solo 77 kB totali: **caricarle a chunk non conviene
ancora**. La mappa binaria (P0-1) rende il loro costo relativo trascurabile.

Se in futuro si aggiungerà Pianura (ROADMAP Fase 5), allora:

- suddividere il mondo in chunk 120×170 tile (4×4 = 16 zone);
- un manifest per zona con i `place.id` e le varianti facciata (circa 18
  facciate/area, ~29 kB/area);
- caricare il pack al primo ingresso della camera nella zona, mantenendo un
  buffer di una zona vicina per evitare pop-in;
- tenere il tilemap ground globale (367 kB binari) perché il costo di uno
  stream per chunk supererebbe il beneficio.

Per ora l’azione utile è **non aumentare** il numero di texture: le 48 varianti
sono già deterministiche e riusate su 281 edifici.

---

## 5. P2 — fluidità e scaling dei pedoni

### 5.1 Pooling e culling degli attori

Obiettivo: poter passare da 24 a 50-100 NPC/pedoni senza aumentare il costo
per frame.

1. **Dati separati dalla logica di rendering.** Creare un modello puro, senza
   import di Phaser, per esempio `src/systems/NpcAgentSystem.ts`:

   ```ts
   interface NpcAgent {
     id: string;
     profileId: string;   // indice in NPC_PROFILES, non nome da cercare
     x: number; y: number;
     prevX: number; prevY: number;
     target: { x: number; y: number } | null;
     path: { x: number; y: number }[];
     speed: number;
     slot: RoutineSlot;
     timer: number;
   }
   ```

   `WorldScene` resta il solo posto che crea/aggiorna gli sprite e influenza
   `CollisionSystem`. Questo rende la simulazione testabile in Vitest senza
   canvas e permette di cambiare renderer senza toccare le routine.

2. **Tick fisso a 10 Hz (100 ms)** per: cambio `slot`, nuova destinazione, A*,
   avanzamento lungo il path. Nel render a 60 Hz si fa solo interpolazione
   `sprite.x = lerp(agent.prevX, agent.x, alpha)`. Costo AI per frame:
   ~1/6 dell’attuale, indipendente dal refresh rate.

3. **Budget A* esplicite:** al massimo 1 ricerca ogni 100 ms,
   `maxNodes = 2000-3000`, heap al posto di `open.sort()`, e cache
   `pathCache[key = profileId|slot|waypointId]`. `routineTarget()` oggi chiama
   `findVehicleSpot()` (scansione di anelli + `canStand`) per ogni nuovo path:
   precalcolare 2-3 punti di sosta validi per luogo e usarli come waypoint.

4. **Culling con pool.** Mantenere tutti gli agenti nel modello, ma creare
   sprite solo per gli agenti dentro `camera.worldView` espansa di 64 px:
   - `SpritePool` per chiave texture (`npc_1`…`npc_8`), `acquire()`/`release()`;
   - NPC fuori vista continuano a camminare nel modello, senza sprite, anim e
     `setDepth`;
   - limitare a ~16-20 sprite NPC animati simultaneamente (nel viewport mobile
     con zoom 2 ce ne stanno pochissimi, quindi il limite non è visibile);
   - liberare lo sprite quando l’agente esce dal margine; riattaccarlo al
     rientro senza riavviare il path.

5. **Profondità a bucket** come in P0-3: aggiornare il depth solo quando
   `floor(y/16)` cambia. Con il pool gli sprite in display list passano da ~500
   a ~150-250.

Con questi accorgimenti il costo resta sostanzialmente costante all’aumentare
degli NPC: si paga per gli **attori visibili**, non per il totale. I 24 NPC
narrativi (matrimonio, affordance) restano sempre nel modello; i pedoni extra
possono essere generati come agenti decorativi senza dialoghi e senza
relazioni.

### 5.2 Texture, batch, profondità

- Eliminare il doppio caricamento di `tileset.png`: oggi è sia `image`
  `'tileset.png'` sia `spritesheet` `'tiles16'` (2,1 kB duplicati). Usare
  `'tiles16'` come chiave del tileset in `WorldScene.addTilesetImage()` e
  nelle `tileSprite` di `InteriorScene`, verificando che il source image sia
  lo stesso.
- Valutare un **atlas** delle 48 facciate (un’unica texture base): riduce il
  numero di texture bind in WebGL e i 48 file HTTP. Guadagno rete modesto
  (77 kB → forse 60 kB), guadagno batch medio.
- Non aumentare `roundPixels`/`antialias`: la configurazione attuale
  (`pixelArt: true`, `antialias: false`, `roundPixels: true`) è già quella
  corretta per il target.
- Verificare `canvas.width`/`canvas.height` rispetto a `window.innerWidth` su
  Pixel 7 emulato. Se il backbuffer supera ~1,5× i CSS pixel, usare una scala
  virtuale `Phaser.Scale.FIT` (per esempio 960×540 con letterbox) o un cap del
  DPR lato canvas: si taglia il fill rate senza cambiare la logica di camera.

---

## 6. Verifiche: come misurare il miglioramento

### 6.1 Build size (deterministico, in CI)

Aggiungere uno script (proposto `scripts/check-bundle.mjs`) che legga
`dist/assets/*.js` e fallisca se:

| Metrica | Baseline | Target M4 |
| --- | --- | --- |
| JS iniziale raw | 1.366.908 B | ≤ 1.270.000 B dopo P1-1 |
| JS iniziale gzip | 375.062 B | ≤ 342.000 B |
| Chunk applicativo (non Phaser) | ~170 kB raw | ≤ 250 kB |
| Chunk Phaser | ~1,1 MB | eccezione documentata, non “nuovo warning” |
| `bacoli.json` in `dist/` | presente | assente (sorgente solo per il tool) |
| Audio scaricato al boot | 1,92 MB | 0 B |

`npm run build` deve restare verde (`tsc --noEmit` + Vite). Se si alza
`chunkSizeWarningLimit`, deve esserci un commento con i numeri misurati.

### 6.2 Hook E2E read-only

Estendere l’hook già presente in `WorldScene.create()` con un oggetto
`window.__bacoliPerf` (solitamente read-only; solo `snapshot()`):

```ts
window.__bacoliPerf = {
  snapshot: () => ({
    fps: game.loop.actualFps,
    frameMs: { p50, p95 },                 // ring buffer di ~300 campioni
    displayObjects: this.children.list.length,
    actors: this.npcs.length + this.traffic.length,
    visibleActors: /* intersezione con camera.worldView */,
    textureKeys: this.textures.getTextureKeys().length,
    depthSortsPerFrame: /* contatore */,
    pathSearches, pathMsTotal,              // contatori incrementati in updateNpcs
    waterTilesUpdated,
    audioPreloaded: /* booleano */,
  }),
};
```

Mantenere `__bacoliDebug`, `__bacoliTest` e `__bacoliTransit` compatibili:
gli E2E esistenti li usano ampiamente. I nuovi contatori devono essere
zero overhead quando `__bacoliPerf` non viene chiamato (incrementi interi,
nessuna allocazione per frame).

### 6.3 Playwright: suite `perf` separata

`playwright.config.ts` oggi punta a `npm run dev` (server Vite non minificato):
**non usarlo per misurare performance**. Creare un secondo progetto/config
(`playwright.perf.config.ts`) con:

- `webServer.command: 'npm run build && npm run preview -- --port 4174'`;
- `baseURL: 'http://127.0.0.1:4174'`;
- stessi due progetti `chromium-desktop` e `mobile-android` (Pixel 7);
- contesto fresco per ogni run, 3 ripetizioni, mediane;
- opzionale throttling CDP `Emulation.setCPUThrottlingRate` a 4× per simulare
  un entry-level.

Test proposti in `tests/e2e/perf.spec.ts`:

1. **Cold boot**: da `page.goto('/')` a `#game canvas` visibile e a
   `typeof __bacoliDebug === 'function'`. Target iniziale da tarare sul
   baseline: desktop ≤ 3 s, Android emulato ≤ 5 s (senza throttling).
2. **Rete**: `page.on('response')` conta le request:
   - `assets/maps/bacoli.json` = **0**;
   - `bacoli-ground.bin` + `bacoli-collision.bin` + meta = **1 ciascuno**;
   - nessun `.wav` prima del primo `keydown`/`pointerdown`;
   - `performance.getEntriesByType('resource')` per verificare
     `transferSize`/`encodedBodySize` (se il server espone header CORS/timing).
3. **Stabilità frame**: tenere premuto `D` per 5 s, campionare
   `__bacoliPerf.snapshot()` ogni 250 ms; soglie dopo aver misurato il baseline
   con un margine del 15 %: mediana FPS ≥ 50 desktop / ≥ 30 Android, p95 frame
   time ≤ 33 ms / ≤ 50 ms, al massimo 2 long task >100 ms.
4. **AI budget**: `pathSearches` ≤ 10 in 5 s a 10 Hz, `pathMsTotal` < 150 ms
   cumulati; `walkingNpcs` da `__bacoliDebug` resta > 0 (la simulazione non si
   è fermata).
5. **Regressione visiva**: riutilizzare gli screenshot/OpenCV già descritti in
   `PROGRESS.md` (desktop 1280×720, Android 1082×2202, densità bordi
   0,04-0,17) per confermare che culling/pooling non abbiano introdotto pop-in.

Le soglie FPS vanno fissate **dopo** una prima run di baseline: meglio un
confronto A/B (prima/dopo) con numeri salvati in `PROGRESS.md` che un valore
assoluto troppo severo e flaky su CI.

---

## 7. Sequenza operativa consigliata

1. **Giorno 1** — P0-1 (mappa binaria) + P0-2 (audio lazy). Eseguire build,
   59 test unitari, 26 E2E, controllare le request con Playwright.
2. **Giorno 2** — P0-3 (depth/HUD/water) + hook `__bacoliPerf`. Misurare FPS
   prima/dopo sulla suite perf.
3. **Giorno 3** — P1-1 (Phaser arcade) + P1-2 (`manualChunks`). Se E2E passano,
   aggiornare `chunkSizeWarningLimit` con commento documentato.
4. **Giorno 4** — P1-3 (dynamic import scene + texture differite) e adattare i
   test E2E all’asincronicità.
5. **Giorno 5+** — P2-1 (pool NPC, tick 10 Hz, dati separati) solo se serve
   aumentare il numero di pedoni; P2-2/P2-3 come optional.

**Checklist di accettazione M4**

- [ ] Nessun `bacoli.json` scaricato a runtime; 1 sola costruzione del tilemap.
- [ ] Nessun audio richiesto prima del primo input; codec lossy in `dist/`.
- [ ] `setDepth()` non chiamato ogni frame su actor visibili.
- [ ] HUD non scrive DOM quando i valori non cambiano.
- [ ] Phaser in chunk vendor separato; warning gestito con numeri documentati.
- [ ] `Interior`/`Transit` e le loro texture non sono nel critical path.
- [ ] 59/59 unitari e 26/26 E2E ancora verdi su desktop + Android emulato.
- [ ] Baseline performance (build size, boot, FPS, request) registrata in
      `docs/PROGRESS.md` con confronto prima/dopo.
