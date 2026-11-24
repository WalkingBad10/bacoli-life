# M5 — Report finale di milestone

Data: **2026-11-25** · ambito: solo `bacoli-life`; M4 resta la base pubblicata e verificata.

## 1. Base di partenza e backup

| Elemento | Valore |
| --- | --- |
| Commit M4 chiuso | `e1788fe` + `ad2f89f`, tag `milestone-4-verified` |
| Pubblicazione M4 | GitHub Pages run #9/#10 riuscite, `https://walkingbad10.github.io/bacoli-life/` |
| Backup pre-M5 | `bacoli-life-backups/bacoli-life-20261124-225500-prima-milestone5.zip` (77.175.183 byte, 1.223 file) |
| Versione salvataggi | `SAVE_VERSION = 4` (invariata: i salvataggi M4 restano leggibili) |

---

## 2. Obiettivi M5 completati

### 2.1 Mondo metrico a nove regioni

Il dataset unico `src/data/bacoli_world.json` contiene 9 regioni reali; il centro storico
resta la prima regione ed è metricamente invariato rispetto a M4 (`463×722` tile):

| Regione | Dimensione | Strada (tile) | Edifici OSM | Luoghi | Acqua nel buffer |
| --- | --- | ---: | ---: | ---: | ---: |
| `centro` | 463×722 | 30.397 | 226 | 376 | — |
| `baia` | 1100×1100 | 87.612 | 740 | 827 | 2,8% |
| `fusaro` | 1095×1100 | 74.494 | 835 | 882 | 30,7% |
| `lago_miseno` | 994×745 | 38.647 | 263 | 276 | 61,8% |
| `marina_grande` | 590×722 | 29.579 | 223 | 246 | 25,1% |
| `miliscola` | 1096×1100 | 44.047 | 471 | 487 | 19,9% |
| `miseno` | 1096×1100 | 27.963 | 295 | 308 | 38,3% |
| `torregaveta` | 1100×1100 | 29.575 | 414 | 457 | 2,1% |
| `villa_comunale` | 329×278 | 9.997 | 16 | 24 | 61,8% |
| **Totale** | — | — | **3.483** | **3.883** | — |

- Ogni regione ha `ground.bin`, `collision.bin` e `meta.json` propri in
  `public/assets/maps/<regione>/`, precaricati da `BootScene`.
- `tools/generated/m5_osm_raw.json`: 5.082.509 byte, 59 fonti HTTP tracciate, 10 zone
  (9 giocabili + 2 di documentazione), 19 elementi `water`.
- Poligoni OSM dell'acqua hanno priorità sul fallback costiero `EAST_COAST`;
  `COAST_SIDE` corregge il lato terra/mare.
- `Pianura` e `Napoli 80126` **non** sono mappe giocabili: restano solo documentate
  nel geo-audit e nella roadmap, come richiesto.

### 2.2 Trasporti EAV/ANM reali

- Una fermata appartiene a una sola regione (`mapRegion` in `TransportSystem.ts`).
- Stazioni disegnate solo per fermate attive con linee `cumana` o `circumflegrea`,
  mai nel centro storico: `rail`, `platform` e `station_eav` usano asset originali.
- Nessuna stazione inventata a Miseno; Baia attiva (riaperta 6/11/2025);
  Circumflegrea oltre Licola sospesa dal 2014 ed esclusa dai viaggi.
- Il viaggio `baia_station` partito dal centro conserva il gate storico
  `(268, 256)` tile / `(4296, 4096)` px per compatibilità con i test M4.
- Gli arrivi nelle altre regioni ricostruiscono la scena sulla coordinata OSM
  della stazione; un toast dedicato conferma il cambio regione.

### 2.3 Contenuti e interazioni

- 13 template di interni (`home`, `bar`, `pizzeria`, `fish`, `supermarket`,
  `tobacco`, `church`, `workshop`, `pharmacy`, `bank`, `post_office`, `shop`,
  `generic`) con arredi differenziati per attività.
- Nuovi oggetti `sigarette` e `candela`; marker puntuali dei POI ora usano
  chiavi coerenti (`cafe_table`, `umbrella`, `boat`, `parking_sign`, `platform`).
- Lavoro, famiglia, figli, animali, proprietà, veicoli e consegne restano
  pienamente funzionanti e verificati in ogni regione.
- Scala universale invariata: **1 metro = 16 pixel**, adulto 28 px,
  piano edilizio 52 px, tile 16×16.

### 2.4 Correzioni runtime individuate in QA

- `scene.restart()` riutilizza l'istanza: `create()` ora rilegge `state.regionId`
  e azzera riferimenti a sprite/anims della regione precedente
  (`npcs`, `traffic`, mappe veicoli/animali/corrieri, decorazioni, lampioni).
- `updateNpcs()` ignora sprite non più attivi: eliminato il crash
  `Cannot read properties of undefined (reading 'stop')` durante i cambi regione.
- `restartInRegion()` scrive regione e posizione in modo atomico e impedisce
  allo `shutdown` della vecchia scena di sovrascrivere lo spawn con coordinate
  obsolete (`pendingSpawn`).
- Spawn scelti privilegiando edifici e acqua nel campo visivo: nessuna regione
  parte più da un prato vuoto.

---

## 3. Verifiche finali

Eseguite tutte sul geodata finale e sul codice finale, il 2026-11-25:

| Controllo | Comando | Esito |
| --- | --- | --- |
| Geografia centro | `python tools/validate_geography.py` | **OK** — 226 impronte OSM, 30.397 tile strada, 376 luoghi |
| Mondo M5 | `python tools/validate_m5_world.py` | **OK** — 9 regioni, 3.883 luoghi, 3.483 edifici, 2.418.549 tile solidi |
| Proporzioni | `python tools/check_proportions.py` | **OK** — 30 asset, 226 edifici, scala 1 m = 16 px |
| QA screenshot | `python tools/check_m5_screenshots.py` | **OK** — 9 frame validi, distinti, 0 duplicati |
| TypeScript + bundle | `npm run build` | **OK** — `tsc --noEmit` + Vite build |
| Unit test | `npm test -- --run` | **99/99** (19 file) |
| E2E desktop + mobile | `npm run test:e2e` | **48/48** (1 worker) |

Gli E2E includono i 15 test originali di M4 per piattaforma e 9 nuovi test di
QA visiva per regione. Il numero di worker è stato impostato a 1 perché i
buffer di nove regioni rendono il boot più pesante: con 2 o 4 worker si
verificavano timeout della HUD e micro-movimenti persi nei test di guida.

---

## 4. QA visiva e confronto con le foto reali

- Screenshot prodotti da `tests/e2e/m5_regions.spec.ts` in
  `docs/M5_SCREENSHOTS/` (9 regioni × desktop/mobile).
- Analisi deterministica in `docs/M5_SCREENSHOT_QA.md`: colori, acqua, verde,
  costruito, aree scure e dHash a 8×8. Tutte le regioni mostrano contenuto
  costruito distinto; almeno 3 regioni costiere inquadrano acqua nel frame.
- Riferimenti fotografici verificati e georeferenziati sono catalogati in
  `docs/M5_GEO_AUDIT.md` §6 (faro di Miseno, Casina Vanvitelliana al Fusaro,
  stazione di Torregaveta, Baia dal castello, panorama di Bacoli, PUC comunale).
- Il modello vision locale `qwen2.5vl:3b` **non è utilizzabile** per il
  confronto automatico (output `@@@@...`, ripetizioni bloccate, HTTP 500 su
  immagini affiancate): come da richiesta, il suo giudizio non è stato usato
  per certificare la qualità artistica. Il QA si basa su screenshot, analisi
  fotografica salvata, metriche pixel ed E2E.

---

## 5. Limitazioni dichiarate

1. **Marina Grande** non è un toponimo OSM verificato a Bacoli: la regione è
   un proxy del waterfront/porto turistico (nodo OSM 1347880357,
   40.7921773 / 14.0792856), dichiarato esplicitamente nel geo-audit.
2. Baia e Torregaveta hanno la costa ai margini della bbox: i rispettivi spawn
   inquadrano il paese; l'acqua è presente nel buffer ma non sempre nel frame.
3. Le tre tavole di asset originali non sono fogli di sprite puliti: solo 4
   asset sono drop-in e già attivi; gli altri restano riferimenti. Dettagli in
   `docs/M5_ASSET_AUDIT.md`.
4. Il bundle Vite supera 500 kB (2,43 MB, gzip 509 kB): è il costo dei 9 buffer
   metrici precaricati; il boot resta sotto i 7 s su Chromium desktop.

---

## 6. Stato pubblicazione

- [x] Backup pre-M5 creato e verificato.
- [x] Backup aggiuntivo pre-pubblicazione: `bacoli-life-backups/bacoli-life-20261125-003700-m5-verificata-prima-pubblicazione.zip` (80.133.905 byte).
- [x] Tutte le validazioni, i test e il QA visiva superati.
- [ ] Commit M5, tag e push su `origin`.
- [ ] Deploy GitHub Pages e verifica live finale.

La pubblicazione avverrà solo dopo che tutti i controlli di questa sezione
saranno spuntati.
