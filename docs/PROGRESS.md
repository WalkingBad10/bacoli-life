# BACOLI LIFE — registro progressi

Repository dedicato, indipendente da CAMPANIA LIFE e CAMPANIA CODEX.
Aggiornato: milestone 2 (Bacoli estesa + veicoli + trasporti + vita domestica) completata e verificata.

## Strumenti installati e utilizzati
| Strumento | Stato | Uso concreto |
| --- | --- | --- |
| Node.js 26.13.1 / npm 11.20.0 | installati | build, test unitari ed E2E |
| Python 3.12.10 + Pillow + NumPy + OpenCV | installati | pixel art procedurale, analisi foto, QA screenshot |
| Git 2.56.1 / GitHub CLI 2.105.0 | installati | push e Pages verificati |
| Phaser 3.90 / TypeScript 5.9 / Vite 7 | installati | motore, tipi, bundle |
| Vitest 3.2 | installato | 40 test unitari superati |
| Playwright 1.55 + Chromium | installato | 16 test E2E (desktop + Android emulato) superati |
| Howler.js | installato | audio originale sintetizzato |
| Ollama + `qwen2.5vl:3b` | installati | analisi visiva locale senza API key |
| OpenStreetMap / Overpass | utilizzati | strade, edifici e POI reali |

## Riferimenti visivi
- 6 fotografie ricevute e analizzate due volte: numericamente con OpenCV
  (`VISUAL_ANALYSIS.md`) e semanticamente con il modello locale
  (`AI_VISION_ANALYSIS.md`).
- Palette approvata dall'utente: sabbia `#D3B59D`, terracotta `#B67352`,
  mare `#185F76`/`#3A9FF3`, ombra `#0C1823`, verde oliva `#4C6E44`.
- Pollinations ha generato un primo asset (`roof_terracotta.png`, 16x16, 12
  colori quantizzati) ma poi è passato a HTTP 402: non è una fonte affidabile.
  Ollama locale resta la via principale; Pillow completa la pipeline.

## Funzionalità implementate e verificate
- [x] Mappa estesa **480x680 tile** con bbox reale
      `S 40.7770 / N 40.8450 / W 14.0400 / E 14.0960`, 303 luoghi,
      61.086 tile strada, coste/laghi reali, collegamenti tra frazioni.
- [x] Collisioni reali: tile solidi, footprint edifici, oggetti circolari con
      scorrimento assiale. Il giocatore non attraversa muri né arredi.
- [x] Veicoli guidabili (auto, moto, bus), traffico, carburante, rifornimento,
      concessionaria, parcheggi. **Bug corretto**: il veicolo non collide più
      con il proprio ostacolo; gli ostacoli mobili aggiornano la posizione.
- [x] Trasporti EAV con dati verificati: Cumana
      `Lucrino → Baia → Fusaro → Torregaveta` (Baia riaperta 6/11/2025),
      Circumflegrea `Licola → Cuma → Lido Fusaro → Torregaveta` con servizio
      sospeso oltre Licola dal 2014, bus 101/102/144/145/146/150/153.
      Nessuna stazione Miseno: i collegamenti Miseno-Baia-Cuma sono bus.
- [x] Casa di proprietà, arredamento acquistabile (9 arredi), famiglia con
      umore e attività condivise, turni di lavoro con stipendio ed energia.
- [x] Interni visitabili **e camminabili**: movimento WASD/frecce, collisioni
      con gli arredi, interazioni dedicate per bar, ristorante, banca,
      farmacia, negozio e casa.
- [x] 12 NPC con A*, routine e dialoghi, 9 personaggi sprite, 39 sprite totali.
- [x] Ciclo giorno/notte, pioggia, lampade, onde, audio, smartphone,
      salvataggi v2 con migrazione v1→v2, export/import.

## Verifiche effettuate (milestone 2)
- `npm run build`: `tsc --noEmit` + Vite riusciti.
- `npm test`: **40/40** test unitari superati (8 file).
- `npm run test:e2e`: **16/16** test superati su Chromium headless desktop e
  Android emulato. Include collisioni, guida con consumo carburante, viaggi
  EAV con biglietti e movimento negli interni.
- QA screenshot OpenCV: `world-chromium-desktop.png` 1280x720, 624 colori
  distinti, densità bordi 0.196; interni 693 colori, 0.088. Nessuna schermata
  vuota o piatta.
- Milestone 2 pubblicata e verificata live (commit `631cc5e`, tag
  `milestone-2-verified`): https://walkingbad10.github.io/bacoli-life/
  (`bundle index-DIPW_ZeD.js`, 303 luoghi, nessun errore console).

## Non ancora verificato su dispositivi reali
- Nessun test su smartphone fisico, MacBook o Windows nativo al di fuori di
  Chromium headless. I controlli touch sono testati solo in emulazione.
- Il viaggio in treno è ancora un teletrasporto con calcolo del tempo, non una
  corsa animata con paesaggio dai finestrini.

## Problemi aperti
- Pollinations non affidabile (402 dopo il primo successo): usare Ollama locale.
- Bundle JS > 500 kB (Phaser): da ottimizzare in fase finale.
- Pianura non costruita: solo architettura dati (`REGIONS` con `active: false`).
