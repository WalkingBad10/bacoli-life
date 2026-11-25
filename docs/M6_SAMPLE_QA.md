# M6 — QA zona campione (centro storico)

Stato: **Fase 3 completata**. La zona campione è il centro metrico `463x722`,
spawn `(324,478)`, ripreso con telecamera di gioco su desktop e mobile.

## Confronto prima/dopo

| File | Contenuto |
|---|---|
| `M6_SCREENSHOTS/00-prima-M5-centro-desktop.png` | baseline M5 (strade scure, pattern ripetuto) |
| `M6_SCREENSHOTS/00-prima-M5-centro-mobile.png` | baseline M5 mobile |
| `M6_SCREENSHOTS/01-dopo-tileset-M6-centro-desktop.png` | primo tileset M6, prima della correzione segnaletica |
| `M6_SCREENSHOTS/02-zona-campione-overview-*.png` | vista iniziale dopo tutte le correzioni |
| `M6_SCREENSHOTS/02-zona-campione-strada-*.png` | vista ravvicinata della zona campione |

Statistiche deterministiche (OpenCV, 1280x720):

| Immagine | pixel scuri V<70 | grigio asfalto | luminanza media | densità bordi |
|---|---:|---:|---:|---:|
| prima M5 | 0.52% | 1.89% | 128.6 | 13.28% |
| dopo M6 (campione) | 6.77% | 23.52% | 136.0 | 13.54% |

Il residuo scuro non è asfalto: il 93.7% dei pixel con `V<70` ha colore
`RGB(65,66,63)`, che appartiene al **basolato lavico** dei GID 5/6/65-80,
concentrato sul lato destro dello schermo. Le strade percorribili usano
`RGB(95,94,88)` (`#5F5E58`) con varianti `#6E6C64` e `#4E4E49`; non c'è più
il nero `#0C1823`/`#1B2C33` della milestone 5.

## Difetti trovati e corretti durante il QA

1. **Croci bianche inventate**: 13.617 tile avevano il GID `47` (`intersection`)
   perché la maglia stradale del centro ha vicini su tutti e quattro i lati.
   Ora la segnaletica usa linee tratteggiate, frecce rare e parcheggi. Dopo
   l'ultima rigenerazione i GID `33-48` (`crosswalk`) risultano vuoti: restano
   solo i dettagli `49-64` (linee, frecce, parcheggi) generati da
   `m6_paving.py` con modulo 97 invece del vecchio modulo 9.
2. **NPC accatastati**: 16 pedoni finivano sullo spawn per il fallback
   `walkable()`; ora `freePedestrianTile()` cerca una spirale di tile liberi
   con distanza minima di 12 px. Nel campione: **40 NPC su 40 tile distinti**.
3. **Luoghi fantasma a (0,0)**: 126 POI fuori bbox venivano clampati
   nell'angolo nord-ovest e attiravano pedoni/bar verso un punto inesistente.
   I generatori li scartano: centro **376 → 256 luoghi reali** (226 edifici OSM, 6 fermate bus OSM e marker puntuali verificati), 226 edifici OSM.
4. **Traffico teletrasportato**: `updateTraffic()` riportava i veicoli a
   `spawn +/- 10` tile quando incontravano un ostacolo. Ora `RoadGraph.ts`
   costruisce un grafo da `roads.bin` (asfalto/basolato, non marciapiedi),
   calcola rotte A* e i veicoli avanzano solo se `canStand()` lo consente,
   rispettando raggio e distanza di sicurezza. Nel campione: **8/8 veicoli
   con rotta attiva**, E2E dedicato `m6_traffic.spec.ts` verifica zero salti
   maggiori di 24 px in 250 ms.

## Composizione della vista campione

GID visibili nella finestra 640x360 tile-mondo attorno allo spawn:
pavimento legacy 259, asfalto mascherato 111, basolato mascherato 131,
pavimento mascherato 176, erba 197, attraversamenti/parcheggi 6.
Non ci sono pattern `(x+y)%n` nella scelta dei tile: ogni GID deriva dalla
maschera dei quattro vicini e dalla direzione della geometria OSM.

## Limiti della verifica

- Ollama `qwen2.5vl:3b` è stato usato solo come supporto descrittivo: ha
  segnalato correttamente le croci ripetute, ma ha descritto male il basolato
  come "quadrati beige". Non è usato come certificazione visiva.
- I test verdi non sostituiscono il confronto visivo: le soglie qui sopra
  e gli screenshot restano la referenza per la Fase 3.
- La geometria degli edifici OSM non è stata deformata; il campione mostra
  facciate, portoni, balconi e ombre generate dal dataset reale.
