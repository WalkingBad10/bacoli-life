# M4 — Riferimento visivo per le facciate (BACOLI LIFE)

Metodo: servizio Ollama locale raggiungibile su `http://127.0.0.1:11434/api/generate`, modello `qwen2.5vl:3b` (verificato con `/api/tags`). Le 6 immagini sono state analizzate il 24/11/2026 con prompt mirato alle categorie richieste; per la foto 2 è stata usata anche una copia ingrandita 3× **in memoria**, senza scrivere file. Le risposte del modello sono state confrontate con `docs/AI_VISION_ANALYSIS.md` e `docs/VISUAL_ANALYSIS.md`. Dove il modello non ha visto un elemento, il report dice “non visibile”: non sono state aggiunte informazioni non osservate.

## 1. Fotografie disponibili

Unica cartella di upload temporanea presente: `C:\Users\rocka\AppData\Local\Temp\opencode\uploads` (6 sottocartelle, tutte con `image.png`). Nessun’altra cartella di upload opencode trovata sotto `%TEMP%`.

| # | ID cartella | File | Dimensioni lette | Byte |
| --- | --- | --- | --- | --- |
| 1 | `0b6d0607-9e6d-4420-af84-5bbe483b3752` | `image.png` | 512×288 | 329.567 |
| 2 | `2372f3d0-d072-4d71-8afb-8719f9798258` | `image.png` | 335×597 | 306.241 |
| 3 | `3c19d026-17e4-4d29-87e3-26a0b3960a71` | `image.png` | 387×516 | 362.415 |
| 4 | `49a312c5-9a16-45d5-81ce-8a210fd72446` | `image.png` | 1176×860 | 1.425.799 |
| 5 | `56b7d60b-0e83-43db-86a2-72d6e86fd930` | `image.png` | 1280×720 | 2.071.715 |
| 6 | `89fe7e35-1589-47ea-ab76-53e4491e781d` | `image.png` | 1400×788 | 1.672.216 |

Nota: `VISUAL_ANALYSIS.md` riporta 1200×675 per la foto 5 e 1200×675 per la foto 6; le dimensioni qui sopra sono quelle lette direttamente dai file.

### Foto 1 — panorama di Bacoli e porto

- **Soggetto**: Bacoli vista dall’alto; l’analisi esistente indica porto e sagoma del Vesuvio sullo sfondo. Ollama conferma mare, porto e barche.
- **Facciate**: case di altezze diverse, tetti colorati, intonaco e mattoni.
- **Balconi**: ringhiere in metallo segnalate nell’analisi esistente; nella nuova analisi non distinte singolarmente.
- **Insegne**: non visibili.
- **Panni stesi**: non visibili.
- **Tavolini**: non visibili.
- **Mare/spiaggia**: mare blu profondo, porto con piccole barche.
- **Vegetazione**: alberi, arbusti, piccoli giardini lungo le strade.
- **Colori**: blu, verde, rosso, bianco, grigio. In palette: `#185F76`/`#337A98`, `#4C6E44`, `#B67352`, `#DBC8A6`.
- **Dettagli pixel art**: sagome compatte delle case, tetti, barche, molo, marciapiedi, alberi, profilo vulcanico.

### Foto 2 — Casina Vanvitelliana

- **Soggetto**: Casina Vanvitelliana, edificio rotondo sul mare (confermato dall’analisi dell’immagine ingrandita; l’analisi esistente lo indicava già).
- **Facciate**: struttura chiara bianca/gialla; altri edifici costieri chiari e rossi. Ringhiere bianche.
- **Balconi**: presenti sui piani superiori degli edifici costieri, con ringhiere bianche/metallo.
- **Insegne**: l’ingrandimento mostra un pannello/cartello turistico con scritta non sempre leggibile (“Guida alla Casina Vanvitelliana”); da trattare come cartello generico, non come insegna di esercizio.
- **Panni stesi**: non visibili.
- **Tavolini**: non visibili.
- **Mare/spiaggia**: mare blu scuro, onde, piccole barche ormeggiate, cielo blu con poche nuvole.
- **Vegetazione**: alberi e arbusti, area verde lungo il mare.
- **Colori**: bianco, giallo/ocra, blu, verde, rosso.
- **Dettagli pixel art**: cupola, corpo rotondo, ringhiera, palafitte sull’acqua, barche, colline sullo sfondo.

### Foto 3 — strada pedonale con bambino

- **Soggetto**: bambino, con un adulto, su una strada pedonale/marciapiede.
- **Facciate**: due palazzi colorati, uno con mattoni e uno con intonaco.
- **Balconi**: presenti su entrambi i palazzi; l’analisi esistente segnala fiori sui balconi.
- **Insegne**: non visibili come scritte; la nuova analisi segnala solo pannelli luminosi non leggibili.
- **Panni stesi**: non visibili.
- **Tavolini**: non visibili.
- **Mare/spiaggia**: non visibili.
- **Vegetazione**: palme, alberi, fiori lungo la strada.
- **Colori**: rosa, bianco, verde, blu, oro/ocra.
- **Dettagli pixel art**: bambino 16×32, palme, marciapiede, palazzi con balconi fioriti, panchine.

### Foto 4 — interno domestico

- **Soggetto**: scena d’interno con personaggio su un giaciglio; non è una fotografia di una facciata bacolese.
- **Facciate**: non visibili. L’analisi esistente descrive pareti in legno e finestre a rullo.
- **Balconi**: l’analisi esistente riporta un balcone con ringhiera in legno e piante; la nuova analisi non lo conferma.
- **Insegne**: non visibili.
- **Panni stesi**: non visibili.
- **Tavolini**: tavoli e sedie in legno visibili.
- **Mare/spiaggia**: non visibili.
- **Vegetazione**: piante in vaso.
- **Colori**: marrone, beige, bianco, verde; in palette `#78614C`/`#4E3F2D`.
- **Dettagli pixel art**: tavolo, sedia, televisione, pianta in vaso, quadri alle pareti. Utile per gli interni, non per le facciate esterne.

### Foto 5 — villaggio stilizzato

- **Soggetto**: non univoco nella nuova analisi; l’analisi esistente descrive un personaggio al centro di una piccola città. L’immagine appare stilizzata, non una fotografia urbana.
- **Facciate**: case con tetti a capanna; una casa blu con tetto viola e una casa in legno/mattoni rossi.
- **Balconi**: non visibili nella nuova analisi; l’analisi esistente segnala un balcone in legno (non confermato).
- **Insegne**: non visibili.
- **Panni stesi**: non visibili.
- **Tavolini**: non visibili.
- **Mare/spiaggia**: non visibili.
- **Vegetazione**: alberi, arbusti, erba.
- **Colori**: verde, marrone, giallo, blu.
- **Dettagli pixel art**: case a capanna, marciapiedi in pietra, alberi/arbusti, ringhiere in legno se si segue l’analisi esistente.

### Foto 6 — panorama costiero con isole

- **Soggetto**: panorama costiero di Bacoli con isole sullo sfondo.
- **Facciate**: case bianche lungo la costa, tetti variopinti; l’analisi esistente segnala auto parcheggiate lungo la strada costiera.
- **Balconi**: non visibili.
- **Insegne**: non visibili.
- **Panni stesi**: non visibili.
- **Tavolini**: non visibili.
- **Mare/spiaggia**: mare blu profondo, spiaggia sabbiosa, barche gialle, rocce sulla costa, isole.
- **Vegetazione**: alberi e arbusti sulla costa e sulle colline.
- **Colori**: blu del mare, verde, bianco, grigio delle rocce.
- **Dettagli pixel art**: case a gradoni, rocce, barche, isole all’orizzonte, strada costiera.

### Riferimento aggiuntivo già nel repository

`docs/ai_references/roof_terracotta_70.jpg`: tetto inclinato con tegole di terracotta arancione, struttura in legno, muro in pietre e alberi sullo sfondo. Conferma la scelta di `terra`/`terra_light`/`terra_dark` per `sroof`.

## 2. Confronto con `tools/generate_assets.py` e con i luoghi

**Già presente nel generatore**

- `make_facade(size, variant)`: 12 varianti × 4 misure (32/48/64/80), sei layout ricorrenti: casa con panni, palazzo con tre balconi, bar con tenda e insegna, edificio in pietra, negozio con saracinesche, villa con terrazzo. Aggiunte occasionali: scala esterna (`variant % 4 == 2`) e fioriera (`variant % 3 == 1`).
- `make_building(style)`: 6 sprite 80×96 con le stesse sei logiche.
- `make_prop`: `palm`, `olive_tree`, `bench`, `lamp`, `umbrella`, `boat`.
- `P` usa esattamente la palette approvata: `#0C1823`, `#D3B59D`, `#BC9E87`, `#DBC8A6`, `#B69375`, `#B67352`, `#825834`, `#E6AB2D`, `#185F76`, `#337A98`, `#3A9FF3`, `#AFD7E3`, `#4C6E44`, `#51B526`, `#78614C`, `#4E3F2D`.

**Gap principali**

1. **Le varianti non seguono il luogo**: `WorldScene.facadeVariant()` fa un hash del `place.id` modulo 12. Esempi concreti: `place-276` “Casina Vanvitelliana” riceve variante 6 → layout 0 (casa con panni), non un padiglione rotondo; `place-22` “Talent Caffè” riceve layout 5 (villa), non una facciata da bar; `place-1` “Il Portico” riceve layout 2 (bar), corretto per caso. Il problema è di assegnazione, non di assenza dell’asset.
2. **Foto vs. codice**: le foto non mostrano panni stesi né insegne leggibili. Panni e insegne nel generatore sono una licenza stilistica mediterranea, da mantenere ma non da trattare come “fedeltà fotografica”.
3. **Balconi vuoti**: `sbalcony`/`balcony` disegnano solo lastra e ringhiere; mancano sediola, tavolino, piante e bucato. Le foto 2 e 3 mostrano balconi/terrazze e fiori.
4. **Insegne non parlanti**: `sawning`/`make_building(style=2)` usano una targa ocra con barre nere, non scritte. I luoghi reali hanno nomi precisi (`Il Portico`, `U'munazen`, `Talent Caffè`, `Ristorante Garibaldi`, `Living`, `Pizzeria Bacoli centro 23`, ecc.).
5. **Nessun tavolino da bar all’aperto**: esiste `f_table`/`f_chair` per gli interni e l’ombrellone come prop, ma non un set “tavolino + 2 sedie + ombrellone” per i 27 ristoranti, 12 caffè e 10 bar presenti in `bacoli_places.json`.
6. **Casina Vanvitelliana non ha un asset dedicato**: in `bacoli_places.json` è `place-276` (157,252, 9 celle, `archaeological_site`); il modello rotondo bianco/giallo della foto 2 non è riprodotto da nessuna delle 12 varianti.
7. **Tetti tutti in terracotta**: `sroof` usa solo `terra`/`terra_light`/`terra_dark`; foto 6 e l’analisi esistente parlano di tetti variopinti. Manca una variante piatta/domap per il centro storico e per la Casina.
8. **Riflesso mare in ogni finestra**: `swindow`/`window` disegnano sempre `sea`/`sea_mid` nel vetro, anche per case del centro storico (`place-160`…`place-169`, x≈293-352, y≈455-513).
9. **Barche non visibili in mappa**: il prop `boat` esiste, ma `SCREENSHOT_VISION_REVIEW.md` segnala “nessuna barca visibile” negli screenshot E2E. Il problema è di posizionamento in scena, non di pixel art.
10. **Pescatori non fotografati**: nessuna delle 6 immagini mostra pescatori. Eventuale aggiunta è una suggestione stilistica da legare a `place-280` “Porto Turistico Miseno” (336,527) o alla piazzetta (353,432), non un recupero fotografico.

## 3. Miglioramenti prioritizzati

| Prio | Miglioramento | Dove / luoghi | Dettaglio concreto |
| --- | --- | --- | --- |
| P0 | Assegnare le facciate per **tipo di luogo**, non per hash | Tutti i 303 place; caso critico `place-276` Casina | Case → layout 0/1; bar/ristoranti → layout 2; negozi → layout 4; chiese → layout 3; villette a mare → layout 5. Casina → asset unico. |
| P0 | Balconi arredati | Foto 2/3; case del centro e della costa | Aggiungere al ringhiera una sedia 4×6, un tavolino 5×3, 1 vaso con `#D98B96`/`#51B526`; ombra sotto la lastra in `#1B2C33`. |
| P0 | Panni stesi variati, solo sulle case | Foto 1/2/3 non li mostrano: usare come stile, non come fedeltà | Corda curva + 2-4 capi nei colori `#F2EAD8`, `#3A9FF3`, `#E6AB2D`, `#B1403B`, `#D98B96`; evitare su bar, chiese e monumenti. |
| P0 | Insegne leggibili per attività | `place-1`, `place-13`, `place-22`, `place-26`, `place-29`, `place-43`, `place-49`, `place-109`, `place-157` | Sostituire le barre con glyph 3×5 disegnati a mano: `BAR`, `CAFFE`, `PIZZA`, `RIST`, `NEGOZIO` su `#E6AB2D`/`#F2EAD8` con contorno `#0C1823`. |
| P0 | Set tavolini esterni | 27 ristoranti, 12 caffè, 10 bar; piazzetta (353,432) | Nuovo prop 24×16: tavolino `#78614C`, due sedie `#4E3F2D`, ombrellone rosso/bianco `#B1403B`/`#F2EAD8`, ombra ellittica. |
| P1 | Variante **Via Ortensio / centro storico** | Via Ortensio è `footway`/`steps`/`service` in `bacoli_geo.json` (lat≈40.803-40.805, lon≈14.079-14.082); isolati `place-160`…`place-169` | Intonaco `#DBC8A6`/`#D3B59D`, persiane `#4C6E44`/`#3A6EA5`, marcapiano, scala esterna già presente, acciottolato; finestre senza riflesso mare. |
| P1 | Variante **Via Spiaggia / Piazzetta sul mare / Miliscola** | Via Spiaggia (`residential`), `place-283` Spiaggia di Miliscola (223,552), `place-285`/`place-303` Piazzetta sul mare (353,432, senza footprint) | Villa bassa con terrazzo (layout 5), ombrelloni, panchine, lampioni, sabbia `#D3B59D`, schiuma `#AFD7E3`; barche posizionate sulla riva. |
| P1 | Asset unico per la **Casina Vanvitelliana** | `place-276` (157,252) | Padiglione rotondo bianco/giallo, cupola, corona di finestre, ringhiere bianche, palafitte in `#4E3F2D` sull’acqua `#185F76`; niente panni stesi. |
| P1 | Tetti più vari | Foto 6 + `roof_terracotta_70.jpg` | Mantenere tegole `#B67352`/`#C08952`, ma alternare alcune varianti con `#E6AB2D`, `#BC9E87` e una piatta per il centro; cupola solo per la Casina. |
| P1 | Ombre coerenti | Tutte le facciate | Ombra laterale già presente; aggiungere ombra sotto balconi/tende e sul davanzale, sempre `#0C1823`/`#1B2C33`, con lunghezza costante per le 4 misure. |
| P2 | Pescatore decorativo | `place-280` Porto Turistico Miseno, piazzetta | Sprite 16×32 con cappello, maglia `#3A6EA5`, canna 8 px; **non osservato nelle foto**, da usare solo come atmosfera. |
| P2 | Dettagli pedonali | Foto 3/6, centri frazionali | Panchina, lampione, vasi già esistono come prop; distribuirli più fitti nelle strade pedonali e lungo la costa. |

## 4. Cosa si può fare con Pillow in `tools/generate_assets.py` (senza API esterne)

Tutto il lavoro grafico può restare in `Pillow.ImageDraw` + `random.Random(seed)`, come già nel file:

- `laundry()` / `slaundry()`: più capi, mollette, corda curva, colori dalla palette approvata.
- `balcony()` / `sbalcony()`: sedia, tavolino, vaso, bucato; creare una variante “arredato” e una “vuoto”.
- `awning()` / `sawning()` + nuova funzione `ssign()` per scritte compatte con glyph 3×5 disegnati a rettangoli; nessun font esterno necessario.
- `window()` / `swindow()`: parametro `sea_reflection=True/False` per distinguere case costiere e case del centro.
- `roof()` / `sroof()`: varianti di colore e tetto piatto/cupola; la cupola può essere un nuovo sprite dedicato.
- `make_facade()` e `FACADE_STYLES`: ridefinire le 12 varianti per destinazione d’uso (case/bar/ristorante/negozio/chiesa/villa), senza aumentare il numero di file se si vuole evitare di toccare il caricamento.
- `make_building()`: stesse modifiche sulle 6 facciate 80×96 legacy.
- `make_prop()`: aggiungere `cafe_table`, `chair_outdoor`, `street_sign`, `fisher`, `casina` ( quest’ultima come prop/landmark 64×80 o come variante speciale).
- `make_character()`: variante NPC pescatore con canna, riutilizzando `draw_character`.

**Non realizzabili solo con Pillow** (richiederebbero modifiche a codice di gioco, non eseguite in questa task): cambiare `facadeVariant()` in `WorldScene.ts`, far comparire le barche sulla riva, associare i nomi reali dei locali alle insegne a runtime, posizionare i tavolini davanti ai locali e sincronizzare le ombre con il ciclo giorno/notte.

Nessun file di gioco è stato modificato: questo documento è l’unico file scritto.
