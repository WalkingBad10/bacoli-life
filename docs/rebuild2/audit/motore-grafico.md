# Audit motore grafico / rendering — BACOLI LIFE M6

Ambito: solo codice sorgente, generatori e artefatti prodotti dal codice. File citati relativi alla radice `bacoli-life`.

## 1. Verdetto su Phaser 3

**Phaser 3.90 va tenuto.** Il problema non è il motore: è l'architettura del pipeline di rendering costruita sopra.

A favore del motore:

- Configurazione pixel-art corretta e coerente: `pixelArt: true`, `roundPixels: true`, `antialias: false` in `src/main.ts:12-24`; `image-rendering: pixelated` in `src/style.css:28`.
- `Phaser.AUTO` (`src/main.ts:9`) con fallback Canvas è adatto a un 2D pixel-art; `package.json:20` dichiara Phaser `^3.90.0`.
- Phaser fornisce già tilemap a layer, `TilemapLayer`, maschere, container, camera con zoom, atlas e gestione della profondità: sono tutti strumenti presenti nel motore ma **non usati** dal codice.
- I vincoli metrici sono già ben impostati: `TILE = 16`, `CAMERA_ZOOM = 2` (`src/core/config.ts:3-6`), `metersPerPixel = 1/16`, `floorHeightPx = 52` (`src/data/bacoli_world.json`, verificati in `tools/check_proportions.py:24-27,70-96`), zoom camera applicato in `src/scenes/WorldScene.ts:986` e `src/scenes/InteriorScene.ts:179`.

Contro l'ipotesi "cambiare motore":

- Non c'è nessun limite dimostrato di Phaser: il collo di bottiglia è il numero di texture/sprite e l'assenza di layer/occlusione, non il renderer.
- La scarsa qualità percepita deriva da scelte di authoring e di ordinamento: facciate piatte, un solo layer di tile, primitiva grafiche usate come arte finale, GID errati, profondità non centralizzata.

**Conclusione:** non migrare a un altro motore. Riscrivere il pipeline di rendering mantenendo Phaser 3 e la scala metrica esistente.

---

## 2. Difetti strutturali con evidenze

### 2.1 Tilemap a un solo layer e autotiling solo offline

- `src/scenes/WorldScene.ts:262-280` crea una sola matrice `rows` da `ground.bin` e un solo `createLayer(0, tileset, 0, 0)`. Non esistono layer separati per terra, marciature, decal, ombre, oggetti o tetti.
- `src/scenes/BootScene.ts:51-57` carica `ground.bin`, `collision.bin`, `roads.bin` e `meta.json`. `roads.bin` è usato solo per `RoadGraph` (`src/scenes/WorldScene.ts:282-286`), non per disegnare strade a layer separato.
- L'autotiling è generato a monte, non gestito a runtime: maschere a 4 bit in `tools/m6_tiles.py:22-38` e `tools/m6_paving.py:51-64,101-136`. I GID vengono scritti direttamente in `ground.bin` da `tools/build_map_regions.py:254-275,338-342`.
- I file `tools/generated/*.tiled.json` non sono referenziati da `src/`: il formato Tiled multilivello non entra nel runtime.
- `src/scenes/InteriorScene.ts:146-156` fa lo stesso con una griglia riempita di un solo valore (`floorIndex`) e un solo layer.

Conseguenza: non si può esprimere occultamento, sovrapposizione di decal o separazione dei piani senza riscrivere la struttura dati.

### 2.2 Disallineamento GID acqua / pavimentazione

- Il generatore definisce `WATER0..WATER3 = 9,10,11,12` e `FOAM = 13` (`tools/m6_tiles.py:16-20`) e scrive quei valori nella mappa (`tools/build_map_regions.py:340-342`).
- Il runtime considera acqua gli indici `8..11` (`src/scenes/WorldScene.ts:998-1002`) e li anima con `8 + ((index - 8 + offset) % 4)` (`src/scenes/WorldScene.ts:1065-1072`); le barche nascono sugli stessi tile (`:962-979`).
- `firstGid = 1` è coerente (`tools/build_map_regions.py:270`, `src/scenes/WorldScene.ts:273-276`, `tests/unit/M5World.test.ts:60`), quindi lo sfalsamento è nel confronto magico `8..11`, non nel tileset.

Conseguenza: il GID 8 (lastricato) viene animato come acqua e può ospitare barche; il GID 12 (quarto frame acqua) resta fuori dall'animazione. È un difetto visibile e deterministico.

### 2.3 Profondità "a piedi" non uniforme e non sincronizzata

- Concetto corretto alla base: `setOrigin(0.5, 1)` e `setDepth(y)` per il giocatore (`src/scenes/WorldScene.ts:604-613`) e per gli NPC (`:941-945`).
- Origini diverse convivono con la stessa formula: veicoli `setOrigin(0.5, 0.8)` ma `setDepth(vehicle.y)` (`:831-835`), barche `setOrigin(0.5, 0.6)` e `setDepth(y - 12)` (`:971-974`), corriere `setDepth(order.y + 2)` (`:1595,1611-1613`), decorazioni `+1` (`:1630`), stazione `+5/+7` (`:666-669`).
- Animali: la y visiva è oscillata da `Math.sin(...)` ma la profondità usa `pet.y` non oscillato (`:1727-1729`).
- Aggiornamenti di posizione che non aggiornano la depth: load partita (`:331-333`), teleport di test (`:427-429`), arrivo nella stessa regione (`:1944-1947`). `syncPlayerActor()` (`:620-625`) aggiorna collisione e ombra, non `player.depth`.
- Interni: il giocatore nasce a `setDepth(500)` (`src/scenes/InteriorScene.ts:175-176`) e in `update()` passa a `setDepth(this.player.y)` (`:277`), con pareti a `100` (`:159-162`) e porta a `2` (`:167-170`): due sistemi di profondità incompatibili nella stessa scena.

Conseguenza: ordinamento instabile dopo eventi di gioco e doppio standard tra attori, veicoli e arredi.

### 2.4 Nessuna occlusione degli edifici

- Gli edifici sono singole immagini a tutto rettangolo posizionate a `setDepth(baseY + 2)` e i tetti a `setDepth(baseY + 3)` (`src/scenes/WorldScene.ts:699-713`).
- Non esiste `setMask`, suddivisione per tile di impronta o separazione facciata/tetto/ingeresso: il sprite dell'edificio copre qualunque attore con `y < baseY + 2`, compresi quelli che stanno sul marciapiede antistante.
- L'impronta OSM è disponibile (`bbox` in `:694-704`) ma usata solo per centrare l'immagine; `DebugOverlay` la disegna solo a scopo diagnostico (`src/systems/DebugOverlay.ts:91-98`).
- I generatori producono facciate piatte con finestre/porte (`tools/generate_assets_scale.py:199-228,343-380`), tetti come striscia fissa di 24 px (`:389-415`) e ombre pre-baked alte 20 px (`:418-427`).

Conseguenza: è la causa principale della "prospettiva non coerente": suolo visto dall'alto, edifici visti di fronte, nessuna faccia laterale, tetto non appoggiato su una superficie 3/4.

### 2.5 Ombre non fisiche e illuminazione piatta

- Ombre attore a ellissi fisse: giocatore 13×4 (`src/scenes/WorldScene.ts:611-612`), NPC 12×4 (`:943-945`), animali 10×3 (`:1691-1693`).
- Ombra edificio = PNG pre-generato con larghezza uguale alla facciata e altezza costante 20 px (`src/scenes/WorldScene.ts:706-707`, `tools/generate_assets_scale.py:418-427`).
- La notte è solo un rettangolo con alpha globale (`:992-993,1059`); i lampioni cambiano solo l'alpha di una texture `glow` (`:1060-1063`), creata proceduralmente in `src/scenes/BootScene.ts:94-104`.

Conseguenza: ombre non proiettate, non dipendenti da altezza o direzione della luce, non coerenti con il piano di terra.

### 2.6 Texture singole, nessun atlas, scala non integer

- `src/scenes/BootScene.ts:47-79` carica ogni PNG singolarmente: tileset, 14 character sheet, facciate della regione iniziale, 24 prop, 17 arredi, 2 animali. Non esiste `load.atlas` in `src/`.
- `src/systems/AssetKeys.ts:16-27` indicizza le facciate per `width_floors_variant`; `tools/generate_assets_scale.py:383-386,430-433` genera il prodotto cartesiano (nella directory `public/assets/scale` risultano 835 PNG, di cui 592 `building_*`, 148 `roof_*`, 37 `shadow_*`).
- `src/scenes/WorldScene.ts:213-222` carica dinamicamente solo le facciate mancanti, ma non scarica mai nulla: non ci sono `textures.remove` / `cache.*.remove` in `src/`.
- L'artefatto prodotto da `tests/e2e/m6_performance.spec.ts:5,60-69` riporta 307 texture iniziali e 389 dopo un viaggio; `src/scenes/WorldScene.ts:374` espone `loadedTextures`. La crescita è monotona.
- Non c'è `setScale` in `WorldScene`: tutti i prop restano alla dimensione nativa (es. `palm.png` 96×160, `lamp.png` 48×160, `bus.png` 192×52), indipendentemente dalla distanza o dal piano.
- Due eccezioni usano scala frazionaria, incompatibile con nearest-neighbor: arredi `targetWidth / img.width` (`src/scenes/InteriorScene.ts:238-240`; `f_bed.png` 96 px → 40 px) e passeggeri `Clamp(height / 420, 0.9, 1.5)` (`src/scenes/TransitScene.ts:175-193`), che rompono anche il vincolo 1 m = 16 px.

### 2.7 Ridimensionamento gestito solo per l'overlay

- `src/main.ts:14-19` usa `Scale.RESIZE` con `width/height = window.innerWidth/innerHeight` e `CENTER_BOTH` (inutile in modalità RESIZE); non c'è `zoom` nella config.
- `src/scenes/WorldScene.ts:982-988` fissa bounds e zoom 2; l'unico listener `resize` ridimensiona `this.overlay` (`:1005-1008`).
- `src/scenes/InteriorScene.ts:178-181` fa `setZoom(2)` + `centerOn()` una sola volta; `src/scenes/TransitScene.ts:53-57,123-172` calcola porte, sedili e montanti da `scale.width/height` una sola volta in `create()`, senza listener.

Conseguenza: al variare del viewport cambia solo la finestra visibile; HUD DOM (`src/style.css:27-31,170-174`) e canvas Phaser non condividono una strategia di layout.

### 2.8 Primitive usate come grafica finale

- `src/scenes/TransitScene.ts:86-120` genera l'intero paesaggio con `Graphics.fillRect/fillTriangle` + `generateTexture`; `:123-172` disegna soffitto, pavimento, montanti, sedili e porte con rettangoli. È grafica di gioco, non un placeholder temporaneo.
- `src/scenes/InteriorScene.ts:167-170` la porta d'ingresso è tre rettangoli e un cerchio.
- `src/scenes/WorldScene.ts:673-690` `markerKey()` è esplicitamente descritto come "Segnaposto dei POI puntuali" ma resta la resa finale di bar, ristoranti, parcheggi ecc.
- `src/scenes/WorldScene.ts:992-993` overlay notturno rettangolare; `src/scenes/BootScene.ts:94-111` glow/rain procedurali sono invece dichiarati "non sono grafica definitiva".
- `src/systems/DebugOverlay.ts:41-98` è diagnostico (attivo con `G`, `src/scenes/WorldScene.ts:317-320`) e non va confuso con la grafica finale.

### 2.9 Culling e budget incompleti

- Solo gli NPC hanno culling con `worldView` (`src/scenes/WorldScene.ts:1221-1233`); edifici, prop, veicoli e ombre sono creati per l'intera regione (`:692-820,831-923`) senza culling o LOD.
- Fino a 1400 tile acqua vengono riscritti ogni 260 ms (`:998-1002,1065-1072`), con upload della tilemap.
- Le regioni arrivano a 1100×1100 tile (`src/data/bacoli_world.json`; `tools/build_map_regions.py:258-275` scrive un byte per cella).
- Misurazioni generate da `tests/e2e/m6_performance.spec.ts:25-48` (rAF per 1200 ms, soglia `fps > 20` a `:48`): desktop `fps: 26`, `frames: 31`, `heapMb: 133`, `bootMs: 1934`; mobile `fps: 48`, `frames: 58`, `heapMb: 117`, `bootMs: 2017`. La misura è wall-clock del browser, non tempo di rendering Phaser, e la soglia è molto lasca.

---

## 3. Cosa recuperare e cosa riscrivere

### Da recuperare

| Elemento | Evidenza | Perché conservarlo |
|---|---|---|
| Phaser 3 + `AUTO`, pixel-art, camera zoom 2 | `src/main.ts:9-24`, `src/core/config.ts:3-6`, `src/scenes/WorldScene.ts:986` | Base sana; non è il problema |
| Scala metrica 1 m = 16 px, 28 px adulto, 52 px/piano | `src/core/config.ts:3`, `tools/check_proportions.py:24-27,70-96` | Già verificata da test; da estendere alla prospettiva |
| Pipeline mappe binarie + bitmask collisione | `tools/build_map_regions.py:254-275`, `src/scenes/WorldScene.ts:262-286,545-565` | Compatta e veloce; va solo ristrutturata a più layer |
| Autotiling offline a maschera di adiacenza | `tools/m6_tiles.py:22-38,328-351`, `tools/m6_paving.py:101-136` | Logica corretta; va corretta la numerazione GID e resa sorgente unica |
| Animazioni personaggi da spritesheet 16×32 | `src/scenes/BootScene.ts:59-64,82-92` | Funzionanti e coerenti con la scala |
| Caricamento facciate per regione | `src/systems/AssetKeys.ts:16-27`, `src/scenes/WorldScene.ts:213-222` | Buona idea; va portata a atlas + unload |
| Concetto "profondità dal punto di contatto" + mappa ombre | `src/scenes/WorldScene.ts:139-140,394-399,604-613` | Da centralizzare, non da buttare |
| Hook diagnostici ed E2E | `src/scenes/WorldScene.ts:345-421,423-532`, `tests/e2e/m6_performance.spec.ts:21-69` | Permettono di misurare la regressione senza nuovi strumenti |

### Da riscrivere

1. **Rappresentazione della scena:** da "un layer + immagini sparse" a layer Phaser espliciti con bande di depth dedicate; i dati `ground.bin`/`meta.json` devono descrivere più layer, non un solo array.
2. **Sorgente dei GID:**Eliminare i letterali `8..11` dal runtime; importare le costanti del generatore o un manifest generato, con test di parità (`tools/m6_tiles.py:16-20` vs `src/scenes/WorldScene.ts:998-1002`).
3. **Ordinamento:** una sola funzione `depthFor(x, y, band, footprint)` usata da player, NPC, veicoli, animali, prop, corriere, arredi; chiamata anche su load/teleport/arrivo, non solo in `update()`.
4. **Occlusione:** implementare maschere per edificio basate sull'impronta OSM, non sul rettangolo dello sprite; separare facciata, tetto e soglia.
5. **Grafica finale:** sostituire rettangoli/cerchi di `TransitScene` e `InteriorScene` e i `markerKey()` con frame di atlas; solo `BootScene:94-111` e `DebugOverlay` possono rimanere procedurali/diagnostici.
6. **Atlas e caricamento:** da 835 PNG singoli a pochi atlas con manifest; caricamento iniziale solo delle risorse condivise + regione attiva, scaricamento delle risorse della regione precedente.
7. **Camera/resize:** policy di viewport unica per World/Interior/Transit; zoom integer e viewport ricalcolato in `resize` per tutte le scene.
8. **Prospettiva:** scegliere e codificare una sola proiezione 3/4 per tutti gli asset verticali; oggi coesistono top-down (tile), elevazione frontale (facciate) e sprite a 4 direzioni.

---

## 4. Specifiche per il nuovo rendering

### 4.1 Tilemap multilivello

- Mantenere 1 tile = 16 px e `firstGid` dichiarato in `meta.json`, ma produrre layer distinti: `ground`, `road_marks`, `decals`, `object_bases`, `occluders`, `roofs`, `fx`. Ogni layer ha un `TilemapLayer` Phaser e una banda di depth documenting nel codice.
- Bande suggerite: `ground = 0`, `road_marks = 10`, `decals = 20`, `attori/oggetti = 1000 + y`, `occluders = 2000 + y_piede`, `roofs = 3000 + y_piede`, `fx = 9000`, `debug = 1_000_000` (coerenti con `src/systems/DebugOverlay.ts:41-45`).
- `roads.bin` deve alimentare un layer di marciature, non solo `RoadGraph` (`src/scenes/WorldScene.ts:282-286`).
- Se si adotta Tiled JSON, il file generato deve essere la stessa sorgente dei buffer binari: vietate due sorgenti divergenti.
- I tile d'acqua devono restare animabili senza riscrivere l'intero layer: Group/TileSprite o layer dedicato, non il loop `forEachTile` attuale.

### 4.2 Autotiling e GID

- Sorgente unica delle costanti: `tools/m6_tiles.py:16-38` esporta un manifest (`gid -> frame, categoria, flag`) letto sia dal generatore sia dal runtime.
- Correggere l'intervallo acqua a `9..12` e schiuma `13` (`tools/m6_tiles.py:16-20`); il controllo `8..11` in `src/scenes/WorldScene.ts:998-1002` e il ciclo in `:1068-1071` vanno sostituiti.
- Mantenere le maschere N=1/E=2/S=4/W=8 (`:22-38`), estendendole a 8 bit per gli angoli e a transizioni esplicite; la scelta del frame deve essere verificabile da unit test sui quattro vicini.
- Aggiungere test che confrontino i GID usati da `src/` con il manifest generato: l'attuale `tests/unit/M5World.test.ts:60` controlla solo `firstGid`.

### 4.3 Atlas e nearest-neighbor

- Un atlas condiviso `characters` (frame 16×32), uno `tiles` (frame 16×16) e atlas per regione `facades_<region>` / `props` con JSON dei frame; niente `load.image()` per singolo edificio.
- Chiavi logiche stabili: sostituire `building_${width}_${floors}_${variant}` (`src/scenes/WorldScene.ts:708-709`, `src/systems/AssetKeys.ts:23-25`) con nomi di frame dell'atlas, mantenendo un alias finché gli E2E leggono `texture.key` (`:369-372`).
- Conservare `pixelArt: true`, `antialias: false`, `roundPixels: true` (`src/main.ts:12-24`) e `image-rendering: pixelated` (`src/style.css:28`). **Divieto di scale frazionari**: sostituire `targetWidth / img.width` (`src/scenes/InteriorScene.ts:239`) e il clamp `0.9..1.5` (`src/scenes/TransitScene.ts:176,183,191`) con asset pre-renderizzati alla dimensione corretta.
- Zoom camera intero (2 come oggi, `src/core/config.ts:6`); se si vuole zoom adattivo, usare valori interi e ricalcolare i bounds in `resize`.
- `startFollow(..., 0.12, 0.12)` (`src/scenes/WorldScene.ts:985`) produce scroll sub-pixel: con `roundPixels` può generare tremolio; valutare scroll arrotondato o camera senza lerp.

### 4.4 Profondità a terra

- Una sola API `setActorDepth(gameObject, feetY, band)`; `feetY` è sempre la y del punto di contatto, `origin = (0.5, 1)` per tutti gli attori (oggi violato da veicoli e barche, `src/scenes/WorldScene.ts:832-834,971-974`).
- Eliminare gli offset arbitrari `+1`, `+2`, `+5`, `+7`, `-12` (`:666-669,1595,1612,1630,974`) sostituendoli con bande esplicite.
- Chiamare la API in ogni punto che cambia posizione: `syncPlayerActor()` (`:620-625`), load (`:331-333`), teleport (`:427-429`), arrivo (`:1944-1947`), aggiornamento NPC (`:1280-1285`) e veicoli (`:1134,1340`).
- Interni: rimuovere il doppio standard `500` vs `y` (`src/scenes/InteriorScene.ts:176,277`) e usare la stessa funzione con banda `INTERIOR_ACTOR`.

### 4.5 Ombre e occlusione

- Ombre come frame d'atlas o ellissi parametriche con dimensione calcolata dall'ingombro reale e proiezione lungo una direzione di luce unica, derivata da `timeSystem.daylight` (`src/scenes/WorldScene.ts:1052-1063`). Niente dimensioni fisse 13×4/12×4/10×3 (`:611-612,943-945,1691-1693`).
- Ombra edificio costruita dall'impronta OSM (`bounds`, `:699-704`) e non dalla sola larghezza della facciata (`tools/generate_assets_scale.py:418-427`).
- Occlusione: per ogni edificio, una maschera (Graphics geometry mask o RenderTexture) ritagliata sull'impronta; attori con `feetY` minore sono dietro, attori con `feetY` maggiore sono davanti. Il tetto non deve mai stare globalmente sopra gli attori (`src/scenes/WorldScene.ts:708-712`).
- La soglia della porta resta percorribile: la maschera non deve coprire il tile di ingresso usato da `entrance_tile()` in `tools/build_map_regions.py:220-229`.

### 4.6 Caricamento dinamico e memoria

- `BootScene.preload()` (`src/scenes/BootScene.ts:45-80`) deve caricare solo atlases condivisi, animazioni e metadati della regione iniziale; gli altri buffer `ground/collision/roads/meta` vanno caricati al viaggio.
- Mantenere il pattern `load.once('complete') → scene.restart()` (`src/scenes/WorldScene.ts:213-222`) ma aggiungere `textures.remove()` / pulizia cache nello `shutdown` (`:534-542`) per la regione uscente.
- Estendere `tests/e2e/m6_performance.spec.ts:21-58` con: numero massimo di texture, limite heap, assenza di crescita dopo N viaggi avanti/indietro. Oggi i controlli sono solo `<400`, `>initial`, `<600` e non rilevano leak.
- Culling/LOD anche per prop ed edifici fuori `worldView` (`src/scenes/WorldScene.ts:1221-1233` copre solo NPC).

### 4.7 Prospettiva 3/4 uniforme

- Regola di proiezione unica, codificata in costanti e validata in `tools/check_proportions.py:24-55`:
  - il piano di terra resta top-down, 1 m = 16 px;
  - ogni oggetto verticale ha una faccia frontale e una faccia laterale coerenti con lo stesso angolo di vista, con altezza verticale compressionata da un fattore fisso e non da immagini frontali piatte (`tools/generate_assets_scale.py:199-228,343-380`);
  - il tetto è una superficie superiore costruita dall'impronta, non una striscia di 24 px (`tools/generate_assets_scale.py:389-415`);
  - base di ogni sprite = punto di contatto a terra; ombre proiettate sullo stesso piano;
  - veicoli e barche usano la stessa base e la stessa scala di ingombro (`car_white.png` 72×40, `bus.png` 192×52, `boat.png` 128×48).
- I quattro frame direzionali dei personaggi (`src/scenes/BootScene.ts:20,83-92`) devono condividere la stessa base e la stessa altezza visiva; oggi `player.png` è 64×128 con frame 16×32 e l'adulto metrico è 28 px.
- Interni e Transito devono adottare la stessa regola: niente sedili/porte disegnati come rettangoli 2D in un mondo 3/4 (`src/scenes/TransitScene.ts:123-172`, `src/scenes/InteriorScene.ts:167-170`).

---

## 5. Priorità e rischi

### Priorità

| Priorità | Intervento | Motivo |
|---|---|---|
| P0 | Correggere l'off-by-one GID acqua/pavimentazione | Difetto deterministico, basso costo, impatto visivo immediato |
| P0 | Centralizzare profondità e sincronizzarla su load/teleport/arrivo | Elimina errori di ordinamento già presenti nel codice |
| P0 | Occlusione edifici con maschere sull'impronta + separazione tetto/facciata | È la causa diretta della prospettiva incoerente |
| P1 | Tilemap multilivello e layer stradali | Abilita tutto il resto; necessario prima di rifare l'arte |
| P1 | Atlas + rimozione scale frazionarie + zoom integer | Riduce texture e rende il pixel-art nitido |
| P1 | Sostituire grafica finale procedurale (Transit, porte interni, marker POI) | Rimuove la percezione "rudimentale" |
| P1 | Caricamento per regione con unload e test anti-leak | 307 → 389 texture e heap 117-133 MB sono già al limite |
| P2 | Ombre direzionali, illuminazione, FX atmosferici | Finitura dopo che la base è corretta |
| P2 | Policy di resize per tutte le scene e culling/LOD | Stabilità e budget FPS (desktop 26 rAF FPS) |

### Rischi

- **Rigenerazione mappe:** correggere i GID implica rigenerare tutti i `ground.bin`; `tests/unit/M5World.test.ts:53-65` verifica dimensioni e `firstGid`, ma non i valori semantici. Aggiungere test prima di rigenerare.
- **Migrazione atlas:** 835 PNG e 307 chiavi texture caricate; se le chiavi cambiano, si rompono gli hook E2E che leggono `texture.key` (`src/scenes/WorldScene.ts:369-372`) e tutti i loader in `BootScene`. Prevedere alias temporanei.
- **Performance delle maschere:** l'occlusione con Graphics mask per edificio può peggiorare un desktop già a 26 FPS misurati (`tests/e2e/m6_performance.spec.ts:25-48`). Limitare le maschere agli oggetti nel `worldView` e misurare a ogni step.
- **Scene.restart():** il caricamento dinamico già riavvia la scena dentro `create()` (`src/scenes/WorldScene.ts:213-222`). Aggiungere l'unload in `shutdown` rischia di rimuovere texture ancora referenziate da tween o particle; ordinare esplicitamente shutdown → unload → create.
- **Pixel-art vs camera lerp:** `roundPixels` e zoom 2 funzionano con coordinate intere; introdurre zoom non intero o scale frazionarie annulla il beneficio di `antialias: false` (`src/main.ts:20-24`).
- **HUD fuori dal canvas:** `src/ui/Hud.ts` + `src/style.css:30-31` sono DOM; non ricevono ombre/illuminazione di Phaser. Se si vuole coerenza visiva totale, va deciso se portarli in un layer di rendering o accettarli come UI separata.
- **Soglie di test troppo basse:** `fps > 20` (`tests/e2e/m6_performance.spec.ts:48`) e i limiti texture `<400`/`<600` (`:23,58`) non impediscono regressioni; alzarli dopo la riscrittura, senza trasformare il gate in un test che passa solo su mobile.
