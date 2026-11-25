# Zona campione REBUILD 2.0 — dati metrici reali

Sorgente: `osm_baia_sample.osm` (OSM API 0.6, bbox 14.0775,40.7995–14.083,40.8062).
CRS: `EPSG:32633` (UTM 33N, unità = metro). Conversione: PyProj.

| Elemento | Conteggio |
|---|---:|
| Edifici OSM (poligoni validi) | 353 |
| Strade OSM (LineString) | 63 |
| Luoghi/POI OSM | 33 |
| Aree naturali/landuse OSM | 2 |
| Nodi grafo OSMnx | 4100 |
| Archi grafo OSMnx | 8534 |
| Componenti deboli del grafo | 353 |

Provenienza piani: area_heuristic_v1=352, tag building:levels=1.
Provenienza larghezze stradali: class default=60, tag lanes=3.

Estensione: 432.0 m x 773.9 m.
Griglia di gioco ipotizzata: 6912 x 12383 px a 16 px/m.

## Scala e proiezione

- 1 metro = 16 px a terra.
- Persona 1,75 m = 28 px; porta 2,10 m = 34 px; automobile 4 m = 64 px; autobus 11 m = 176 px.
- Altezza visiva di un piano 3 m = 52 px (include sporto e cornicione); la proiezione 3/4 è codificata una sola volta.

## Approssimazioni documentate

- I livelli mancanti sono stimati dalla regola dichiarata `area_heuristic_v1`: >700 m² o (>400 m² e larghezza>34 m) -> 1; >180 m² o larghezza>34 m -> 2; >80 m² -> 3; altrimenti 2. Ogni edificio riporta `levels_source`.
- Le larghezze stradali derivano da tag OSM `width`/`lanes`; in assenza sono usati valori tipici per classe.
- Le facciate saranno ricostruite dalle fotografie fornite, non dal solo tag `building`.
- Il grafo OSMnx è proiettato in UTM; le corsie saranno derivate da larghezza e senso di marcia.

## Verifica

I file `.geojson` prodotti sono la sorgente verificabile della mappa di gioco. La sovrapposizione
cartografica è generata da questi stessi poligoni e linee in `tools/rebuild2_build_overlay.py`:
`docs/rebuild2/data/osm_reference.png` e `docs/rebuild2/audit/overlay.png` usano la stessa origine
UTM e la stessa scala 16 px/m del runtime. Soglie e risultati sono in
`docs/rebuild2/audit/overlay_metrics.json`.

Il focus giocabile usa POI OSM reali: spawn su Via Antonio De Curtis (osm_id `240100391`),
`Cafè Centrale`, `Il Portico` come pizzeria e l'edificio residenziale OSM più vicino come casa.
Le porte sono il punto della sagoma OSM più vicino alla strada OSM più vicina: approssimazione
dichiarata anche in `public/rebuild2/maps/sample/focus.json`.
