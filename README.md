# BACOLI LIFE

Simulatore di vita open world 2D ambientato a **Bacoli** (NA), in via di sviluppo.
Progetto autonomo: non modifica CAMPANIA LIFE né CAMPANIA CODEX.

## Fase attuale
Milestone 5: centro storico metrico più nove regioni flegree reali (Marina Grande,
Lago Miseno, Villa Comunale, Miseno, Miliscola, Baia, Fusaro e Torregaveta),
collegate alla rete EAV/ANM. La sola scala universale è **1 metro = 16 pixel**
(adulto 28 px, piano edilizio 52 px).

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
Strade, edifici, POI e specchi d'acqua derivano da OpenStreetMap/Overpass; le
fotografie reali e il geoportale comunale sono riferimenti di palette, volumi e
toponomastica. Ogni regione è restituita in metri reali con un tile = 1 metro.
Nessuna stazione EAV è stata inventata: Pianura e Napoli restano solo
predisposte nei trasporti.

## Rigenerazione M5
```bash
python tools/build_map_regions.py
python tools/validate_geography.py
python tools/validate_m5_world.py
python tools/check_proportions.py
```

## Documentazione
- `docs/PROGRESS.md` — progressi e strumenti
- `docs/ROADMAP.md` — roadmap, inclusa l'espansione futura Pianura/Napoli 80126
- `docs/M5_REPORT.md` — verifica finale della milestone 5
- `docs/M5_ASSET_AUDIT.md` — audit reale degli asset originali
- `docs/M5_GEO_AUDIT.md` — fonti e geometrie delle nuove regioni
- `docs/osm_bacoli_raw.json` — fonte grezza OSM del centro
