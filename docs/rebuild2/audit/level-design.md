# Audit level design — rebuild 2.0

Branch: `rebuild-2.0`. Ambito: solo lettura di codice/dati/screenshot già prodotti; nessuna modifica a sorgenti, config o asset.

## Metodo e evidenze

- Ho letto `src/scenes/WorldScene.ts`, `src/scenes/InteriorScene.ts`, `src/core/types.ts`, `src/systems/RoadGraph.ts`, `src/systems/CollisionSystem.ts`, `src/systems/DebugOverlay.ts`, `src/data/bacoli_world.json`, i generatori `tools/build_map_regions.py`, `tools/m6_tiles.py`, `tools/generate_assets_scale.py`, i validatori e i test `tests/e2e/m6_urban.spec.ts`, `m6_sample.spec.ts`, `m6_interiors.spec.ts`.
- Ho riprodotto in Python, con gli stessi buffer `public/assets/maps/centro/{roads,ground,collision}.bin`, l'ordine esatto di `create()` (`WorldScene.ts:287-303`): il modello ottiene **61 arredi, 40 lampioni, 6 fermate**, identico a `docs/M6_SCREENSHOTS/m6-sample-chromium-desktop.json:12-14`. Le statistiche sotto sono quindi verificabili, non stime visive.
- Per gli screenshot ho usato le descrizioni già presenti in `docs/rebuild2/audit/screenshot_user_ollama.md` e `uploaded_images_ollama.md`, oltre alle misure deterministiche in `docs/M6_SAMPLE_QA.md` e `M6_FINAL_QA.md`.

## 1) Verdetto

**Level design non approvato per la versione giocabile.** Il mondo è costruito su geometrie OSM reali e la scena parte senza errori, ma la "regolazione" dell'arredo è in gran parte dichiarativa: tre difetti strutturali (superficie `0` ammessa, classe `2` usata sia per pedoni sia per veicoli, solido dell'arredo sfalsato di 8 px verso l'alto) producono esattamente i sintomi segnalati: ombrelloni/tavolini su strada o su aree non pedonali, panchine che riducono la carreggiata, portoni e POI fuori dalla zona giocabile. I test verdi non li vedono perché controllano solo la distanza fra arredi già posizionati.

Punti da salvare: impalcato OSM, buffer di collisione, template degli interni data-driven, fermate bus reali. Punti da riscrivere: motore di posizionamento, modello degli ingressi, marker puntuali, validazione.

## 2) Difetti strutturali

### D1 — Il filtro superficiale ammette "fuori strada" e la classe pedonale sbagliata

`WorldScene.ts:716-721` dichiara «solo marciapiede/basolato», ma `WorldScene.ts:726` scrive:

```ts
if (requireSurface && surface !== 2 && surface !== 3 && surface !== 0) return false;
```

La classe `0` è `fuori strada` per `RoadGraph.ts:54-57,67-71`; il controllo la accetta. Inoltre la classe `2` (basolato) è **guidabile** per `RoadGraph.ts:73-78` (`road === 1 || road === 2`), quindi è usata contemporaneamente come superficie d'arredo e come carreggiata.

Evidenze nel centro (simulazione esatta):

- 6/61 arredi su superficie `0`: 1 fermata bus `(79,705)`, 2 fioriere, 1 cestino, 2 palme. Esempio nella zona campione: palma a `(328,479)` su erba GID `1`.
- 4/61 arredi su superficie `2` guidabile: panchina `(157,612)`, 2 tavolini da bar, 1 fioriera. La panchina a `(157,612)` blocca i tile guidabili `(156,612)` e `(157,611)`.
- 10/61 arredi non hanno alcun tile guidabile vicino: sono quindi in prati/zone vuote, non «vicino a un luogo o a una strada» come promesso nel commento.

### D2 — Ingombro reale incompatibile con veicoli e pedoni

`WorldScene.ts:745` registra il solido con centro `y - 8` (8 px sopra il piede dello sprite), mentre veicoli e pedoni usano il centro del tile `tx*16+8, ty*16+16` (`WorldScene.ts:881-883`, `1311-1312`, `939-940`). `CollisionSystem.ts:80-96` confronta le distanze tra questi centri; `RoadGraph.ts:60-78,96-150` costruisce le rotte A* usando **solo** i tile solidi statici, non i solidi circolari degli arredi. Lungo la rotta, `WorldScene.ts:1321-1325` rileva l'ostacolo solo come stallo e ripianifica dopo 45 frame.

Risultato: **47 tile guidabili adiacenti risultano inibiti per un'auto (raggio 10)**: 36 da lampioni, 8 da tavolini, 3 da panchine. 39 di questi sono il tile appena sopra l'arredo: distanza 8 px contro soglia `3+10=13` per un lampione. Non è un dettaglio estetico: la panchina `(157,612)` ha raggio 12 e dista 8 px dal centro del tile `(157,611)` (soglia 22).

Non esiste inoltre una regola di "corridoio pedonale": `placeUrbanProp` verifica solo `canStand()` sul punto dell'oggetto (`WorldScene.ts:730`) e la distanza fra oggetti (`731-733`), non la larghezza libera del marciapiede.

### D3 — L'ingresso dei luoghi è un tile stradale, non una soglia

`tools/build_map_regions.py:220-229,436` sceglie come `place.x,place.y` il tile **stradale** più vicino all'impronta (`entrance_tile` → `roads`), e `WorldScene.ts:1345-1354` usa proprio quel punto come ancoraggio d'interazione (raggio 96 px). Nel centro:

- 167/226 ingressi di edifici sono su asfalto (classe `1`), 31 su marciapiede, 17 su basolato, 11 fuori strada;
- 42/226 sono su tile solidi e **56/226 cadono dentro la propria impronta**: il "portone" viene disegnato sopra l'edificio;
- 11/226 non hanno alcun tile pedonale entro 96 px (es. 10 case tutte agganciate a `(366,190)` su acqua).

`WorldScene.ts:735-736` protegge solo i luoghi con `bounds` entro 12 px: i marker puntuali non sono considerati. Di conseguenza i cartelli bus vengono aggiunti esattamente sopra il marker `street_sign` già disegnato da `addMarker()` (5 casi su 6 a distanza 0 px).

### D4 — I POI puntuali sono segnaposto e finiscono ai bordi della mappa

`WorldScene.ts:673-684` trasforma tipologie semantiche in icone generiche: `restaurant → umbrella`, `cafe/bar/gelateria → cafe_table`, `parking → parking_sign`, `pescheria → boat`, `fuel → car_white`, tutto il resto → `street_sign` (anche `bus_stop`). `addMarker()` (`686-690`) non fa controlli di superficie, collisione o accessibilità.

Nel centro:

- 30 marker; 13 su asfalto, 8 su tile solidi, **6 su acqua** (GID 9-12);
- 3 ristoranti su asfalto (`Da Fefè` `(151,721)`, `Osteria Il Garum` `(114,721)`, `Una fetta di Napoli` `(109,721)`) e 2 sull'acqua (`La Catagna`, `Bolliera`): sono gli "ombrelloni in mezzo alla strada";
- 2 bar e 1 gelateria sono su asfalto;
- 5 marker sono esattamente nell'angolo sud-est `(462,721)`, 7 non hanno alcun tile pedonale entro il raggio d'interazione di 96 px.

La causa è nel generatore: `tools/build_map_regions.py:288-291` clampa `to_tile()` a `width-1 / height-1`, mentre `add_place()` (`232-238`) scarta solo `x<2` o `y<2`. Il fix documentato in `docs/M6_SCREENSHOTS/M6_SAMPLE_QA.md:40-42` ("luoghi fantasma ... i generatori li scartano") è quindi solo metà: l'altro clamp è ancora attivo. Su tutte le regioni: **87/340 marker sui bordi, 20 agli angoli**. `tools/validate_geography.py:82-92` controlla solo che le coordinate siano intere e dentro la mappa: un marker sull'ultima riga passa il validator.

### D5 — La distribuzione è per indice, non per spazio

`WorldScene.ts:769-821` usa liste tipologiche corrette ma poi applica `slice(0,26)`, `index % 2`, `index % 3`, `index % 4` e offset fissi `(+1,+1)`, `(-1,+1)`, `(+2,+2)`. Non c'è area, fronte strada, orientamento del portone, capienza per metro o distanza dal bordo carreggiata. Nel centro: 17 luoghi "caffè/ristorante" → 5 tavolini; 3 aree verdi → 2 palme; 5 servizi → 1 cestino. La sequenza dipende dall'ordine di OSM nel JSON, non dalla posizione.

Lo stesso pattern ricorre in `WorldScene.ts:931-958` (NPC ancorati a `places[(i*17+5) % length]`) e `WorldScene.ts:627-645` (variante facciata per hash quando manca il dato). Sono deterministici, non casuali per frame — ma sono **indici**, non regole di level design.

### D6 — La segnaletica automatica non esiste di fatto

Il ciclo `WorldScene.ts:803-813` richiede `cross >= 3` tile guidabili attorno a un marciapiede. Nel centro ci sono 210 tile `surface === 3` sui passi di griglia, ma il massimo `cross` osservato è 2: **0 segnali stradali o di parcheggio generati**. Le uniche insegne visibili derivano dai marker (`parking_sign`, `street_sign`).

### D7 — Decorazioni evento fuori dal sistema di collisione

`WorldScene.ts:1617-1632` dispone ombrelloni/bandiere/lampi aggiungendo `+14` o `+24` px alle prime 6 lampioni e verificando solo `walkable()` sul tile di destinazione. Non passano da `placeUrbanProp`: niente raggio, niente distanza da arredi/ingressi, niente coerenza con la superficie. Nei giorni di evento possono comparire ombrelloni dentro la corsia.

### D8 — Interni: template riconoscibili ma non legati al singolo luogo

`InteriorScene.ts:48-74` deriva il template da regex su nome/kind/source; `280-450` usa **coordinate fisse** in una stanza fissa 24x16 m; `218-232` assegna il personale con una mappa statica (`bar: npc_2`, `pizzeria: npc_4`, ecc.), non dal luogo OSM o dall'attività posseduta; `addFurniture()` (`234-247`) non verifica sovrapposizioni fra arredi, ma solo `canStand()` del giocatore (`249-253`).

Positivo: `create()` eredita `placeId`, regione, piani e larghezza (`121-141`) e azzera arredi/personale tra visite (`109-114`); `tests/e2e/m6_interiors.spec.ts:18-114` copre 7 template reali. Negativo: `pizzeria` non è un `PlaceKind` (`src/core/types.ts:3-7`): esiste solo come regex (`InteriorScene.ts:61`) e **nessun luogo del centro** ha "pizza" nel nome; la pizzeria visitabile è raggiungibile solo in baia/fusaro/torregaveta. I bar del centro sono marker senza edificio: `WorldScene.ts:2193-2233` offre comunque «Entra nel locale», quindi si entra in un locale invisibile.

### D9 — Coerenza con le foto non dimostrabile per edificio

`tools/generate_assets_scale.py:343-380` genera le facciate da `(larghezza, piani, variante)` con seed e scrive sempre la scritta `BAR` in pixel per la variante 3. `docs/PHOTO_REFERENCE_MAPPING.md:9-19` documenta correzioni di palette/materiali globali, non un abbinamento foto → singolo place. Nel centro 219/226 edifici si chiamano `Casa N` e 149 coppie di impronte si sovrappongono; `WorldScene.ts:692-713` disegna una facciata per bbox senza risolvere le sovrapposizioni. L'effetto "oggetti messi a caso / placeholder" nasce anche da qui.

### D10 — I test non possono intercettare questi difetti

`tests/e2e/m6_urban.spec.ts:21-27` controlla solo che le distanze fra `urbanSpots` siano ≥ `r1+r2+7.9`. Il debug hook espone solo `{x,y,radius}` (`WorldScene.ts:364-365`): non c'è tipo, superficie, distanza dalla corsia, né stato degli ingressi. Il test è quindi coerente con il codice che lo alimenta e passa anche con arredi su erba/acqua/basolato. `m6_sample.spec.ts:7-60` chiama "zona campione" l'intera regione 463×722 con un teleport, senza asserzioni per edificio. `docs/M6_FINAL_QA.md:27-28` descrive l'arredo come «solo su superfici pedonali/OSM»: non corrisponde ai dati.

Nota sugli screenshot: `docs/rebuild2/audit/screenshot_user_ollama.md:5-15` descrive una scena **interna** senza quadrati colorati; `docs/M6_SAMPLE_QA.md:23-27` spiega che i quadrati beige visti dal modello visione sono basolato lavico (`RGB(65,66,63)`), non un placeholder. Il "quadrato colorato" segnalato dall'utente è più plausibilmente il debugger `DebugOverlay.ts:73-97` (griglia blu + quadrati rossi sui solidi), che però è nascosto di default (`46-47`) e si attiva solo con `G` (`WorldScene.ts:317-320`). I veri placeholder visibili in modalità giocabile sono i marker dell'D4.

## 3) Tipologia oggetto / regola attuale / regola corretta

| Tipologia | Regola attuale (file:line) | Regola corretta |
|---|---|---|
| Facciate edifici | Una facciata per `bounds`, variante per regex/hash; 149 bbox sovrapposti (`WorldScene.ts:627-714`) | Un solo inviluppo per edificio, variante da `kind`/nome OSM; niente duplicati visibili; nome/indirizzo reali |
| Portone / ingresso | Tile stradale più vicino, spesso dentro l'impronta (`build_map_regions.py:220-229`; `WorldScene.ts:1345-1354`) | `entrance` su marciapiede adiacente al perimetro; 1,5 m di sagrato libero; interazione ancorata alla soglia, non alla strada |
| POI senza edificio (bar, ristorante, parcheggio) | Icona generica (`umbrella`, `cafe_table`, `car_white`) su coordinate clampate, senza collisione (`WorldScene.ts:673-690`) | Eliminare marker dal build giocabile: o allegare il POI a un edificio reale con `confidence`, o scartarlo se fuori bbox |
| Ombrelloni / tavolini | Offset fisso `(+1,+1)` dal POI, raggio 10, ammessi su classi `0/2/3` (`WorldScene.ts:726,779`) | Solo su marciapiede o piazza pedonale, sul fronte del locale, con 1,5 m di corridoio libero e distanza ≥ 6 m da un altro tavolo |
| Panchine | `index % 3`, offset `(+2,+2)`, raggio 12 (`WorldScene.ts:781,786`) | Solo in aree verdi/piazzette, mai su classe `2` guidabile; centrata sul tile, non 8 px sopra; distanza ≥ 2 m dal bordo corsia |
| Fioriere / cestini | `index % 2`/`% 4`, offset fissi (`WorldScene.ts:780,789-790`) | Accanto alla soglia o alla panchina servita, su marciapiede; max 1 ogni 8 m di fronte; mai su erba isolata |
| Palme / oliveti | `index % 2`, offset `(±2,+1)`, raggio 5 (`WorldScene.ts:783-786`) | Solo dove la superficie è sabbia/prato **e** l'area è `beach`/`park`; non davanti a portoni o su marciapiede stretto |
| Lampioni | Griglia 9×9 tile, solo classe `3`, raggio 3, centro `y-8` (`WorldScene.ts:794-801,745`) | Passo derivato dalla geometria stradale, centro nel tile, raggio 2-3; verificare che il tile guidabile adiacente resti percorribile |
| Segnaletica | Griglia 17×17 con `cross >= 3`; 0 istanze nel centro (`WorldScene.ts:803-813`) | Solo agli incroci OSM reali con `cross >= 3` **e** superficie pedonale; altrimenti non disegnare nulla |
| Fermate bus | `placeUrbanNear(..., radius 4)` più marker `street_sign` sovrapposto (`WorldScene.ts:761-767,674-690`) | Un solo cartello, sul marciapiede, distinto dal marker; palina a ≥ 1 m dal bordo corsia e lontana da portoni |
| Traffico | A* su tile `1/2`, ignora solidi circolari (`RoadGraph.ts:73-78,96-150`) | Inserire gli arredi nella matrice di percorribilità o marcare i tile inibiti; ricalcolo se un prop compare su una rotta attiva |
| Decorazioni evento | Primi 6 lampioni + offset 14/24 px (`WorldScene.ts:1617-1632`) | Stesso `placeUrbanProp` con tipologia evento, o nessuna decorazione se non c'è spazio |
| Arredi interni / staff | Coordinate fisse e sprite staff statico (`InteriorScene.ts:218-247,280-450`) | Layout per template **e** per luogo, controllo sovrapposizioni e percorso porta→cassa→tavolo; staff legato all'attività reale |
| NPC | `places[(i*17+5) % length]` (`WorldScene.ts:935`) | Ancorati alla funzione del luogo (bar, piazza, stazione) con orario e percorso coerente |

## 4) Progetto per la piccola zona campione, edificio per edificio

**Perimetro proposto**: Piazzetta / Via Spiaggia, riquadro `x = 300…335`, `y = 455…510` (36×56 tile = 576×896 px ≈ 0,06 km²), centrato sullo spawn `(324,478)`. È già la zona usata da `m6_sample.spec.ts:44`, ma va trattata come **sotto-insieme**, non come intera regione. Impianto viario rilevato: corsia asfalto `x ≈ 320…324`, marciapiedi `x ≈ 318…319` e `x ≈ 325…326`; lato est basolato da `x ≈ 334`.

| Elemento (dato reale) | Stato attuale | Intervento concreto |
|---|---|---|
| `place-251` — Piazzetta sul mare, marker `(324,478)`, asfalto GID 32 | Segnaposto `palm` su asfalto; nessuna piazza pedonale | Rimpiazzare con pavimentazione pedonale o rimuovere del tutto il marker; se resta, spostare l'ancoraggio al marciapiede `(326,478)` e vietare veicoli in quel tratto |
| `place-253` — Gelateria Piazzetta, marker `(324,478)`, asfalto | `cafe_table` simulato a `(326,479)` e panchina a `(326,481)`, separati da soli 2 tile; palma a `(328,479)` su erba | Un solo tavolino su `(326,479)`, rimuovere la panchina; palma solo se si crea un'aiuola dichiarata, non su erba casuale; collegare il locale a un edificio reale o rimuovere il marker |
| `place-186` — Casa 186, bbox `[325,490,341,498]`, 3 piani, ingresso `(324,489)` su asfalto | Portone nella corsia; facciata larga 272 px | Portone su `(325,488)` o `(326,488)` (marciapiede verificato); riservare 2×2 tile senza arredi; interno `home` con letto/divano/cucina come da `InteriorScene.ts:281-303` |
| `place-195` — Casa 195, bbox `[307,483,317,491]`, 3 piani, ingresso `(317,490)` su asfalto | Portone su asfalto, lato opposto rispetto alla facciata | Portone su `(318,488)` o `(319,485)`; nessuna fioriera in quei tile; interno `home`, arredi acquistati visibili |
| `place-238` — Ristorante Garibaldi, marker `(309,473)` su marciapiede, senza edificio | Ombrello-segnaposto; interno apribile senza facciata | Associare all'edificio `place-156` o rimuovere; se associato, tavolo sul marciapiede `x=318…319`, non sul marker; interno coerente con la tipologia ristorante |
| `place-156` — "Living", bbox `[290,438,307,463]`, 2 piani, `variant 3`, ingresso `(303,460)` su asfalto | `variant 3` forzato dalla tipologia `restaurant` (`build_map_regions.py:434-435`) dipinge un'insegna `BAR` (`generate_assets_scale.py:365-379`) su un edificio che non è un bar | Variante da nome/tag reali: se è negozio, template `shop` e niente tenda BAR; portone su `(305,465)` o `(288,464)`; interno coerente con la nuova tipologia |
| `place-36` — Casa 36, bbox `[281,490,308,506]`, 2 piani, ingresso `(310,503)` su asfalto | Portone in corsia, bbox più larga della facciata visibile | Portone su `(309,503)` (marciapiede); controllo anti-sovrapposizione con `place-127` prima di disegnare la facciata |
| `place-127` — Casa 127, bbox `[291,510,307,525]`, 2 piani, ingresso `(310,510)` su asfalto | Portone in corsia, bbox vicina a `place-36` | Portone su `(309,510)`; distanza minima 4 tile fra porte; nessun arredo in `(308…309,508…514)` |
| Arredo della zona | 3 oggetti in 4 tile: tavolo `(326,479)`, panchina `(326,481)`, palma `(328,479)` su erba | Tavolo resta, panchina rimossa, palma sostituita da fioriera solo se c'è un'aiuola dichiarata; un lampione solo su tile con corsia adiacente verificata dopo il fix del centro del solido |
| Traffico della zona | Corsia `x ≈ 320…324` attraversabile; i solidi non sono nel grafo | Nessun solido di arredo nella corsia; `RoadGraph` deve vedere i prop o i tile inibiti; test con auto raggio 10 sulla sequenza di tile `(324,470)→(324,490)` |

**Criteri di accettazione della zona campione** (da trasformare in test): (a) ogni ingresso su superficie `3`/`2` pedonale e non solido; (b) zero arredi su classi `0`/`1` e zero su classe `2` se guidabile; (c) distanza minima 1,5 m tra corridoio pedonale e bordo corsia; (d) zero marker puntuali senza edificio; (e) ogni locale dichiarato visitabile abbia facciata, porta, interno e staff coerenti; (f) auto e pedone possano percorrere la zona senza stalli artificiali.

## 5) Cosa recuperare vs riscrivere

### Recuperare (con piccole correzioni)
- Geometrie OSM, impronte, `collision.bin` e classi stradali da `tools/build_map_regions.py:382-490` e `tools/m6_paving.py`: la base metrica è corretta e validata da `tools/validate_geography.py`.
- `RoadGraph` A*, `CollisionSystem.canStand()`, i buffer `roads/collision`: da tenere, ma da alimentare con i solidi degli arredi.
- Fermate bus da `highway=bus_stop` e la logica di ancoraggio `spawnBusStops()` (`WorldScene.ts:761-767`): eliminare solo il doppio cartello.
- Le tre liste tipologiche `cafes/green/services` (`WorldScene.ts:771-776`) come **dichiarazione d'intento**: la scelta delle categorie è sensata, è la distribuzione a essere sbagliata.
- `InteriorScene.templateFor()` e l'eredità `placeId/floors/facadeWidth` (`InteriorScene.ts:53-74,121-141`), con i 7 casi coperti da `m6_interiors.spec.ts`.
- Tavolozze e materiali derivati dalle foto (`docs/PHOTO_REFERENCE_MAPPING.md:9-19`) come art direction globale, non come prova di abbinamento per edificio.
- `DebugOverlay` come strumento diagnostico: resti disattivato nel build giocabile.
- Screenshot e statistiche deterministiche esistenti come baseline di confronto, non come certificazione del level design.

### Riscrivere
- **Motore di posizionamento**: sostituire offset/modulo con una specifica dichiarativa per luogo (`frontage`, `surface ammessa`, `corridoio minimo`, `capienza`, `esclusioni`), applicata prima degli NPC/veicoli e validata a ogni spawn.
- **Modello dell'ingresso**: aggiungere un campo `entrance` calcolato sul marciapiede adiacente al perimetro; usarlo per interazione, arredi e consegne (`WorldScene.ts:1588-1592` usa ancora il vecchio punto).
- **Geometria dei solidi**: centro del cerchio al centro del tile o compensazione esplicita dell'8 px; raggi ricalibrati su pedone (5) e auto (10/22); `RoadGraph` deve considerare i prop nei tile non percorribili.
- **Marker puntuali**: eliminare i segnaposto dal build giocabile; correggere `to_tile()` in `build_map_regions.py:288-291` scartando anche i clamp superiori; aggiornare `validate_geography.py` per controllare accessibilità e superficie, non solo appartenenza alla mappa.
- **Facciate e nomi**: de-duplicare le impronte sovrapposte, recuperare nomi/tag OSM disponibili in `tools/generated/m5_osm_raw.json` e `src/data/bacoli_places.json` invece di `Casa N`, rimuovere la scritta `BAR` universale dalla variante 3.
- **Interni**: introdurre `pizzeria` nei `PlaceKind`, layout per singola attività con controllo sovrapposizioni e percorso dalla porta, staff derivato da `business`/luogo e non da mappa statica.
- **Test**: estendere `m6_urban.spec.ts` per assertare superficie, distanza dalla corsia, distanza dai marker e accessibilità degli ingressi; sostituire la "zona campione" di `m6_sample.spec.ts` con il riquadro `300…335 × 455…510` e asserzioni edificio per edificio. Fino ad allora i test verdi attestano solo che il gioco si avvia, non che il livello sia ben progettato.
