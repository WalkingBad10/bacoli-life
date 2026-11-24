# BACOLI LIFE — registro progressi

Repository dedicato, indipendente da CAMPANIA LIFE e CAMPANIA CODEX.
Aggiornato: milestone 3 (simulazione di vita estesa + viaggi EAV animati) completata e verificata.

## Strumenti installati e utilizzati
| Strumento | Stato | Uso concreto |
| --- | --- | --- |
| Node.js 26.13.1 / npm 11.20.0 | installati | build, test unitari ed E2E |
| Python 3.12.10 + Pillow + NumPy + OpenCV | installati | pixel art procedurale, analisi foto, QA screenshot |
| Git 2.56.1 / GitHub CLI 2.105.0 | installati | push e Pages verificati |
| Phaser 3.90 / TypeScript 5.9 / Vite 7 | installati | motore, tipi, bundle |
| Vitest 3.2 | installato | 59 test unitari superati (12 file) |
| Playwright 1.55 + Chromium | installato | 26 test E2E (desktop + Android emulato) superati |
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
- 48 facciate `building_fine_{32,48,64,80}_{0..11}.png` generate a risoluzione
  nativa, senza deformazioni da `setDisplaySize`.

## Funzionalità implementate e verificate
- [x] Mappa estesa **480x680 tile** con bbox reale
      `S 40.7770 / N 40.8450 / W 14.0400 / E 14.0960`, 303 luoghi,
      61.086 tile strada, coste/laghi reali, collegamenti tra frazioni.
- [x] Collisioni reali: tile solidi, footprint edifici, oggetti circolari con
      scorrimento assiale. Giocatore, veicoli, NPC e animali non Through-wall.
- [x] Veicoli guidabili (auto, moto, bus), traffico (8 veicoli), carburante,
      rifornimento, concessionaria, parcheggi, usura/odometro e tagliandi
      in officina con addebito dal portafoglio.
- [x] Trasporti EAV con dati verificati: Cumana
      `Lucrino → Baia → Fusaro → Torregaveta` (Baia riaperta 6/11/2025),
      Circumflegrea `Licola → Cuma → Lido Fusaro → Torregaveta` con servizio
      sospeso oltre Licola dal 2014, bus 101/102/144/145/146/150/153.
      Nessuna stazione Miseno: i collegamenti Miseno-Baia-Cuma sono bus.
- [x] **Viaggi EAV animati**: `TransitScene` con interni treno/autobus,
      passeggeri, porte automatiche, annunci di fermata, paesaggio scorrevole,
      progresso, salto controllato e avanzamento tempo via `TimeSystem.advance()`.
- [x] Casa di proprietà, arredamento acquistabile (9 arredi), famiglia con
      umore e attività condivise, turni di lavoro con stipendio ed energia.
- [x] Interni visitabili **e camminabili**: movimento WASD/frecce, collisioni
      con gli arredi, posti a sedere occupabili, consumo reale di caffè e cibo
      dall'inventario, tempo condiviso con il mondo.
- [x] 24 NPC con A*, 9 sprite, routine orarie su destinazioni reali e
      dialoghi in italiano/napoletano.
- [x] Relazioni: affinità, regali, fidanzamento e matrimonio con NPC;
      coniuge aggiunto alla famiglia e persistente nei salvataggi.
- [x] Animali domestici: adozione cane/gatto, sprite originali, follow con
      scorrimento assiale e rispetto dei muri, alimentazione, fame e umore.
- [x] Ciclo giorno/notte, pioggia, lampade, onde sfalsate, 9 barche animate,
      54 dettagli urbani, audio, smartphone, salvataggi **v3** con migrazione
      esplicita v1→v2→v3 dopo verifica checksum, export/import.

## Verifiche effettuate (milestone 3)
- `npm run build`: `tsc --noEmit` + Vite riusciti; bundle
  `index-ChazjuF0.js` 1.366,83 kB / gzip 377,35 kB (warning chunk noto).
- `npm test`: **59/59** test unitari superati (12 file), inclusi migrazione v3,
  relazioni/matrimonio, animali, officina, consumo e posti a sedere.
- `npm run test:e2e`: **26/26** test superati su Chromium headless desktop e
  Android emulato. Include collisioni, guida, viaggi EAV animati, adozione,
  matrimonio, tagliando e consumazione al bar.
- QA screenshot OpenCV: desktop 1280x720 e Android emulato 1082x2202,
  densità bordi 0,04–0,17: nessuna schermata vuota o piatta.
- QA semantico Ollama `qwen2.5vl:3b` su 5 screenshot (`SCREENSHOT_VISION_REVIEW.md`):
  cinque giudizi **OK**, nessun elemento sospeso, deformato o fuori posto.
- Backup pre-milestone: `bacoli-life-20261124-142845-milestone3-start.zip`.
- Milestone 2 pubblicata e verificata live (commit `631cc5e`, tag
  `milestone-2-verified`): https://walkingbad10.github.io/bacoli-life/

## Non ancora verificato su dispositivi reali
- Nessun test su smartphone fisico, MacBook o Windows nativo al di fuori di
  Chromium headless. I controlli touch sono testati solo in emulazione.

## Problemi aperti
- Pollinations non affidabile (402 dopo il primo successo): usare Ollama locale.
- Bundle JS > 500 kB (Phaser): da ottimizzare in fase finale.
- Nessuna nuova fotografia specifica ricevuta dopo le 6 già analizzate.
- Pianura non costruita: solo architettura dati (`REGIONS` con `active: false`).
