# Corrispondenza fotografie → asset e architettura

Le nove fotografie fornite sono conservate in `docs/source_assets/photos/` e
sono state analizzate con Ollama `qwen2.5vl:3b` in
`docs/NEW_ASSETS_ANALYSIS.json`. Non sono mappe: sono riferimenti architettonici.
Le tavole pixel art restano la base artistica, ma i tratti sotto elencati sono
stati usati per correggere facciate, materiali e arredi.

| Foto | Contenuto osservato | Correzione applicata |
| --- | --- | --- |
| `40676379.png` | Piazza alberata con palazzi a due piani, balconi fioriti, monumento e negozi | Facciate a 2–3 piani con balconi e fioriere; `palm`, `bench`, `street_sign` e `flowerpot` come arredo della piazza |
| `9d05bb7d.png` | Lungomare in pavé, muro di pietra, barche ormeggiate, lampade | `road_stone_*`, `stone_wall_*`, `lamp` e `boat` con palette della costa flegrea |
| `466c893d.png` | Via stretta del centro, case a due piani, negozi con tende e balconi | Variante facciata `3` per bar/caffè/ristoranti, tende e portali stretti; marciapiedi di 1 m nella mappa metrica |
| `e8fd5a7b.png` | Porto con molte barche, scoglio, costa collinare | `boat`, `rock`, texture acqua `#185F76`/`#3A9FF3` e profondità delle imbarcazioni |
| `490db4f3.png` | Vista panoramica con case basse, verde, mare e imbarcazioni | Tetti bassi in terracotta, `olive_tree`, `palm`, riduzione a 1–2 piani dei lotti pubblici estesi |
| `f68ddcf1.png` | Spiaggia affollata, ombrelloni, scogli, auto parcheggiate | `umbrella`, `sand_texture`, `rock`, `car_*` e `parking` coerenti con la stagione balneare |
| `eb64f81b.png` | Castello fortificato su promontorio circondato dal mare | `stone_wall_*`, `arch_flowers_*` e marker `archaeological_site` con murature spesse e toni sabbia/terracotta |
| `be7ac07e.png` | Edificio di culto con cupola rossa vicino a specchio d'acqua | `church`, tetti rossi e facciata a 2–3 piani per `place_of_worship` |
| `698ca65f.png` | Treno EAV rosso/bianco in stazione coperta, tetto metallico e marciapiede | `Stations/station_eav.png`, `platform.png` e `rail.png`; livrea rossa/bianca ripresa anche da `train.png` |

## Fonti cartografiche

- OSM/Overpass: geometrie effettive di edifici, strade e POI → impronte e collisioni.
- Stradario del Comune di Bacoli (geoportale): nomi delle strade e verifica di Via Ortensio/Via Spiaggia.
- Google Maps e fotogrammi della Regione Campania: controllo incrociato del contesto costiero.
- Wikimedia Commons e galleria comunale: controllo dei materiali e delle volumetrie.

Nessun edificio, negozio o strada è stato posizionato a caso: ogni `place` con
`bounds` deriva da un poligono OSM e ogni segnalazione puntuale dichiara
`source`. `tools/validate_geography.py` verifica la corrispondenza 1:1 delle
impronte e `docs/PROGRESS.md` registra i risultati.
