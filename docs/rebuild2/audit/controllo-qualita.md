# Controllo qualità — perché 163 test verdi non certificano il gioco

Data: 25 novembre 2026 · Branch analizzato: `rebuild-2.0` · Ambito: **solo analisi**. Non ho modificato codice, configurazioni, asset né altri progetti; unico file scritto è questo documento.

## Verifica eseguita (non fidandosi dei report)

| Verifica | Comando / azione | Risultato osservato |
|---|---|---|
| Test unitari | `npm.cmd test -- --reporter=dot` | **99/99 passati**, 19 file, 2,11 s |
| Test E2E | `node node_modules/@playwright/test/cli.js test --list` | **64 test enumerati** (32 × `chromium-desktop`, 32 × `mobile-android`), 9 file → 99 + 64 = **163** |
| Esecuzione E2E completa | **Non eseguita** | I test scrivono `screenshots/*.png` e `docs/M6_SCREENSHOTS/*.json`; eseguirli avrebbe modificato file fuori dal perimetro consentito. Ho quindi verificato enumerazione, codice e artefatti già prodotti |
| Validatori Python | `python tools/validate_geography.py`, `validate_m5_world.py`, `check_proportions.py` | Tutti **OK**: 226 impronte OSM, 30.397 tile strada, 256 luoghi; 9 regioni, 3.800 luoghi, 3.460 edifici, 3.363.319 tile solidi; 30 asset, scala 1 m = 16 px |
| Conteggio asserzioni | Analisi statica dei file test | Unit: 514 `expect()`, 0 hook, 0 screenshot. E2E: **174 `expect()`, 135 riferimenti a `__bacoli*`hook, 9 `page.screenshot()`, 0 `toHaveScreenshot()`** |
| Ricalcolo geometrico | Script read-only su `src/data/bacoli_centro.json` con le stesse formule di `WorldScene.spawnProps()` | **36/226** edifici hanno `facadeWidth` diverso dalla larghezza dell'impronta OSM; **45 coppie** di rettangoli-facciata si sovrappongono (fino a 160×76 px) |
| Screenshot segnalato | Istogramma/Ollama locale | `screenshot_utente.png` è 1152×1536, V<70 = **45,92%**, densità bordi 2,75%; non corrisponde ad alcuno screenshot del progetto (distanza istogramma minima ≈0,206) |
| Ollama | Prompt neutrale vs prompt diretto | Con il prompt usato in `tools/rebuild2_describe_screenshot.py` risponde “nessun difetto evidente”; con un prompt che chiede esplicitamente i difetti elenca personaggio troppo piccolo, veicoli male orientati, tetti tagliati, marciapiedi minuscoli, oggetti fluttuanti, nessun landmark, HUD non visibile. **Lo stesso prompt diretto produce la stessa lista anche sugli screenshot M6 “certificati”**: il modello non è un oracolo deterministico |

---

## 1. Perché i test sono verdi ma il gioco è difettoso

### 1.1 L'oracolo è lo stato interno, non l'immagine

I 99 test unitari sono quasi interamente test di sistemi puri (economia, salvataggi, carriera, consegne, orari): 514 asserzioni corrette, ma sul modello dati. I 64 test E2E contengono 174 asserzioni, di cui **135 referenziano `__bacoliDebug`, `__bacoliTest` o `__bacoliTransit`** e **nessuna confronta pixel**: i 9 screenshot vengono scritti su disco e mai giudicati dal test. Non esiste un solo `toHaveScreenshot()`, `pixelmatch` o confronto OpenCV dentro Playwright.

Gli hook non sono nemmeno esclusivi del dev server: `src/main.ts:31` espone `__bacoli` sempre e `src/scenes/WorldScene.ts:345-532` installa `__bacoliDebug()` e `__bacoliTest()` incondizionatamente, anche nel bundle di produzione. Il test legge quindi lo stesso stato che il codice sotto test ha appena scritto: è un controllo di coerenza interna, non di qualità percepita.

### 1.2 I test usano teletrasporti e input artificiali dove serve provare il percorso reale

- `tests/e2e/game.spec.ts:85-101`: il test “il giocatore non attraversa edifici” chiama `__bacoliTest.findWall()` e **`teleport()`** alla partenza, poi tiene premuto solo `KeyD` per 1 s e verifica `x < boundary`. Non parte dallo spawn, non prova le quattro direzioni, non verifica la velocità e non dimostra di aver realmente tentato l'attraversamento.
- `tests/e2e/m6_actors.spec.ts:46-68`: cerca una piazzola libera e fa **`teleport()`** prima del WASD; il test verifica che i tasti muovano lo sprite di `>1 px` in 230 ms, non che il personaggio attraversi/aggiri il mondo a 92 px/s (`src/core/config.ts:4`).
- `tests/e2e/m6_sample.spec.ts:44`: la “zona campione” viene inquadrata con **`teleport(324*16+8, 478*16+8)`**, non raggiunta camminando.

Un teletrasporto può mascherare esattamente i difetti di collisione, di ancoraggio a terra e di prospettiva che l'utente segnala.

### 1.3 Soglie che misurano l'esistenza, non la qualità

| Asserzione | Soglia | Cosa dovrebbe misurare |
|---|---|---|
| `m5_regions.spec.ts:36-37` | `places > 2`, `solidTiles > 0` | Correttezza geografica e rendering della regione |
| `m6_sample.spec.ts:57-59` | `busStops > 0`, `actors.length > 40` | Qualità visiva della zona campione |
| `m6_urban.spec.ts:19-20` | `spots > 25`, `lamps > 5` | Collocazione reale su marciapiede |
| `m6_traffic.spec.ts:44` | passo `< 24 px` in 250 ms | Un'auto a 30 px/s fa 7,5 px; la soglia è ~3,2× il limite e consentirebbe un salto di 96 px/s |
| `m6_traffic.spec.ts:47` | `stalls < 46` | Il codice azzera `stalls` a `>45` (`WorldScene.ts:1325`), quindi il test tollera quasi qualsiasi stallo |
| `m6_performance.spec.ts:48` | FPS `> 20` | Il documento riporta 26 FPS desktop: una regressione grave passerebbe ancora |
| `m6_performance.spec.ts:23,58` | texture `< 400` / `< 600` | Non è una soglia di qualità visiva, solo di memoria |

«Passa» qui significa «esiste un numero», non «il numero è corretto».

### 1.4 Il QA visivo è fuori dal gate automatico

- `m5_regions.spec.ts` e `m6_sample.spec.ts` salvano screenshot ma non li analizzano.
- `tools/check_m5_screenshots.py:22` legge **solo `docs/M5_SCREENSHOTS`**: gli screenshot M6 in `docs/M6_SCREENSHOTS` non vengono mai verificati da quello script.
- Le statistiche citate in `docs/M6_SAMPLE_QA.md` (V<70 6,77%, grigio asfalto 23,52%, luminanza 136,0) e in `docs/M6_FINAL_QA.md:47-49` non sono asserzioni eseguibili: sono numeri in un markdown, non un gate.
- `tools/check_screenshots_vision.py` usa Ollama `qwen2.5vl:3b`, **inghiotte le eccezioni** (`:75-77`) e produce prosa, non esiti.
- `docs/M6_FINAL_QA.md:50-51` e `docs/M6_SAMPLE_QA.md:61-63` dichiarano Ollama “solo supporto descrittivo”. La verifica empirica conferma che è anche incoerente: due prompt diversi danno giudizi opposti sugli stessi frame. Non può essere usato né come certificazione né come negazione dei difetti.

### 1.5 La build di produzione non è coperta

`playwright.config.ts:20` avvia `npm run dev -- --port 4173`: tutti i 64 test girano sul dev server. `npm run build` è solo un controllo di compilazione (`tsc --noEmit && vite build`). `.github/workflows/deploy.yml:26-31` esegue `npm ci`, `npm run build` e pubblica `dist` **senza eseguire né Vitest né Playwright**. `tools/check_live.mjs` controlla soltanto clock, `places` e assenza di errori console sulla live. Non esiste quindi alcun test che dica: «il bundle effettivamente distribuito, con minification, base `./` e caricamento asincrono delle facciate, è visivamente corretto».

### 1.6 Validatori autoreferenziali e coerenza equivalente a qualità

`tools/validate_geography.py:20` importa `build_map_centro` e confronta il dataset generato con le proiezioni calcolate dallo stesso generatore: può fallire se i dati si corrompono, ma non può dire se l'inquadratura è bella, se la facciata scelta è proporzionata o se i tetti risultano tagliati. Allo stesso modo `check_proportions.py` verifica che `facadeWidth` sia in un insieme ammesso, non che corrisponda all'impronta OSM: per questo 36 edifici passano il controllo pur avendo una facciata più larga o più stretta del lotto reale.

### 1.7 Il conteggio dei test è una metrica di attività, non di rischio

163 = 99 test di logica + 64 duplicazioni dei medesimi 32 scenari su due viewport. Il rischio visivo (geometria, scala, occlusione, prospettiva, orientamento, geografia) ha **zero test dedicati**. Inoltre la maggior parte degli scenari usa `waitForTimeout(230/250/700/1200/2500)` e tempo di gioco che avanza: con `workers: 1` e RNG non seedato, alcuni passaggi positivi (`>1 px`, `>3 veicoli mossi`) dipendono dalla finestra temporale, non da una proprietà garantita.

---

## 2. Tabella: difetto segnalato / test esistente / perché non lo intercetta

| Difetto segnalato | Test / strumento esistente | Cosa viene realmente asserito | Perché non lo intercetta |
|---|---|---|---|
| **Personaggio troppo piccolo / proporzioni sbagliate** | `game.spec.ts:367-419`, `ScaleMap.test.ts:6-17`, `check_proportions.py:24-55` | Frame del personaggio 16×32, tile 16, edificio 56–212 px, auto 72×40, bus 192×52; `adultHeightPx = 28`; dimensioni file asset | Confronta **metadati e texture**, non il rapporto renderizzato a schermo tra giocatore, porta, piano e veicolo alla zoom 2 e al viewport effettivo. Coesistono senza conflitto `adultHeightPx=28` e frame alto 32 px |
| **Veicoli non orientati correttamente / ruote sbagliate** | `m6_traffic.spec.ts`, `game.spec.ts:103-127`, `VehicleSystem.test.ts` | Posizioni, passo <24 px, carburante, prezzi, tagliandi | `WorldScene.ts:1330` calcola `vehicle.angle` ma **non lo assegna mai allo sprite**: a `:1338` c'è solo `setFlipX`. Nessun test controlla `sprite.angle` o confronta i patch renderizzati di nord/sud/est/ovest |
| **Tetti tagliati, facciate sovrapposte** | `game.spec.ts:367`, `ScaleMap.test.ts:40-69`, `check_proportions.py`, `validate_geography.py` | Larghezze ammesse, altezze 56–212, tetto 24 px, impronte OSM presenti | `spawnProps()` (`WorldScene.ts:699-712`) usa `facadeWidth` dei metadati, non la larghezza dell'impronta: ricalcolo read-only → **36/226 mismatch** e **45 coppie di facciate sovrapposte**. Nessun test confronta rettangoli sprite né verifica l'occlusione del tetto nel pixel |
| **Strade scure / marciapiedi invisibili** | `m6_sample.spec.ts` (screenshot), `docs/M6_SAMPLE_QA.md`, `check_m5_screenshots.py` | Screenshot scritti; statistiche riportate a mano per M5/M6; script Python legge solo `M5_SCREENSHOTS` | Nessuna asserzione pixel dentro Playwright; lo script visivo non apre mai `M6_SCREENSHOTS`; il valore “6,77% di pixel scuri” è un numero documentato, non una soglia di gate |
| **Oggetti fluttuanti / ombre e prospettiva sbagliate** | `m6_actors.spec.ts:34-42,81-84`, `m6_urban.spec.ts:21-28`, `game.spec.ts:421-453` | `shadow.x ≈ actor.x`, `shadow.y ≈ actor.y - 1`, `shadow.depth ≈ actor.y - 1`, distanze tra spot | Tutti valori presi dall'hook, non dal canvas. La posizione numerica corretta non garantisce ombra disegnata, dimensione, contrasto o ancoraggio dei piedi; gli edifici usano `depth = baseY+2/+3` mentre gli attori usano `depth = y`, senza test di occlusione visiva |
| **Geografia non riconoscibile / landmark assenti** | `validate_geography.py`, `validate_m5_world.py`, `ScaleMap.test.ts`, `m5_regions.spec.ts` | 226 impronte, 9 regioni, 3.800 luoghi, sorgenti OSM dichiarate, `places > 2` per regione | Verificano provenienza e conteggi dei dati, non che un POI reale sia **visibile e riconoscibile** nell'inquadratura. Nessun template matching o confronto con le foto di riferimento |
| **Throughput del personaggio bloccato/lento** | `game.spec.ts:85-101`, `m6_actors.spec.ts:70-85`, `CollisionSystem.test.ts:29-53` | `teleport()` vicino al muro, `KeyD` 1 s, `x < boundary`; WASD 230 ms con spostamento >1 px; griglia sintetica 10×10 | Il teletrasporto elimina proprio la fase da verificare; una direzione sola; `>1 px` è compatibile con un personaggio quasi fermo; nessuna misura di 92 px/s, corsa, diagonale, scorrimento lungo il muro o tentativo da 4 lati |
| **HUD non visibile su mobile** | `game.spec.ts:3-17`, `m6_transport.spec.ts:41-48` | `#canvas` visibile, `#hud-clock` con `/dd:dd/`, testo del pannello | Il DOM può essere corretto mentre il canvas è ridimensionato, coperto o fuori viewport. Nessun controllo della regione HUD nei pixel e nessun dispositivo fisico (`M6_FINAL_QA.md:88-89` lo dichiara) |
| **Interni con arredi/personaggi non coerenti** | `m6_interiors.spec.ts`, `game.spec.ts:129-157,328-365` | `template`, `placeId`, `floors`, `facadeWidth`, presenza dell'azione `Dormi`/`Check-in`, arredi >5 | La scena viene lanciata via `scene.launch()` dall'hook, non raggiunta con interazione; non si verifica il rendering della stanza, le sedie occupate nei pixel o sovrapposizioni tra arredi |
| **Prestazioni/scroll non fluide** | `m6_performance.spec.ts` | Boot misurato ma non assertito; FPS `>20`; heap e texture solo registrate | Soglia inferiore allo stato dichiarato (26 FPS desktop): una regressione dal 26 al 21 FPS resterebbe “verde”. Nessun percentile, nessun frame budget, nessuna verifica su build di produzione |

---

## 3. Nuova strategia QA

### 3.1 Principi

1. **Accettazione black-box**: il giocatore si muove solo con tastiera/touch reali. `__bacoliDebug()` diventa *read-only* (osservazione); `__bacoliTest.teleport()`, `setRegion()`, `giveTickets()`, `scene.launch()` restano ammessi solo nel setup di scenari che non riguardano la proprietà under test, e vanno dichiarati esplicitamente nel test.
2. **Oracolo visivo**: ogni schermata candidata alla pubblicazione deve essere giudicata da pixel misurati, non da testo o da un VLM.
3. **Determinismo**: seed RNG fissato, `setTime`/`setDay` fissati, traffico e NPC con seed, attesa su `!loading` e su due frame stabili invece di `waitForTimeout` fissi. Baseline versionate per viewport.
4. **Stesso artefatto in produzione**: la suite completa gira anche su `vite preview` della build minificata.
5. **Ollama solo come suggerimento**: può produrre un report integrativo, ma non può far passare né bloccare un gate.

### 3.2 Vitest — invarianti geometrici e di rendering

Nuovi file (proposta organizzativa, non implementati in questa analisi):

- `tests/unit/VisualGeometry.test.ts`: per ogni edificio di `bacoli_centro.json`, `facadeWidth === (maxX-minX+1)*16` con tolleranza 0 (oggi fallirebbe per 36 edifici); intersezione tra rettangoli facciata `≤ 0 px²` (oggi fallirebbe per 45 coppie); `roofTop = baseY - (floors*52+4)` e `roofBottom = roofTop + 24` entro ±1 px; `adultHeightPx` e frame del personaggio coerenti entro ±15%.
- `tests/unit/VehicleOrientation.test.ts`: estrarre una funzione pura `spriteAngleFor(vehicle, delta)` usata da `WorldScene` e verificarne l'applicazione; per direzioni N/E/S/W l'angolo atteso è 0/90/180/270 con tolleranza ±1°. Se l'asset è solo laterale, il test deve fallire finché non esistono sprite a 4 direzioni.
- `tests/unit/TilePattern.test.ts`: vieta pattern `(x+y)%n` nella scelta dei GID e verifica che i GID 33-48 (`crosswalk`) restino vuoti come dichiarato.
- I 99 test esistenti restano, ma nessuno di essi può più essere contato come “QA visiva”.

### 3.3 Playwright — functional + regressione visiva

Configurazione proposta:

- `playwright.config.ts` (dev, iterazione rapida) invariante nel target, ma con `webServer.command: npm run dev -- --port 4173`.
- `playwright.prod.config.ts`: `webServer.command: npm run build && npm run preview -- --port 4174`, `baseURL: http://127.0.0.1:4174`, stessi progetti `chromium-desktop` e `mobile-android` + un terzo progetto `mobile-touch` che usa eventi touch invece di tastiera.
- Setup deterministico condiviso: `__bacoliTest.setRegion('centro')`, `setTime(10)`, `setDay(1)`, seed fisso, disattivazione animazioni non essenziali, attesa `!loading` e due `requestAnimationFrame`.
- Sostituire i `waitForTimeout` con `expect.poll` su stato ossevabile.
- Aggiungere `expect(page).toHaveScreenshot('zona-campione-overview.png', { maxDiffPixelRatio: 0.002, threshold: 0.05 })` e analoghe per strada, interni, HUD mobile. Le baseline sono generate una volta, approvate a mano e versionate; il confronto è bloccante.
- Mantenere le asserzioni funzionali attuali, ma eliminare `teleport()` dai test di collisione/movimento e dall'inquadratura della zona campione.

### 3.4 OpenCV — gate deterministico (`tools/qa_visual_gate.py`)

Script Python separato, eseguito dopo Playwright sulle screenshot **della build di produzione**, che legge anche `ground.bin`, `collision.bin` e `bacoli_world.json` per calcolare le ROI attese. Esce con codice 1 se anche una sola soglia è violata e scrive un JSON macchinabile.

| Metrica | Metodo OpenCV | Soglia bloccante |
|---|---|---|
| Strade nere | ROI dei tile `road`, frazione `max(R,G,B) < 70` | ≤ 5% (oggi il screenshot utente è 45,92%) |
| Grigio asfalto | Frazione di pixel entro ΔE < 12 da `#5F5E58`, `#6E6C64`, `#4E4E49` | ≥ 18% nelle ROI strada |
| Luminanza/istogramma | Media V e distanza L1 dell'istogramma 4×4×4 dalla baseline | Δmedia ≤ 8; distanza ≤ 0,10 |
| Frame duplicati | dHash 8×8 tra le 9 regioni | distanza di Hamming ≥ 6 per ogni coppia |
| Facciata vs impronta | Rettangolo sprite da `facadeWidth` vs `bounds` | scarto ≤ 0 px (oggi 36 violation) |
| Sovrapposizione edifici | Intersezione dei rettangoli sprite | area ≤ 0 px², tolleranza 8 px solo sul bordo (oggi 45 violation) |
| Tettoni tagliati | Template del `roof_*` nella fascia attesa sopra la facciata | presenza ≥ 95% dei pixel del template |
| Personaggio | Altezza del bounding box dello sprite del personaggio | `altezza/52` in 0,50–0,70 e `altezza/porta` in 0,90–1,20 |
| Ombre | Centroid dell'ombra rispetto al punto piedi proiettato | `|dx| ≤ 2 px`, `|dy| ≤ 2 px` a zoom 1 |
| Veicoli | `sprite.angle` vs `vehicle.angle`; SSIM tra patch N e E | errore angolare ≤ 1°; SSIM(N,E) ≤ 0,95 |
| HUD | Template/OCR nella ROI in alto a destra | presenza e contrasto ≥ 4,5:1 |
| Errori runtime | `pageerror` + `console.error` su dev **e** prod | 0 |

I valori attuali (26 FPS, 36 mismatch, 45 sovrapposizioni, V<70 45,92% nello screenshot segnalato) mostrano che il gate non è una formalità: **oggi bloccherebbe la pubblicazione**, che è esattamente lo scopo.

---

## 4. Test di accettazione obbligatori per la zona campione

La zona campione resta il centro metrico `463×722`, spawn `(324,478)`, scale 1 m = 16 px. Ogni test deve girare su `chromium-desktop` e `mobile-android` **e** sulla build di produzione. Lo scenario A3 è il cuore dell'accettazione.

### A0 — Setup deterministico

- Avvia `vite preview` della build, apri `/`, attendi `__bacoliDebug().loading === false`.
- `setRegion('centro')`, `setTime(10)`, `setDay(1)`, seed RNG fisso.
- Registra `camera.zoom`, `scene.scale.gameSize` e la matrice di proiezione mondo→schermo in un artifacts JSON, così OpenCV sa dove cercare ogni ROI.
- **Vieta `teleport()` in tutti gli scenari A1–A9.**

### A1 — Baseline visiva statica

Salva `overview` e `strada` (inquadratura raggiunta camminando dallo spawn). Esegui `qa_visual_gate.py` sulle due immagini: strade, facciate, tetti, HUD e ombre dentro le soglie della sezione 3.4. Confronto `toHaveScreenshot` con baseline approvata.

### A2 — Throughput del personaggio

Cammina in una tile libera per 1 s con `KeyD`: distanza misurata `92 ± 18 px/s` (corsa con Shift: `170 ± 34 px/s`). Campiona ogni 100 ms: nessun salto > 15 px, nessun frame con `canStand(player) === false`, almeno 8 campioni su 10 in movimento. Verifica animazione `walk-*`, `depth === y` e ombra ai piedi nei pixel, non solo nell'hook.

### A3 — Tentativo reale di attraversamento edifici da 4 direzioni (obbligatorio)

Selezionare un edificio OSM reale della zona campione con almeno 3 tile liberi su ogni lato, calcolati da `collision.bin` (non dal `findWall()` dell'hook). Per ognuna delle quattro direzioni **N, E, S, O**:

1. Dallo spawn, raggiungi il punto di partenza **solo con input reale** (WASD/touch). Nessun `teleport`, nessun `setPosition()`, nessun `restartInRegion()`.
2. Allinea il personaggio alla facciata, a 48 px dal bordo dell'impronta, verificando che il punto sia `canStand === true`.
3. Premi il tasto verso l'edificio per **2 s**, campionando posizione, animazione, `canStand` e screenshot ogni **100 ms**.
4. Asserzioni per ogni campione:
   - il centro del personaggio non entra mai nel rettangolo dell'impronta (`bounds`) ridotto del raggio di 5 px;
   - `canStand(player.x, player.y, 5, 'player') === true`;
   - distanza tra campioni consecutivi ≤ `92 × 0,1 × 1,5 = 13,8 px` (nessun tunneling);
   - avanzamento totale verso il muro ≥ 32 px: se il personaggio è fermo dall'inizio il test **fallisce**, non passa;
   - distanza finale dal bordo in `[5, 9] px` (si ferma a contacto, non dentro).
5. Dopo il contatto, premi per 0,6 s il tasto parallelo alla facciata: il personaggio deve scorrere lungo il muro di ≥ 30 px senza entrare nell'impronta e senza restare bloccato.
6. Confronta lo screenshot finale di ogni direzione con OpenCV: **nessun pixel dello sprite del personaggio** dentro la ROI dell'impronta; ombra ancora allineata ai piedi; tetto non coperto dal corpo.
7. Ripeti per quattro edifici distinti se un solo edificio non ha accesso libero su tutti i lati.

Pseudcodice dell'asserzione chiave:

```ts
for (const dir of ['N','E','S','O']) {
  const start = await walkFromSpawnToApproach(dir);     // input reale, no teleport
  expect(start.canStand).toBe(true);
  const samples = await holdAndSample(dir.key, 2000, 100); // read-only hook
  expect(progressTowards(samples, dir)).toBeGreaterThan(32);
  for (let i = 0; i < samples.length; i++) {
    expect(samples[i].insideFootprint).toBe(false);
    expect(samples[i].canStand).toBe(true);
    if (i > 0) expect(samples[i].step).toBeLessThan(13.8);
  }
  expect(finalDistanceToWall(samples.at(-1), dir)).toBeGreaterThanOrEqual(5);
  expect(finalDistanceToWall(samples.at(-1), dir)).toBeLessThanOrEqual(9);
  await cvAssertNoPlayerPixelsInsideFootprint(screenshotFor(dir));
}
```

### A4 — Traffico e orientamento

Su 5 s di campionamento a 250 ms: passo ≤ `13,5 px` (auto 30 px/s ×1,5), `stalls` mai > 0 per più di 3 campioni consecutivi, almeno 6 veicoli con movimento totale > 80 px, `sprite.angle === vehicle.angle ±1°`, SSIM tra i patch nord e est ≤ 0,95. Nessun veicolo dentro un tile solido.

### A5 — Attori e arredo

Nessuna sovrapposizione di pixel tra pedoni, animali e veicoli; ombre ancorate; 61 arredi e 40 lampioni (valori di riferimento) posizionati solo su tile pedonali/OSM secondo `ground.bin`, non su asfalto; distanza minima tra arredi ≥ somma raggi + 8 px.

### A6 — Interni da interazione reale

Raggiungi un luogo OSM (`Domus Fortunae B&B`, `place-lago_miseno-195`) camminando, premi `E`, verifica template `hotel`, `placeId`, piani e larghezza facciata **e** il rendering della stanza con `toHaveScreenshot`. Esci con `Escape`, ricarica, verifica save v4.

### A7 — HUD e mobile

Su emulatore Android e su dispositivo fisico: HUD nella ROI in alto a destra con contrasto ≥ 4,5:1, controlli touch presenti e funzionanti, nessun canvas tagliato o letterbox nero, asset hash identico alla build.

### A8 — Prestazioni sulla build di produzione

Boot p50 ≤ 2.500 ms; FPS p50 ≥ 30 e p95 frame ≤ 33 ms (target 45 FPS); heap ≤ 180 MB; texture iniziali ≤ 400 e dopo Torregaveta ≤ 520. I valori attuali (boot 1.934 ms, 26 FPS, 133 MB, 307→389 texture) **non supererebbero il gate FPS**: la regressione deve essere corretta, non “dichiarata”.

### A9 — Verifica live

Dopo il deploy: `tools/check_live.mjs` esteso per (a) confrontare l'hash di `assets/index-*.js` con `dist`, (b) eseguire A1 e A4 sulla URL pubblica, (c) richiedere 0 errori console. Nessuna asserzione può dipendere dalla presenza di hook di teletrasporto.

---

## 5. Gate di pubblicazione

| Gate | Comando / artefatto | Condizione di passaggio | Se fallisce |
|---|---|---|---|
| **G0 — Dati** | `validate_geography.py`, `validate_m5_world.py`, `check_proportions.py`, `VisualGeometry.test.ts` | 226 impronte, 9 regioni; 0 mismatch facciata/impronta; 0 sovrapposizioni facciate | Blocca prima di ogni build |
| **G1 — Unit** | `npm test` | 99 test esistenti + nuovi invarianti, 0 skippati | Blocca il merge |
| **G2 — E2E dev** | `npm run test:e2e` | Tutti i test, 0 errori console, A1–A8 verdi, nessun `teleport()` negli scenari di accettazione | Blocca il merge |
| **G3 — E2E produzione** | `npm run test:e2e:prod` su `vite preview` della build | Stesso esito di G2 sull'artefatto minificato | **Blocca il deploy** |
| **G4 — Visivo OpenCV** | `python tools/qa_visual_gate.py` + `toHaveScreenshot` | Tutte le soglie della sezione 3.4; diff baseline ≤ 0,2% pixel | Blocca il deploy |
| **G5 — Zona campione** | Report A1–A9 con screenshot e JSON | A3 superato da 4 direzioni su desktop e mobile; firma umana sull'overview e sulla strada | Blocca il deploy |
| **G6 — Prestazioni** | `m6-performance-*.json` su build | Boot ≤ 2,5 s, FPS p50 ≥ 30, heap ≤ 180 MB, texture entro i limiti | Blocca il deploy |
| **G7 — Live** | `check_live.mjs` esteso | Hash JS identico a `dist`, A1/A4 ripetuti sulla live, 0 errori | Rollback immediato |
| **G8 — Governance** | Report QA versionato | Ollama etichettato come *advisory*; nessuna esenzione implicita; waiver scritti, con scadenza e approvazione | Pubblicazione sospesa |

Regole trasversali:

1. `.github/workflows/deploy.yml` deve eseguire **G0–G6 prima di `deploy-pages`**. Oggi non esegue alcun test: questo è il primo punto da correggere.
2. Nessun avviso può essere richiamato come “noto e accettato” per nascondere una soglia: l'avviso chunk >500 kB resta informativo, ma FPS e pixel sono bloccanti.
3. Ogni modifica a mappe, asset, scala, spawn, shader o configurazione della camera invalida le baseline visive: rigenerazione e riapprovazione umana obbligatorie.
4. I 163 test attuali restano utili come rete di sicurezza logica, ma **non sono più presentabili come certificazione di qualità**. La certificazione è l'insieme G0–G8, con esito riproducibile su build di produzione.

**Conclusione:** i test sono verdi perché verificano soprattutto che i numeri interni siano coerenti tra loro; l'utente vede difetti perché nessuno di quei numeri misura l'immagine effettiva, il percorso reale del personaggio o l'artefatto distribuito. Il nuovo impianto sposta l'oracolo dallo stato al pixel e rende bloccante ciò che oggi è solo documentato a mano.
