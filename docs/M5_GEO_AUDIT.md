# M5 — Audit geografico reale (Bacoli, EAV e collegamento futuro Pianura/Napoli)

Data audit: **2026-11-24 (UTC)**.  
File prodotti da questo audit (nessun file sorgente del gioco modificato dall'audit):

- `tools/generated/m5_osm_raw.json` — 5.082.509 byte, chiavi top-level esatte `{"sources": [...], "zones": {...}}`.
- `tools/collect_m5_geo.py` — script di raccolta riproducibile (strumento, non codice di gioco).

Ogni `zones.<zona>` contiene esattamente `name`, `bbox` (`south`, `north`, `west`, `east`), `roads`, `buildings`, `pois`, `water`.  
Gli array usano lo schema di `src/data/bacoli_geo.json`: `id`, `name`, `kind`, `geometry: [{lat, lon}, ...]`; i buildings includono anche `levels`, i POI includono `lat`/`lon`, il water ha `kind` coerente (`lake`, `reservoir`, `riverbank`, `coastline`).

---

## 1. Metodo e fonti HTTP concrete

### 1.1 Overpass: tentativo, timeout, suddivisione per zona e unione

Overpass è stato provato ripetutamente ed è risultato non utilizzabile:

| Endpoint HTTP | Risultato osservato | Dettaglio |
|---|---|---|
| `https://overpass-api.de/api/interpreter` | `HTTP 502` | *“This Overpass API server is currently at capacity. All query workers are busy and the request queue is full.”* |
| `https://overpass.kumi.systems/api/interpreter` | timeout | nessuna risposta entro 60 s |
| `https://overpass.private.coffee/api/interpreter` | timeout | nessuna risposta entro 60 s |
| `https://overpass.nchc.org.tw/api/interpreter` | DNS failure | `getaddrinfo failed` |
| `https://overpass.osm.ch/api/interpreter` | `HTTP 200` ma 0 elementi | mirror con copertura non italiana; scartato |

Come richiesto, è stata allora inviata **una query Overpass piccola per ciascuna zona** (`[out:json][timeout:12]`, una sola bbox alla volta, categorie limitate a highway/building/amenity/historic/railway/natural/leisure/tourism/shop), con l'URL e lo stato di ogni tentativo registrati in `sources[]` del JSON grezzo. Tutti i tentativi per-zona sono andati in timeout o 502; **nessun dato Overpass è stato quindi unito** (conteggi finali = fonte di fallback).

Fallback effettivo (sempre OpenStreetMap, `HTTP 200` per ogni zona):

```
https://api.openstreetmap.org/api/0.6/map?bbox=<west>,<south>,<east>,<north>
```

Le risposte XML sono state parse-node/way/relation e normalizzate nello schema richiesto; i risultati delle due strategie vengono uniti con deduplicazione per id OSM (`merge()` in `tools/collect_m5_geo.py`), quindi l'unione è pronta se Overpass torna disponibile.

### 1.2 Altre fonti usate per la verifica

| Tipo | URL HTTP | Uso |
|---|---|---|
| Nominatim | `https://nominatim.openstreetmap.org/search?q=Lago%20Miseno%2C%20Bacoli%2C%20Napoli%2C%20Italia&format=jsonv2&limit=3` | centro e bbox del lago (way 22909371) |
| Nominatim | `https://nominatim.openstreetmap.org/search?q=Villa%20Comunale%2C%20Bacoli%2C%20Napoli%2C%20Italia&format=jsonv2&limit=3` | parco Villa Comunale (way 240100434) |
| Nominatim | `https://nominatim.openstreetmap.org/search?q=Torregaveta%2C%20Bacoli%2C%20Napoli%2C%20Italia&format=jsonv2&limit=3` | stazione e frazione di Torregaveta |
| Nominatim | `https://nominatim.openstreetmap.org/search?q=Cuma%20railway%20station&format=jsonv2&limit=5` | stazione Cuma (node 1463010430) |
| Nominatim | `https://nominatim.openstreetmap.org/search?q=80126%2C%20Napoli%2C%20Italia&format=jsonv2&limit=3` | baricentro CAP 80126 |
| Wikipedia (API) | `https://it.wikipedia.org/w/api.php?action=query&prop=extracts%7Ccoordinates&explaintext=1&titles=Stazione%20di%20Baia&format=json` | riapertura Baia 6/11/2025 e coordinate |
| Wikipedia | `https://it.wikipedia.org/wiki/Stazione_di_Torregaveta`, `https://it.wikipedia.org/wiki/Ferrovia_Cumana`, `https://it.wikipedia.org/wiki/Ferrovia_Circumflegrea` | stato lines/stazioni, sospensione oltre Licola |
| Wikidata | `https://www.wikidata.org/wiki/Q3971156` | Torregaveta `P625 = 40.811667 N, 14.045556 E` |
| Wikimedia Commons (API) | `https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsnamespace=6&ggsradius=1200&ggscoord=40.8186%7C14.0617&prop=imageinfo%7Ccoordinates&format=json` | foto georeferenziate |
| Comune di Bacoli | `https://comune.bacoli.na.it/documento_pubblico/puc-approvato-in-consiglio-comunale/` | PUC approvato con delibera C.C. n.7 dell'11.04.2024 |
| Comune di Bacoli | `https://comune.bacoli.na.it/?s=geoportale` | ricerca interna: **nessun geoportale comunale autonomo trovato**; `geoportale.comune.bacoli.na.it` risolve in NXDOMAIN. Usata la pagina PUC come fonte urbanistica comunale |
| EAV | `https://www.eavsrl.it/le-nostre-linee/` | direttrici Cumana e Circumflegrea |
| EAV | `https://www.eavsrl.it/orari-linee-ferroviarie/` | orari correnti L9/L5/L7 |
| EAV (PDF) | `https://www.eavsrl.it/download/orario-ferrovia-l9-linea-cumana-montesanto-torregaveta-in-vigore-dal-giorno-11-settembre-2026/?wpdmdl=57763` | Cumana Montesanto–Torregaveta, vigente dall'11.09.2026 (`HTTP 200`, `application/pdf`) |
| EAV (PDF) | `https://www.eavsrl.it/download/orario-circumflegrea/?wpdmdl=12498` | Circumflegrea **Montesanto–Licola** (`HTTP 200`, `application/pdf`) |
| EAV (PDF) | `https://www.eavsrl.it/download/orario-ferrovia-linea-7-soccavo-monte-s-angelo/?wpdmdl=37112` | L7 Soccavo–Monte S. Angelo dal 10.11.2025 |
| EAV (PDF) | `https://www.eavsrl.it/download/orario-autobus-l5-supporto-linee-flegree/?wpdmdl=3364` | bus di supporto alle tratte flegree |
| EAV (archivio) | `https://web.archive.org/web/20240630013515/https://www.eavsrl.it/web/sites/default/files/AVVISO_SOSPENSIONE_SERVIZIO_TRATTA_LICOLA-TORREGAVETA_LINEA_CIRCUMFLEGREA_0.pdf` | avviso ufficiale di sospensione Licola–Torregaveta |

Gli URL effettivamente richiamati (59 voci, con `retrieved_at` e `http_status`) sono elencati in `sources[]` dentro `m5_osm_raw.json`.

---

## 2. Bbox, conteggi e acqua per zona

Le bbox sono **rettangoli di estrazione**, non confini amministrativi. Le zone si sovrappongono: i totali non sono elementi unici.

| Zona | south / north | west / east | roads | buildings | pois | water |
|---|---|---|---:|---:|---:|---:|
| `marina_grande` | 40.7910 / 40.7975 | 14.0750 / 14.0820 | 119 | 223 | 89 | 2 |
| `villa_comunale` | 40.7944 / 40.7969 | 14.0749 / 14.0788 | 56 | 16 | 33 | 1 |
| `lago_miseno` | 40.7901 / 40.7968 | 14.0666 / 14.0784 | 113 | 263 | 62 | 2 |
| `miseno` | 40.7760 / 40.7920 | 14.0780 / 14.0910 | 89 | 331 | 70 | 4 |
| `miliscola` | 40.7830 / 40.7960 | 14.0600 / 14.0730 | 73 | 471 | 55 | 3 |
| `baia` | 40.8100 / 40.8260 | 14.0630 / 14.0790 | 288 | 1205 | 245 | 2 |
| `fusaro` | 40.8130 / 40.8260 | 14.0550 / 14.0680 | 211 | 1126 | 134 | 1 |
| `torregaveta` | 40.8050 / 40.8190 | 14.0380 / 14.0520 | 74 | 662 | 105 | 4 |
| `pianura` (solo documentazione, Fase 5 non costruita) | 40.8520 / 40.8600 | 14.1580 / 14.1660 | 186 | 328 | 56 | **0** |
| `napoli_80126` (solo documentazione) | 40.8360 / 40.8427 | 14.1820 / 14.1880 | 228 | 145 | 72 | **0** |
| **Totale (con sovrapposizioni)** | | | **1437** | **4770** | **921** | **19** |

Dichiarazioni richieste:

- **Nessuna zona ha `buildings` vuoto**: anche la più piccola (`villa_comunale`) contiene 16 edifici OSM. In caso di bbox senza edifici l'array sarebbe comunque presente e vuoto.
- **`water` vuoto**: solo `pianura` e `napoli_80126` (nessun `natural=water` / `waterway=riverbank` / `landuse=reservoir` / `natural=coastline` nelle loro bbox). Tutte le zone di Bacoli hanno acqua: laghi e/o coastline.
- `marina_grande`: **non esce nessun place/feature OSM chiamato “Marina Grande” a Bacoli** (verificato con Nominatim, Photon e ricerca Wikipedia/Commons). La zona è un proxy del waterfront/porto turistico: nodo `Porto Turistico` OSM 1347880357, **40.7921773 N, 14.0792856 E** (`https://www.openstreetmap.org/node/1347880357`). Il nome “Marina Grande” resta nel JSON solo per corrispondenza con la roadmap del gioco; non è un toponimo verificato.

### 2.1 Dettaglio `water` (elementi OSM reali)

| Zona | id OSM | kind | nome | vertici | extent lat / lon |
|---|---:|---|---|---:|---|
| marina_grande, villa_comunale, lago_miseno, miliscola | 22909371 | `lake` | Lago Miseno | 160 | 40.79014–40.79672 / 14.06665–14.07830 |
| fusaro, torregaveta | 12334365 | `lake` | Lago del Fusaro | 446 | 40.81574–40.83044 / 14.04989–14.06053 |
| marina_grande, lago_miseno, baia, miseno, torregaveta | 437456521 | `coastline` | — | 482 | 40.77771–40.82537 / 14.07161–14.09063 |
| miseno | 22909370 | `coastline` | Isola Pennata | 92 | 40.78999–40.79312 / 14.08586–14.09106 |
| miseno | 174090528 | `coastline` | — | 16 | 40.77721–40.77771 / 14.08957–14.08991 |
| miseno, miliscola | 581477231 | `coastline` | — | 84 | 40.77771–40.78887 / 14.06480–14.08949 |
| miliscola | 845188450 | `coastline` | — | 148 | 40.78760–40.79823 / 14.03887–14.06480 |
| baia | 27967461 | `coastline` | — | 456 | 40.81680–40.83153 / 14.07737–14.15887 |
| torregaveta | 27967504 | `coastline` | — | 103 | 40.81102–40.84534 / 14.04319–14.04796 |
| torregaveta | 259797081 | `coastline` | — | 7 | 40.81343–40.81368 / 14.04291–14.04317 |
| torregaveta | 437456513 | `coastline` | — | 62 | 40.79825–40.81113 / 14.03988–14.04455 |

Nota d'uso: le `coastline` sono **linee**, non poligoni: delineano il limite terra/mare (il mare sta dal lato opposto alla terraferma). I laghi sono poligoni chiusi. In particolare **Fusaro** contiene il Lago del Fusaro e **Torregaveta** è attraversata sia dalla coastline sia dal lago/canali antichi: non disegnare automaticamente “mare a est” in quelle zone basandosi solo sulla longitudine.

---

## 3. Coordinate verificate

| Luogo | Coordinate (lat, lon) | Verifica HTTP |
|---|---|---|
| Lago Miseno / Mar Morto | 40.7934298, 14.0730661 (bbox 40.7901379–40.7967200 / 14.0666484–14.0783023); Wikipedia 40.793441, 14.072195 | Nominatim `Lago Miseno, Bacoli…`; `https://it.wikipedia.org/wiki/Lago_Miseno` |
| Villa Comunale (parco) | 40.7957080, 14.0782531 (bbox 40.7944316–40.7969227 / 14.0749543–14.0787544) | Nominatim `Villa Comunale, Bacoli…`; OSM way 240100434 |
| Miseno (village) | 40.7866869, 14.0840923 | Nominatim `Miseno, Bacoli…`, node 4210998162 |
| Capo Miseno | 40.7778808, 14.0894562 | Nominatim `Capo Miseno, Bacoli…`; foto Commons geotaggata 40.787957, 14.090573 |
| Miliscola | 40.7897094, 14.0661126 (Wikipedia 40.789444, 14.065833) | Nominatim `Miliscola, Bacoli…`; `https://it.wikipedia.org/wiki/Miliscola` |
| Baia (frazione) | 40.8188870, 14.0707481 (Wikipedia 40.816667, 14.069722) | Nominatim node 2239104805; `https://it.wikipedia.org/wiki/Baia_(Bacoli)` |
| Fusaro (village / stazione) | 40.8190728, 14.0626018 / 40.8185, 14.0617 | Nominatim; `https://it.wikipedia.org/wiki/Stazione_di_Fusaro` |
| Torregaveta (village / stazione) | 40.8111209, 14.0477032 / 40.811667, 14.045556 | Nominatim; Wikidata Q3971156; OSM node 1462124085 = 40.8114950, 14.0448721 |
| Stazione di Pianura | 40.8561, 14.1624 | `https://it.wikipedia.org/wiki/Stazione_di_Pianura` (la ricerca libera Nominatim restituisce un nodo commerciale non pertinente: **non usato**) |
| CAP 80126 (Napoli) | 40.8485142, 14.1842233 | Nominatim postcode `80126, Napoli, Italia` |
| Monte Sant'Angelo / Linea 7 | 40.8394617, 14.1852499 | Nominatim università; `https://it.wikipedia.org/wiki/Linea_7_(servizio_ferroviario_metropolitano_di_Napoli)` |

---

## 4. Stazioni EAV reali: attive e sospese

Stato alla data dell'audit, verificato sugli orari EAV correnti e sulle voci Wikipedia/Wikidata.

| Stazione | Linea | Stato | Coordinate (lat, lon) | OSM / fonte |
|---|---|---|---|---|
| **Fusaro** | Cumana (L9) | **attiva** | 40.8185, 14.0617 | node 326180913 / 8748727887; `https://it.wikipedia.org/wiki/Stazione_di_Fusaro`; PDF L9 EAV |
| **Baia** | Cumana (L9) | **attiva** (riaperta al pubblico **6 novembre 2025**) | 40.82108283, 14.07147395 | OSM way 1451337563; `https://it.wikipedia.org/wiki/Stazione_di_Baia` |
| **Torregaveta** | Cumana (L9) + Circumflegrea (L5) | stazione **in uso** per la Cumana; **tratta Circumflegrea sospesa** dal 2014 (autobus sostitutivo) | 40.811667, 14.045556 (OSM node 1462124085: 40.8114950, 14.0448721) | Wikidata Q3971156; `https://it.wikipedia.org/wiki/Stazione_di_Torregaveta`; PDF L9 e avviso EAV archiviato |
| **Pianura – Don Giustino Russolillo** | Circumflegrea (L5) | **attiva** (fuori dal perimetro Bacoli) | 40.8561, 14.1624 | `https://it.wikipedia.org/wiki/Stazione_di_Pianura` |
| **Marina di Licola** | Circumflegrea | **senza traffico** (sospesa) | 40.8631384, 14.0480777 | OSM node 329659352; `https://it.wikipedia.org/wiki/Stazione_di_Marina_di_Licola` |
| **Cuma** | Circumflegrea | **senza traffico** (sospesa) | 40.8491369, 14.0488298 | OSM node 1463010430 (Nominatim `Cuma railway station`) |
| **Lido Fusaro** | Circumflegrea | **senza traffico** (sospesa) | 40.8288802, 14.0498377 | OSM node 1463010431 (Nominatim); vedi nota sotto |
| **Ex stazione di Baia** (superficie, chiusa nel 1999) | Cumana, vecchio tracciato | **disused** | 40.8184339, 14.0708900 | OSM way 406222070; `https://it.wikipedia.org/wiki/Stazione_di_Baia` |
| **Miseno** | — | **non esiste alcuna stazione**: Miseno/Capo Miseno si collega via bus | — | Nessun elemento `railway=station` a Miseno in OSM; la diramazione Bacoli–Miseno del 1926/1933 non fu realizzata (`https://it.wikipedia.org/wiki/Ferrovia_Cumana`) |

Note:

- EAV, pagina orari: servizio ferroviario **L5 Circumflegrea = Montesanto–Licola**; **L9 Cumana = Montesanto–Torregaveta**; **L7 Soccavo–Monte S. Angelo** attivo dal 10.11.2025.
- Wikipedia riporta per *Lido Fusaro* le stesse coordinate di *Cuma* (40.849146, 14.049293): **dato duplicato/errato**. Coordinate verificate qui: **Lido Fusaro 40.8288802, 14.0498377** (OSM node 1463010431); **Cuma 40.8491369, 14.0488298** (OSM node 1463010430).
- Le stazioni sospese non vanno trattate come fermate attive nel gioco; il servizio è coperto da autobus EAV (`PDF Orario Autobus – L5 - Supporto linee flegree`).

---

## 5. Collegamento futuro Pianura / Napoli CAP 80126 — solo documentazione, **non costruito**

- La Circumflegrea storica collega già **Pianura** a Quarto/Licola/Torregaveta (`https://www.eavsrl.it/la-storia/sepsa/la-circumflegrea/`), ma il servizio ferroviario ordinario è limitato a **Montesanto–Licola**.
- La **Linea 7 (Infraflegrea)** collega Soccavo al complesso di **Monte Sant'Angelo** Fuorigrotta, nel **CAP 80126**: esercitata a spola dal 10.11.2025 con due fermate; **a regime diventerà bretella tra Circumflegrea e Cumana**. Parco San Paolo previsto 2027, Terracina non prima del 2029, tratta finale ancora in progettazione (`https://it.wikipedia.org/wiki/Linea_7_(servizio_ferroviario_metropolitano_di_Napoli)`, PDF orario L7 EAV).
- Coordinate di riferimento: Pianura 40.8561, 14.1624; Monte Sant'Angelo 40.8394617, 14.1852499; baricentro CAP 80126 40.8485142, 14.1842233.
- Nel JSON grezzo esistono solo le zone di documentazione `pianura` e `napoli_80126` con conteggi OSM reali; **nessuna geometria di collegamento, nessuna stazione nuova, nessuna tratta è stata costruita o aggiunta al codice del gioco**. La roadmap (`docs/ROADMAP.md`, Fase 5 e 6) resta invariata.

---

## 6. Fotografie note (Wikimedia Commons, georeferenziate quando disponibile)

| Zona | File | Coordinate / fonte |
|---|---|---|
| Miseno / faro | `File:Napoli 3589.jpg`, `File:Napoli 3586.jpg` | 40.787957, 14.090573 — `https://commons.wikimedia.org/wiki/File:Napoli_3589.jpg` |
| Miseno / Mare Morto | `File:Brogi, Giacomo (1822-1881) - n. 5714 - Miseno … Mare Morto, Monte Procida e Spiaggia di Minuscola.jpg` | 40.786853, 14.088200 |
| Fusaro / Casina Vanvitelliana | `File:Casina Vanvitelliana (20141208 15 59 56).jpg`, `File:Bacoli Casina Vanvitelliana Lago del Fusaro Bacoli.jpg` | 40.819432, 14.059478 / 40.818036, 14.059636 |
| Torregaveta / stazione | `File:10.11.02 Torregaveta SEPSA ET107.jpg` | 40.811702, 14.045301 |
| Baia / veduta dal castello | `File:Baia Sight from Castello Aragonese.jpg` | `https://it.wikipedia.org/wiki/Baia_(Bacoli)` → `https://commons.wikimedia.org/wiki/Category:Baiae` (nessuna foto geotaggata entro 1200 m nel geosearch) |
| Bacoli / panorama | `File:80070 Bacoli, Metropolitan City of Naples, Italy - panoramio.jpg` | 40.787560, 14.077091 |
| PUC comunale | pagina della delibera PUC | `https://comune.bacoli.na.it/documento_pubblico/puc-approvato-in-consiglio-comunale/` |

Le URL dei file e le coordinate usate sono state ottenute via:

```
https://commons.wikimedia.org/w/api.php?action=query&generator=geosearch&ggsprimary=all&ggsnamespace=6&ggsradius=1200&ggscoord=<lat>|<lon>&prop=coordinates|imageinfo&iiprop=url&format=json
```

---

## 7. Limiti noti

- I conteggi sono **per bbox** e sovrapposti; non vanno sommati come inventario unico del comune.
- La bbox `villa_comunale` è volutamente ristretta al parco OSM: include solo 16 edifici, ma la `water` eredita il lago Miseno perché il poligono lambisce il bordo sud-ovest.
- Le `coastline` attraverso `baia` e `torregaveta` hanno estensione molto più ampia della bbox: la geometria completa è stata conservata (`geometry` con tutti i vertici), così il confine terra/mare resta corretto anche ai bordi.
- `water` non include `waterway=canal`/`dock` (richiesti solo riverbank/reservoir/lake/coastline); i canali minori restano nella categoria POI solo se provvisti di nome/tag rilevanti.
- Fonti EAV/Comune sono state lette come HTTP 200 al momento dell'audit; gli orari possono cambiare: le PDF con data di vigore sono allegate come URL concreti in `sources[]`.
