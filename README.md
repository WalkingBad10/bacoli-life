# BACOLI LIFE

Simulatore di vita open world 2D ambientato a **Bacoli** (NA), in via di sviluppo.
Progetto autonomo: non modifica CAMPANIA LIFE né CAMPANIA CODEX.

## Fase attuale
Vertical slice della prima zona: Via Ortensio, Via Spiaggia, costa, edifici e attività reali.

## Avvio
```bash
npm install
npm run dev
```

## Comandi
| Azione | PC | Mobile |
| --- | --- | --- |
| Movimento | WASD / frecce | joystick |
| Corri | Shift | CORRI |
| Interagisci | E | E |
| Smartphone | T | PHONE |
| Salva / Carica | F5 / F9 | SALVA |
| Esporta / Importa salvataggio | I / O | — |

## Toolchain
- Phaser 3 + TypeScript + Vite
- Tiled JSON (mappe e collisioni)
- Pillow + NumPy (pixel art procedurale e analisi dei riferimenti)
- OpenStreetMap / Overpass + API map (geometria reale)
- Vitest + Playwright (test)
- Howler.js (audio, da integrare)

## Dati geografici
Le strade e gli edifici della zona iniziale derivano da OpenStreetMap.
Scala adattata: 1 tile ≈ 4 metri. Le foto inviate dall'utente sono usate come
riferimento cromatico e architettonico, mai incollate nella mappa.

## Documentazione
- `docs/PROGRESS.md` — progressi e strumenti
- `docs/ROADMAP.md` — roadmap, inclusa l'espansione futura Pianura/Napoli 80126
- `docs/osm_bacoli_raw.json` — fonte grezza OSM
