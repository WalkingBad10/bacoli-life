# BACOLI LIFE — registro progressi

Repository dedicato, indipendente da CAMPANIA LIFE e CAMPANIA CODEX.
Aggiornato: fase 1 completata, fase 2 iniziata.

## Strumenti installati e utilizzati
| Strumento | Stato | Uso concreto |
| --- | --- | --- |
| Node.js 26.13.1 LTS | installato (winget) | build e test |
| npm 11.20.0 | installato | gestione dipendenze |
| Python 3.12.10 + Pillow + NumPy | installati | pixel art procedurale, analisi foto, audio |
| Git 2.56.1 / GitHub CLI 2.105.0 | installati | repository locale; remote in attesa di login |
| Phaser 3.90 | installato | motore grafico |
| TypeScript 5.9 / Vite 7 | installati | codice e build |
| Vitest 3.2 | installato | 16 test unitari superati |
| Playwright 1.55 + Chromium | installati | 8 test E2E desktop/mobile superati |
| Howler.js | installato | musiche e ambient sounds originali |
| Tiled JSON | generato da script | mappa 160x120 con layer ground/collision |
| OpenStreetMap API / Overpass | utilizzati | 1478 strade, 284 POI, 226 edifici reali |
| ImageMagick / QGIS / Tiled GUI / Pixelorama | non installati | alternative equivalenti: Pillow + script Python + JSON Tiled |

## Riferimenti dell'utente
- 6 immagini ricevute (2 riferimenti grafici + 4 fotografie).
- Analisi numerica con Pillow: dimensioni, 12 colori dominanti, mappa testuale.
- La generazione AI non è utilizzabile: il servizio risponde "Invalid credential".
- Le foto hanno guidato la palette: sabbia #D3B59D, terracotta #B67352,
  mare #185F76 / #3A9FF3, ombra #0C1823, verde oliva #4C6E44.

## Funzionalità implementate e verificate
- [x] Repository, build, test automatici, salvataggi locali.
- [x] Pixel art originale: tileset 16x16, 6 edifici dettagliati, 5 personaggi
      4 direzioni x 4 frame, 6 props, 13 arredi, 4 pavimenti interni.
- [x] Mappa Tiled reale: Via Ortensio, Via Spiaggia, piazzetta sul mare,
      226 edifici OSM, 223 luoghi, collisioni, costa e sabbia.
- [x] Movimento a 4 direzioni con collisioni, corsa, animazioni, joystick touch.
- [x] Ciclo giorno/notte, pioggia, lampeggio lampade, onde animate.
- [x] 5 NPC con A*, routine casuali, dialoghi in napoletano.
- [x] Interazioni: negozi, bar, ristoranti, casa, spiaggia, banca, siti archeologici.
- [x] Interni visitabili con arredi specifici per tipo di attività.
- [x] Economia: acquisti, vendite, conto corrente, stipendio, spese.
- [x] Smartphone: mappa, contatti, consegne, orari trasporti, lavori.
- [x] Salvataggi manuale/automatico, export/import con checksum e migrazione.
- [x] Audio originale sintetizzato con Howler.js (onde, gabbiani, pioggia,
      campane, melodia) avviato alla prima interazione.
- [x] Architettura delle regioni e delle linee EAV pronta per Pianura (non costruita).

## Verifiche effettuate
- `npm test`: 16/16 test unitari superati.
- `npm run test:e2e`: 8/8 test Chromium desktop e mobile Android superati.
- Screenshot automatici in `screenshots/`: mondo desktop/mobile, smartphone, interni.
- Analisi screenshot: presenza di mare (~10% pixel blu), colori caldi (~50%),
  624 colori distinti su desktop: la scena non è una schermata vuota o piatta.
- `npm run build`: compilazione TypeScript e bundle Vite riusciti.

## Non ancora verificato su dispositivi reali
- Nessun test eseguito su smartphone fisico, MacBook o Windows nativo al di
  fuori di Chromium headless. I controlli touch sono testati solo in emulazione.

## Problemi aperti
- GitHub: `gh auth status` riporta "not logged into any GitHub hosts".
  Servono autorizzazione/login per creare il repository remoto e pubblicare
  su GitHub Pages.
- La generazione AI delle immagini richiede credenziali valide.
- Mancano ancora: veicoli, trasporti pubblici giocabili, famiglia, proprietà,
  ampliamento territoriale e sistema ferroviario (vedi `ROADMAP.md`).
- Bundle JS > 500 kB (Phaser): da ottimizzare nella fase 6.
