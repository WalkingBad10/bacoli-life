# Audit architetturale indipendente — BACOLI LIFE post Milestone 6

**Branch esaminato:** `rebuild-2.0`  
**HEAD:** `c0ce797 docs: registra pubblicazione e verifica live milestone 6`  
**Ambito:** analisi del codice effettivamente presente in `src/`, `tests/`, `package.json`, `vite.config.ts`, `playwright.config.ts` e degli script di generazione dati/asset in `tools/`. Non sono stati usati i documenti di milestone come fonte di verità.  
**Modifiche:** questo audit ha scritto solo `docs/rebuild2/audit/architettura.md`. Nessun sorgente, configurazione, asset o altro progetto è stato modificato da questa analisi.

---

## 1. Sintesi esecutiva

I 163 test verdi non sono una prova di qualità architetturale. Sono il risultato di una piramide molto sbilanciata: **99 test unitari puri** sui sistemi, più **32 test E2E per progetto × 2 progetti Playwright** (`playwright.config.ts:15-18`). Il fatto che siano verdi certifica soprattutto che:

- le funzioni pure di economia, tempo, pathfinding, collisione, trasporti, salvataggio ecc. rispettano le loro spec locali;
- l’applicazione boota, la HUD appare e non lancia errori;
- gli hook globali `__bacoliDebug`, `__bacoliTest`, `__bacoliInterior` e `__bacoliTransit` restituiscono valori coerenti;
- alcune quantità numeriche (conteggi, distanze minime, dimensioni in pixel) sono corrette.

Non certifica che:

- la facciata disegnata coincida con l’impronta solida;
- un veicolo posseduto sia effettivamente sull’asfalto;
- un oggetto urbano sia semanticmente appropriato al luogo;
- l’ambientazione assomigli a Bacoli;
- i percorsi di gioco reali (compra biglietto → viaggio → arrivo → ingresso in scena) siano gli stessi percorsi verificati dai test.

Il problema centrale è che **la simulazione, il rendering, lo stato di gioco, la UI, la persistenza e l’API di test convivono dentro `WorldScene`**. La scena ha oltre 35 campi (`src/scenes/WorldScene.ts:104-154`), crea mappe, HUD, input, veicoli, NPC, traffico, arredo e hook (`src/scenes/WorldScene.ts:207-303`), esegue avanzamento del tempo, economia, famiglia, consegne, meteo, movimento e autosave nello stesso `update()` (`src/scenes/WorldScene.ts:1031-1092`) e pubblica direttamente su `window` superfici di mutazione (`src/scenes/WorldScene.ts:345-532`).

Le cause dei difetti segnalati sono quindi strutturali, non accidentali:

| Difetto osservato | Causa strutturale predominante |
|---|---|
| Grafica rudimentale | Asset procedurali generati da larghezza/piani/variante, nessuna pipeline di arte per edificio/luogo (`tools/generate_assets_scale.py:343-386`, `tools/generate_assets.py:654-750`). |
| Oggetti senza criterio | Regole geometriche e modulo-arithmetic, non semantiche; classe superficie `0` ammessa (`src/scenes/WorldScene.ts:722-748`, `src/scenes/WorldScene.ts:770-813`). |
| Veicoli fuori strada | I veicoli posseduti usano solo `canStand()`, mentre il traffico usa `drivable()` (`src/scenes/WorldScene.ts:585-602`, `src/scenes/WorldScene.ts:839-858`, `src/scenes/WorldScene.ts:865-923`). |
| Protagonista che attraversa i palazzi | Rendering da rettangolo+`facadeWidth`, collisione da poligono OSM esatto; i due contratti non coincidono (`tools/build_map_centro.py:246-254`, `tools/build_map_centro.py:382-396`, `src/scenes/WorldScene.ts:545-565`, `src/scenes/WorldScene.ts:648-713`). |
| Ambientazione non fedele | Posizioni OSM reali, ma facciate, interni e arredi sono template generici con euristica per nome (`src/scenes/InteriorScene.ts:53-74`, `src/scenes/WorldScene.ts:627-655`). |

Il patrimonio recuperabile esiste: i sistemi puri e le loro spec unitarie sono la parte più sana del progetto. La ricostruzione deve conservare quei sistemi dietro confini espliciti e riscrivere lo strato scena/asset/test-hook.

---

## 2. Cause strutturali con evidenze precise

### C1. `WorldScene` è un god object: logica, rendering e controllo non sono separabili

`WorldScene` dichiara nel corpo della classe stato di simulazione, stato di rendering, input, HUD, registry, hook globali e transizioni (`src/scenes/WorldScene.ts:104-154`). `create()` da solo:

- rilegge la regione e gestisce il caricamento dinamico delle texture con `load.once('complete', () => this.scene.restart())` (`src/scenes/WorldScene.ts:207-222`);
- azzera decine di collezioni e crea un nuovo `Hud` (`src/scenes/WorldScene.ts:223-243`);
- scrive `hud`, `state` e `time` nel registry globale (`src/scenes/WorldScene.ts:249-251`);
- ricostruisce tilemap, collisione, grafo stradale, stazioni, arredo, player, veicoli, traffico, NPC, fermate, dettagli urbani, animali, corrieri ed eventi (`src/scenes/WorldScene.ts:258-303`);
- registra input e callback HUD (`src/scenes/WorldScene.ts:305-343`);
- installa `__bacoliDebug`, `__bacoliTest` e `shutdown` (`src/scenes/WorldScene.ts:345-542`).

`update()` concatena tempo, fame, routine famiglia, animali, consegne, attività, meteo, acqua, barche, movimento giocatore/NPC/traffico, autosave e HUD (`src/scenes/WorldScene.ts:1031-1092`). Non esiste un’astrazione `WorldController`, `Simulation`, `Renderer` o `InputPort`.

**Conseguenza:** non è possibile testare una regola di gameplay senza avviare Phaser, DOM, localStorage e hook globali. Infatti `vite.config.ts:13-15` include solo `tests/unit/**/*.test.ts` e in `tests/unit` non esiste alcun test di `WorldScene`, `InteriorScene`, `TransitScene` o `Hud`.

### C2. Stato globale mutabile e dipendenze nascoste tra scene

Lo stato non ha un proprietario esplicito. `WorldScene` lo mette nel registry (`src/scenes/WorldScene.ts:249-251`); `InteriorScene` lo rilegge con cast (`src/scenes/InteriorScene.ts:105-107`), muta wallet e tempo condivisi (`src/scenes/InteriorScene.ts:452-476`) e, all’uscita, raggiunge direttamente l’attore privato della scena World tramite `this.scene.get('World')` (`src/scenes/InteriorScene.ts:754-765`).

`TransitScene` riceve il `TimeSystem` e una closure `onArrive` (`src/scenes/TransitScene.ts:5-14`), avanza il tempo condiviso (`src/scenes/TransitScene.ts:264-273`) e richiama la callback per atterrare in `World.finishTrip()` (`src/scenes/TransitScene.ts:290-304`; `src/scenes/WorldScene.ts:1902-1949`).

Altri punti di accoppiamento globale:

- `window.__bacoli` espone l’intera istanza Phaser (`src/main.ts:28-31`);
- `BootScene` legge il salvataggio a livello di modulo, durante l’import (`src/scenes/BootScene.ts:23-26`);
- `WorldScene` lo rilegge nel costruttore (`src/scenes/WorldScene.ts:156-183`);
- `SaveSystem` usa `localStorage` globale con chiave fissa (`src/systems/SaveSystem.ts:11`, `src/systems/SaveSystem.ts:228-245`);
- la HUD registra un listener `keydown` su `window` (`src/ui/Hud.ts:92-102`).

**Conseguenza:** l’ordine di import/bootstrap e il ciclo di vita delle scene determinano il comportamento. Una scena non dichiara cosa consuma: lo prende dal registry, da `window`, da localStorage o da una closure.

### C3. Lifecycle di `scene.restart()` e caricamento dinamico come protocollo implicito

Il cambio regione non crea una nuova scena: modifica `state`, `pendingSpawn`, salva e chiama `this.scene.restart()` (`src/scenes/WorldScene.ts:185-193`). Anche l’arrivo di un viaggio usa lo stesso meccanismo (`src/scenes/WorldScene.ts:1902-1924`). Phaser riutilizza l’istanza: `create()` deve ricordare quali campi azzerare (`src/scenes/WorldScene.ts:223-240`) e quali sopravvivere (`pendingSpawn`, `tripOriginRegion`, `lastBellHour`, `autosaveTimer`, `waterTimer`). Il commento stesso ammette che gli sprite della visita precedente “sono già stati distrutti” (`src/scenes/WorldScene.ts:207-210`).

Il caricamento delle facciate della nuova regione è un secondo ciclo: `create()` avvia `load.image()` per le texture mancanti, registra `this.load.once('complete', () => this.scene.restart())` e ritorna (`src/scenes/WorldScene.ts:213-221`). Per questo `__bacoliDebug` ha una guardia `loading: true` (`src/scenes/WorldScene.ts:345-352`) e `update()` ritorna finché player/HUD/collisione non sono ricostruiti (`src/scenes/WorldScene.ts:1031-1034`).

`shutdown()` sincronizza e salva lo stato, rimuove il listener resize e distrugge la HUD (`src/scenes/WorldScene.ts:534-542`), ma non esiste una macchina a stati esplicita del ciclo di vita: `boot → ready → loadingTextures → restarting → ready`. Il comportamento è coordinato da flag sparsi e dal test che attende `d.loading === false` (`tests/e2e/m6_performance.spec.ts:15-18`).

`InteriorScene` usa `scene.restart(this.data2)` per rifare i mobili dopo un acquisto (`src/scenes/InteriorScene.ts:734-746`). `TransitScene`, invece, rimuove il proprio hook su `SHUTDOWN` (`src/scenes/TransitScene.ts:71-74`), mentre World e Interior sovrascrivono i loro hook a ogni `create`.

**Conseguenza:** restart e caricamento sono corretti solo perché i test conoscono e attendono la sequenza. Non sono un contratto architetturale.

### C4. Hook E2E come piano di controllo parallelo al gameplay

`__bacoliDebug` restituisce un snapshot interno molto ricco: posizioni, NPC, veicoli, regime stradale, ombre, stato economico, career, eventi e conteggi (`src/scenes/WorldScene.ts:345-421`). `__bacoliTest` espone mutatori diretti: `teleport`, `giveMoney`, `setRegion`, `setAffinity`, `damage`, `setTime`, `setDay`, `buyBusinessAt`, `findWall` e altri (`src/scenes/WorldScene.ts:425-532`). `InteriorScene` pubblica `__bacoliInterior` (`src/scenes/InteriorScene.ts:130-141`) e `TransitScene` pubblica `__bacoliTransit` con `complete()` (`src/scenes/TransitScene.ts:71-83`).

I test si appoggiano massicciamente su questa superficie:

- collisione verificata con `findWall()` + `teleport()` + `canStand()` (`tests/e2e/game.spec.ts:85-100`);
- guida avviata con `teleport()` + `enterVehicle()` (`tests/e2e/game.spec.ts:103-126`);
- regioni cambiate con `setRegion()` (`tests/e2e/m5_regions.spec.ts:20-27`, `tests/e2e/m6_performance.spec.ts:50-58`);
- interni lanciati direttamente con `scene.launch('Interior', ...)` e campi privati letti via cast (`tests/e2e/game.spec.ts:58-63`, `tests/e2e/m6_interiors.spec.ts:66-104`);
- salvataggio v4 costruito a mano dentro il test (`tests/e2e/m6_interiors.spec.ts:146-162`).

**Conseguenza:** i test sono stabili ma non esercitano il percorso che un giocatore deve seguire. `setRegion()` non acquista biglietti (`src/scenes/WorldScene.ts:447-455`), `giveMoney()` non passa dalla shop, `damage()` non passa dall’usura, `complete()` forza l’arrivo.

### C5. Nessun confronto visivo: le screenshot sono artifact, non assertion

Le E2E salvano screenshot ma non le confrontano con una baseline: `tests/e2e/game.spec.ts:15`, `tests/e2e/m5_regions.spec.ts:38-39`, `tests/e2e/m6_sample.spec.ts:41,50`, `tests/e2e/game.spec.ts:421-449`. In tutto `tests/` non ci sono `toHaveScreenshot`, `toMatchSnapshot` o comparazioni pixel. Il test “QA visiva regione M6” verifica solo regione, `places > 2`, `solidTiles > 0` e assenza di errori (`tests/e2e/m5_regions.spec.ts:29-40`).

**Conseguenza:** una scena con palazzi piatti, colori sbagliati o oggetti fuori contesto può restare verde indefinitamente.

### C6. Contratto geometrico rotto: rettangolo disegnato, poligono collisionato

Il generatore OSM scrive nell’JSON solo il **rettangolo di ingestione** dell’impronta perché i tile esatti sono già nel buffer binario (`tools/build_map_centro.py:246-254`; analogamente `tools/build_map_regions.py:382-445`). La collisione rasterizza l’impronta poligonale esatta (`tools/build_map_centro.py:331-393`; `tools/build_map_regions.py:382-440`).

Il runtime però disegna la facciata usando il rettangolo: `spawnProps()` prende `bbox`, `facadeWidth`, `floors` e `variant` e centra uno sprite rettangolare (`src/scenes/WorldScene.ts:692-713`). `facadeWidth()` forza il valore a una lista discreta di larghezze (`src/scenes/WorldScene.ts:648-651`). `loadCollision()` passa a `CollisionSystem` solo i bit, **senza i luoghi** (`src/scenes/WorldScene.ts:545-565`), quindi non vengono aggiunti rettangoli approssimati. `CollisionSystem` usa i tile solidi e campiona il bordo della sagoma circolare (`src/systems/CollisionSystem.ts:75-95`).

Verifica sui dati pubblicati (non un test): nel centro, su 226 luoghi con `bounds`, **198 hanno un rettangolo non interamente solido** e **24 hanno una facciata più larga del rettangolo, fino a 4 tile**. Il giocatore può quindi camminare in zone coperte dallo sprite visibile ma non dal buffer solido: è la spiegazione strutturale del “passa attraverso i palazzi”. L’overlay di debug rafforza l’illusione perché disegna i `bounds` come rettangoli blu (`src/systems/DebugOverlay.ts:91-98`) mentre la fisica usa la bitmask (`src/systems/DebugOverlay.ts:81-88`).

I test unitari di collisione usano una griglia sintetica e un edificio rettangolare (`tests/unit/CollisionSystem.test.ts:5-27`), quindi non possono vedere questo disallineamento. Il test E2E sceglie un singolo tile solido con `findWall()` (`src/scenes/WorldScene.ts:516-531`) e verifica solo quel confine (`tests/e2e/game.spec.ts:89-100`).

### C7. Superficie stradale e superficie di sosta sono concetti diversi, ma il codice li mescola

`RoadGraph` definisce classi semantiche: `0` fuori strada, `1` asfalto, `2` basolato, `3` marciapiede, `4` sterrato; solo `1`/`2` sono guidabili (`src/systems/RoadGraph.ts:54-78`). Il traffico rispetta questa regola: `findRoadSpot()` filtra con `drivable()` (`src/scenes/WorldScene.ts:865-891`) e `spawnTraffic()` lo usa (`src/scenes/WorldScene.ts:893-923`).

I veicoli posseduti, invece, usano `findVehicleSpot()`, che controlla soltanto `canStand()` (`src/scenes/WorldScene.ts:585-602`) e viene chiamato allo spawn (`src/scenes/WorldScene.ts:839-858`) e quando si ritira un veicolo dal garage (`src/scenes/WorldScene.ts:1646-1668`). L’acquisto in concessionaria assegna addirittura `player.x + 20` senza alcun controllo di superficie (`src/scenes/WorldScene.ts:2105-2137`). Se non trova una piazzola entro 8 anelli, `findVehicleSpot()` restituisce comunque il tile richiesto (`src/scenes/WorldScene.ts:600-601`).

L’arredo urbano ha il problema opposto: `placeUrbanProp()` rifiuta solo l’asfalto (`surface === 1`) e ammette esplicitamente la classe `0` (`src/scenes/WorldScene.ts:722-727`). Dopo di che applica solo `canStand()`, distanza fra oggetti e 12 px dall’ingresso (`src/scenes/WorldScene.ts:728-746`). La distribuzione usa slice arbitrarie e moduli: 26 caffè, 18 aree verdi, 20 servizi (`src/scenes/WorldScene.ts:770-791`), lampioni ogni 9 tile (`src/scenes/WorldScene.ts:793-802`), segnali ogni 17 (`src/scenes/WorldScene.ts:803-813`). È un criterio geometrico, non un criterio di luogo.

Il test dell’arredo verifica solo che gli spot siano >25, le lampade >5 e che non si sovrappongano (`tests/e2e/m6_urban.spec.ts:18-27`). Il test del traffico verifica continuità dei veicoli di traffico (`tests/e2e/m6_traffic.spec.ts:25-49`), non la superficie dei veicoli posseduti.

### C8. Pipeline asset: geometria OSM corretta, identità visiva assente

Le posizioni e le impronte vengono da OSM (`tools/build_map_centro.py:331-399`, `tools/build_map_regions.py:382-445`), ma:

- i piani sono stimati dall’area e dichiarati come approssimazione (`tools/build_map_centro.py:371-398`, `tools/build_map_regions.py:424-445`);
- le facciate sono disegnate proceduralmente con rettangoli, finestre, balconi e variazioni di seed in base a `w`, `floors` e `variant` (`tools/generate_assets_scale.py:343-386`);
- il generator storico disegna 6 layout generici (`tools/generate_assets.py:654-750`);
- `AssetKeys` deriva le chiavi solo da larghezza/piani/variante (`src/systems/AssetKeys.ts:10-27`);
- `facadeVariant()` sceglie per regex sul nome, per `kind` o per hash FNV di `kind:id` (`src/scenes/WorldScene.ts:627-646`);
- gli interni scelgono template con regex su nome/tipo/sorgente (`src/scenes/InteriorScene.ts:53-74`).

Il risultato è coerente con la scala (1 m = 16 px) e con i metadati OSM, ma non con l’aspetto dei luoghi reali. Il test della scala controlla numeri e larghezze ammesse (`tests/e2e/game.spec.ts:367-418`), non somiglianza o qualità.

### C9. Persistenza ben fatta, ma modello troppo permissivo e globale

`SaveSystem` è il componente più solido: versione 4 (`src/systems/SaveSystem.ts:15-16`), checksum FNV-1a (`src/systems/SaveSystem.ts:24-32`), migrazione v1→v4 (`src/systems/SaveSystem.ts:45-73`), normalizzazione difensiva (`src/systems/SaveSystem.ts:94-213`), verifica prima della migrazione (`src/systems/SaveSystem.ts:215-226`) e localStorage (`src/systems/SaveSystem.ts:228-245`). È coperto da 9 test unitari e da un test E2E che inietta un envelope v4 (`tests/unit/SaveSystem.test.ts:40-143`, `tests/e2e/m6_interiors.spec.ts:146-177`).

Restano problemi architetturali: `GameState` ha molti campi opzionali usati come “schema evolutivo” (`src/core/types.ts:42-46`, `src/core/types.ts:49-56`, `src/core/types.ts:77-79`, `src/core/types.ts:92-101`), `normalize()` muta l’oggetto ricevuto (`src/systems/SaveSystem.ts:95-213`), e ogni sistema può scrivere lo stesso stato condiviso. Il salvataggio non è una frontiera di comandi validati, ma un oggetto mutabile globale.

### C10. Perché 163 test verdi

Il conteggio è spiegabile e coerente con la configurazione:

- **99 test unitari**: le `it(...)` nei 19 file di `tests/unit`, eseguiti da `npm test` (`package.json:11`) con ambiente `node` e solo `tests/unit/**/*.test.ts` (`vite.config.ts:13-15`).
- **32 test E2E per progetto**: 24 dichiarazioni `test(...)`, di cui quella in `tests/e2e/m5_regions.spec.ts:13-14` si espande in 9 regioni (`tests/e2e/m5_regions.spec.ts:5-8`). 24 + 8 = 32.
- **2 progetti Playwright**: desktop Chrome e mobile Android (`playwright.config.ts:15-18`). 32 × 2 = 64.
- **99 + 64 = 163**.

Il vincolo `workers: 1` è esplicitamente legato al boot pesante di nove regioni e buffer binari (`playwright.config.ts:5-8`). Questo è un sintomo di architettura di avvio: `BootScene` precarica tutti i buffer delle regioni (`src/scenes/BootScene.ts:51-57`) e solo le facciate della regione iniziale (`src/scenes/BootScene.ts:66-68`).

---

## 3. Tabella componenti: RECUPERABILE o DA RISCRIVERE

| Componente | Verdetto | Motivazione ed evidenze |
|---|---|---|
| `src/systems/Economy.ts`, `TimeSystem.ts`, `Pathfinding.ts`, `NpcRoutineSystem.ts`, `LifeSystem.ts`, `PetSystem.ts`, `RelationshipSystem.ts`, `CareerSystem.ts`, `HomeSystem.ts`, `BusinessSystem.ts`, `DeliverySystem.ts`, `EventSystem.ts`, `ConsumptionSystem.ts`, `VehicleSystem.ts`, `TransportSystem.ts` | **RECUPERABILE** | Logica prevalentemente pura e ben coperta da test unitari; esempi: `src/systems/Economy.ts:9-24`, `src/systems/TimeSystem.ts:5-42`, `src/systems/Pathfinding.ts:17-56`, `src/systems/TransportSystem.ts:1-37`. Vanno isolate dietro porte e modelli del nuovo dominio, non eliminate. |
| `src/systems/SaveSystem.ts` | **RECUPERABILE** | Checksum, migrazione, normalizzazione e test sono solidi (`src/systems/SaveSystem.ts:15-73`, `src/systems/SaveSystem.ts:94-245`). Va reso dipendente da uno storage injectato e da uno schema esplicito. |
| `src/systems/RoadGraph.ts` | **RECUPERABILE** | Classi OSM, `drivable()`, A* e destinazioni sono riutilizzabili (`src/systems/RoadGraph.ts:54-110`). Va però usato come unica autorità per veicoli e arredo, oggi non lo è. |
| `src/systems/CollisionSystem.ts` | **RECUPERABILE** | Movimento separato sugli assi, solidi circolari e test puri sono validi (`src/systems/CollisionSystem.ts:75-112`, `tests/unit/CollisionSystem.test.ts:16-77`). Va esteso con il contratto geometrico condiviso con il renderer; oggi riceve solo bit (`src/scenes/WorldScene.ts:562-564`). |
| `src/systems/DebugOverlay.ts` | **RECUPERABILE** | Strumento diagnostico utile e testato indirettamente (`src/systems/DebugOverlay.ts:11-103`). Va disaccoppiato da `WorldScene` e allineato al poligono reale, non ai soli `bounds`. |
| `src/core/config.ts`, `src/core/types.ts` | **RECUPERABILE** | Cataloghi e scala sono una base valida (`src/core/config.ts:1-27`). `GameState` va però trasformato in modello versionato con invarianti, non in sacco di campi opzionali (`src/core/types.ts:31-46`, `src/core/types.ts:92-101`). |
| `tools/build_map_centro.py`, `tools/build_map_regions.py`, `tools/m6_paving.py`, `tools/osm_to_map.py` | **RECUPERABILE** | L’ingerimento OSM e la pavimentazione sono il vero valore geografico (`tools/build_map_centro.py:331-454`, `tools/build_map_regions.py:382-490`, `tools/m6_paving.py:17-24`). Vanno riscritti solo nel contratto d’uscita: impronta esatta + semantica superficie + manifest asset. |
| `tests/unit/**` | **RECUPERABILE** | 99 spec sono la migliore documentazione esecutiva dei sistemi. Vanno ricollegate alle nuove interfacce, non cancellate. |
| `src/scenes/WorldScene.ts` | **DA RISCRIVERE** | Monolite di ~2416 righe con stato, rendering, simulazione, UI, persistenza, hook e transizioni (`src/scenes/WorldScene.ts:104-154`, `:207-303`, `:345-542`, `:1031-1092`). Va smontato in controller, sistemi e porte esplicite. |
| `src/scenes/InteriorScene.ts` | **DA RISCRIVERE** | Dipende da registry globale, muta stato condiviso, richiama privati di World e pubblica hook non rimosso (`src/scenes/InteriorScene.ts:105-107`, `:452-476`, `:734-765`). Conservare solo la regola `templateFor()` come dato/spec. |
| `src/scenes/TransitScene.ts` | **DA RISCRIVERE** | Riceve `TimeSystem` e callback closures, forza arrivo via hook e coordina stop/resume (`src/scenes/TransitScene.ts:5-14`, `:71-83`, `:290-304`). Estrarre una macchina di viaggio pura. |
| `src/scenes/BootScene.ts` | **DA RISCRIVERE** | Legge il save a import-time (`src/scenes/BootScene.ts:23-26`) e precarica tutti i buffer (`src/scenes/BootScene.ts:51-57`). Boot deve diventare uno stato esplicito con caricamento per regione. |
| `src/ui/Hud.ts` | **DA RISCRIVERE** | DOM globale, ID fissi, listener `window`, HTML generato via stringa e callback pubbliche mutate dalla scena (`src/ui/Hud.ts:46-102`). Va sostituita da un controller UI con eventi tipizzati. |
| `src/systems/AssetKeys.ts` | **DA RISCRIVERE** | Il concetto di caricamento selettivo è buono, ma il contratto chiavi è legato al placeholder procedurale (`src/systems/AssetKeys.ts:10-27`). Va sostituito da un manifest di asset con identità per edificio/luogo. |
| `tools/generate_assets_scale.py`, `tools/generate_assets.py` | **DA RISCRIVERE** | Generano facciate e oggetti da primitive e varianti generiche (`tools/generate_assets_scale.py:343-386`, `tools/generate_assets.py:654-750`). Se si vuole fedeltà visiva serve una pipeline artistica/manifest, non più seed. |
| `tests/e2e/**` | **DA RISCRIVERE** | Dipendono da hook mutatori e accesso ai privati, e non fanno confronto visivo (`tests/e2e/game.spec.ts:85-126`, `tests/e2e/m5_regions.spec.ts:20-40`, `tests/e2e/m6_interiors.spec.ts:66-104`). Conservare come test di compatibilità temporanea, sostituire con test di percorso reale e baseline visive. |

---

## 4. Piano di ricostruzione in fasi

### Fase 0 — Congelamento e contratti (senza toccare il comportamento)

1. Marcare i 163 test come **characterization baseline**: devono restare verdi finché non viene introdotto il nuovo strato.
2. Scrivere i tre contratti che oggi mancano:
   - `GeometryContract`: impronta esatta, rettangolo di rendering, asset associato, conflitti tra i due;
   - `SurfaceContract`: classi `0..4` con regole esplicite per pedone, veicolo posseduto, traffico, arredo;
   - `SessionContract`: chi possiede `GameState`, chi può mutarlo, quando si persiste.
3. Introdurre un inventory automatico che confronti `bounds`, bitmask e `facadeWidth` per ogni regione, riproducendo la verifica descritta in C6.

**Uscita:** i difetti noti sono riproducibili come test che falliscono o come report dati, non più solo come lamentele visive.

### Fase 1 — Riparare il contratto dati e geometrico

1. Aggiungere all’output dei generatori l’impronta esatta (o un id di footprint) accanto al `bounds`, senza duplicare inutilmente 1,8 MB: una tabella indicizzata è sufficiente (`tools/build_map_centro.py:246-254`).
2. Far derivare rendering e collisione dallo stesso record: sprite, ombra, bordo e superficie solida devono avere la stessa sorgente (`src/scenes/WorldScene.ts:545-565`, `:692-713`).
3. Far usare `RoadGraph.drivable()` a **tutti** i veicoli, non solo al traffico (`src/systems/RoadGraph.ts:73-78`, `src/scenes/WorldScene.ts:585-602`, `:839-858`). Rimuovere il fallback che restituisce un tile non valido (`src/scenes/WorldScene.ts:600-601`).
4. Sostituire le regole di arredo con regole semantiche: tipo di luogo → oggetti ammessi → superficie ammessa → distanza da ingressi e da altri oggetti (`src/scenes/WorldScene.ts:722-813`).

**Uscita:** test che falliscono se un veicolo posseduto nasce su classe diversa da `1`/`2`, se una facciata eccede l’impronta solida, se un oggetto nasce su classe `0` senza regola.

### Fase 2 — Estrarre la simulazione pura da `WorldScene`

1. Creare una `GameSession` con comandi espliciti (`MovePlayer`, `BuyTicket`, `EnterPlace`, `AdvanceTime`, `Save`), ricevente `GameState`, `TimeSystem`, `SavePort` e `Clock` per injection.
2. Portare dentro la sessione le chiamate oggi sparse in `update()`, `interact()`, `openPlace()` e `openPhone()` (`src/scenes/WorldScene.ts:1031-1092`, `:1772-1812`, `:1972-2234`).
3. Rimuovere la dipendenza da `localStorage` globale: `SaveSystem` riceve uno storage (`src/systems/SaveSystem.ts:228-245`).
4. Rendere `normalize()` non mutante o isolato in un `MigrationPipeline` con schema versionato (`src/systems/SaveSystem.ts:94-213`).

**Uscita:** 99 test unitari continuano a passare senza Phaser; nuovi test di sessione coprono i percorsi che oggi sono coperti da hook.

### Fase 3 — Smontare `WorldScene`

1. Separare:
   - `WorldController`: ciclo di vita e coordinamento;
   - `MapRenderer`: tilemap, facciate, ombre, atmosfera;
   - `ActorSystem`: giocatore, NPC, animali, corrieri;
   - `TrafficSystem`: veicoli posseduti e traffico;
   - `InteractionSystem`: luoghi, negozi, telefono, viaggi;
   - `HudController`: UI canalizzata da eventi.
2. Sostituire `scene.restart()` per cambio regione con `WorldController.loadRegion(id)` + `dispose()` esplicite; il caricamento texture diventa uno stato, non un ritorno anticipato da `create()` (`src/scenes/WorldScene.ts:185-222`).
3. Rimuovere `__bacoliDebug`/`__bacoliTest` dal codice di gioco; spostarli in un adapter di test attivato solo da flag di build.

**Uscita:** nessun file sorgente supera una soglia ragionevole (per esempio 300-400 righe); ogni sistema è testabile con fake clock/fake renderer.

### Fase 4 — Riscrivere transizioni tra scene

1. `InteriorScene` riceve un DTO immutabile e una porta di commissione; non legge registry né tocca `World.player` (`src/scenes/InteriorScene.ts:105-107`, `:754-765`).
2. `TransitScene` riceve `TravelPlan` e restituisce `TravelResult`; il tempo avanzato viene calcolato dalla sessione, non dalla scena (`src/scenes/TransitScene.ts:5-14`, `:264-304`).
3. Uniformare la rimozione degli hook su `SHUTDOWN` per tutte le scene (`src/scenes/TransitScene.ts:71-74` come modello).
4. Aggiungere test di percorso reale: ottieni biglietto → viaggio → arrivo → ingresso → uscita → salvataggio → reload.

**Uscita:** nessun test E2E deve chiamare `setRegion()`, `teleport()`, `giveMoney()`, `scene.launch()` o `complete()` per verificare una regola di gioco.

### Fase 5 — Ricostruire la qualità visiva e l’ambientazione

1. Sostituire `facadeVariant()` e i generatori procedurali con un manifest di asset per edificio/luogo, mantenendo la scala 1 m = 16 px (`src/core/config.ts:3-7`).
2. Separare “geometria verificata OSM” da “dettaglio artistico dichiarato”: ogni elemento dichiara `source` e `confidence` (`src/core/types.ts:19-26`, `tools/build_map_centro.py:371-398`).
3. Introdurre regole di composizione per arredo: contesto costiero, piazzetta, lungomare, centro storico, area lacustre, non solo `index % n`.
4. Creare baseline visive Playwright (`toHaveScreenshot`) per un set ridotto e stabile di regioni e interni.

**Uscita:** un controllo umano approva le screenshot; i test falliscono se la resa cambia.

### Fase 6 — Nuovo gate di qualità

1. Mantenere i 163 test storici come suite di compatibilità finché la nuova suite non li supera in copertura.
2. Aggiungere:
   - test di contratto dati (footprint ↔ sprite ↔ collisione);
   - test di superficie per veicoli e arredo;
   - test di lifecycle (restart, loading, shutdown, doppio ingresso in interno);
   - test di percorso E2E senza hook mutatori;
   - baseline visive e budget FPS/memoria.
3. Rimuovere `workers: 1` come workaround solo se il boot viene reso realmente incrementale (`playwright.config.ts:5-8`, `src/scenes/BootScene.ts:51-57`).

---

## 5. Rischi

| Rischio | Impatto | Mitigazione |
|---|---|---|
| Regressione dei salvataggi v1-v4 | Perdita di partite pubblicate; la migrazione è già delicata (`src/systems/SaveSystem.ts:45-73`). | Mantenere `SaveSystem` come componente recuperabile, test di migrazione gold-master, dual-read durante la transizione. |
| Falsa sicurezza dai 163 test verdi | La ricostruzione può “rompere i test” pur migliorando il prodotto, o viceversa. | Classificare i test storici come characterization; aggiungere test sulle cause reali prima di refactorare. |
| Rimuovere gli hook rompe l’E2E | Tutte le spec attuali dipendono da `__bacoliTest`/`__bacoliDebug`. | Introdurre l’adapter di test in parallelo e migrare una spec alla volta. |
| Reintroduzione del monolite | La comodità di `WorldScene` è elevata e può essere ricopiata nei nuovi controller. | Code review con limiti di dimensione e test di indipendenza dei sistemi. |
| Perdita di fedeltà geografica | Sostituendo l’arte procedurale si può perdere la correttezza OSM. | Mantenere generatori OSM come sorgente autoritativa; separare geometry da stile. |
| Costo e licenze degli asset | Nuova arte può essere costosa o non utilizzabile. | Definire licenza e provenienza nel manifest prima della produzione; mantenere fallback procedurale dichiarato. |
| Performance del boot | Nove regioni 1100×1100 e buffer binari già forzano `workers: 1` (`playwright.config.ts:5-8`). | Caricamento incrementale, budget texture e profilo in Fase 0. |
| Lifecycle Phaser | `scene.restart()` riutilizza l’istanza; flag residui possono sopravvivere in modo non evidente (`src/scenes/WorldScene.ts:185-222`). | Macchina a stati esplicita e test dedicati a shutdown/restart/doppio ingresso. |
| Superficie globali | `window`, registry e localStorage rendono difficile riprodurre failure. | Injection di storage, clock, logger e bus eventi; nessun hook di gioco su `window`. |
| Ambito troppo ampio | Riscrivere insieme mappe, scene, UI e asset aumenta il rischio di blocco. | Seguire l’ordine F0→F6; ogni fase ha artifact verificabili e può essere rilasciata separatamente. |

---

## Conclusione

La Milestone 6 ha prodotto un sistema che **funziona sotto test** perché i test sono stati costruiti intorno alle sue dipendenze nascoste: hook globali, stato condiviso e conteggi interni. Non ha prodotto un’architettura in cui la qualità visiva, la coerenza geometrica e i percorsi di gioco siano verificabili indipendentemente.

La ricostruzione non deve partire dalla grafica né riscrivere tutto alla cieca. Deve partire dai contratti: geometria, superficie, sessione, lifecycle. I sistemi puri e i generatori OSM vanno conservati; `WorldScene`, le scene derivate, la HUD e la pipeline di asset vanno riscritte attorno a quei contratti. Solo allora “163 test verdi” potrà diventare un indicatore di qualità invece che un effetto collaterale dell’architettura.
