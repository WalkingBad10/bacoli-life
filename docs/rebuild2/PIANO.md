# BACOLI LIFE REBUILD 2.0 — piano di ricostruzione strutturale

Stato: **anteprima strutturale verificabile, in attesa di approvazione visiva**. Branch `rebuild-2.0`.
La Milestone 6 resta online senza modifiche; questo branch non sarà pubblicato come versione ufficiale.
Checkpoint operativo: `docs/PROGRESS.md` e `docs/rebuild2/AUDIT_CONSOLIDATO.md`.

## 1. Perché si ricostruisce

L'utente ha respinto la M6 dopo aver giocato: grafica rudimentale, arredo senza criterio,
veicoli fuori strada, personaggio che attraversa gli edifici, Bacoli non riconoscibile.
I 163 test verdi non hanno intercettato questi difetti: misurano conteggi e hook, non
la qualità visiva né la fisica del movimento.

Screenshot segnalato (`docs/rebuild2/audit/screenshot_utente.png`, 1152x1536):

- 45,92% pixel con valore <70 e densità bordi solo 2,75%: immagine piatta e ripetitiva.
- 8,60% pixel blu con 122 componenti rettangolari >=40 px: marker/placeholder ancora visibili.
- 8,60% pixel verdi in grandi blocchi rettangolari: marciapiedi verdi piatti, non pavimentazione reale.
- 5,20% rosso mattone e 5,30% bianco finestra: facciate standardizzate, non intonaco flegreo.
- Descrizione visiva di supporto: auto piccole, personaggi piccoli, panchine rettangolari, HUD a rettangoli.
  Il giudizio del modello visivo non è una certificazione: le misure sopra sono la referenza.

## 2. Decisioni architetturali

- **Phaser 3 resta**: l'audit del motore (`docs/rebuild2/audit/motore-grafico.md`) dimostra che
  pixel-art, zoom e camera sono configurati bene; il difetto è il pipeline costruito sopra.
- **Riscrivere**: rappresentazione della scena, sorgente dei GID, ordinamento di profondità,
  occlusione degli edifici, atlas/asset, collisioni, cartografia e traffico.
- **Recuperare**: logica di simulazione (famiglia, economia, carriera, salvataggi), animazioni
  personaggio, concetto di profondità dal punto di contatto, hook diagnostici.
- **Non usare le nove regioni come base grafica obbligatoria**: restano nei dati ma la zona
  campione ha una pipeline nuova e indipendente.

## 3. Zona campione

Bbox OSM reale: `14.0775, 40.7995 – 14.0830, 40.8062` (Via Spiaggia, Via Ortensio,
Via Roma, Piazza Marconi, Municipio di Bacoli, Chiesa di San Gioacchino, Tomba di Agrippina, costa).

Dati metrici prodotti (`tools/rebuild2_build_geo.py`, PyProj + Shapely + GeoPandas + OSMnx):

| Elemento | Conteggio |
|---|---:|
| Edifici OSM | 353 |
| Strade OSM | 63 |
| POI | 33 |
| Aree naturali/landuse | 2 |
| Nodi/archi grafo OSMnx | 4100 / 8534 |
| Componenti deboli del grafo | 353 |

CRS: EPSG:32633 (UTM 33N, metri); origine `422176.8877929378, 4517668.951013729`.
Raster verificabile alla scala di gioco: `docs/rebuild2/data/osm_reference.png` (16 px/m);
overlay e metriche: `docs/rebuild2/audit/overlay.png`, `overlay_metrics.json`.

Scala uniforme:

- 1 m = 16 px a terra; persona adulta 28 px; porta 34 px; auto 64 px; autobus 176 px.
- Piano edilizio 52 px (include cornicione); proiezione 3/4 codificata una sola volta.
- Nessuna scala frazionaria: gli asset sono pre-renderizzati alla dimensione metrica corretta.

## 4. Fasi obbligatorie

1. **Audit strutturale** (otto report in `docs/rebuild2/audit/`).
2. **Fondazione metrica**: GeoJSON proiettato, Tiled JSON multilivello, atlas e palette dalle foto.
3. **Rendering**: layer separati, depth centralizzata, maschere di occlusione, ombre proiettate.
4. **Collisioni**: hitbox da impronte, swept collision, A*, debug overlay, test da 4 direzioni.
5. **Traffico**: grafo con corsie/larghezze reali, bus solo su strade compatibili, nessun teletrasporto.
6. **Level design**: arredo solo per regole spaziali e funzione d'area, zero marker in gioco.
7. **Zona giocabile**: strada reale, palazzi riconoscibili, bar, pizzeria, casa, veicoli, NPC.
8. **QA nuova**: test che riproducono i difetti dello screenshot, OpenCV e sessioni Playwright reali.
9. **Anteprima separata**: repository Pages dedicato; M6 resta la versione ufficiale fino ad approvazione.

## 5. Gate di accettazione

Nessuna fase è "completa" solo perché compila. Serve:

- screenshot della zona e confronto con `osm_reference.png` e con le fotografie reali;
- test di attraversamento edificio da nord/sud/est/ovest con movimento reale, non teletrasporto;
- zero marker rettangolari nella versione giocabile (misurato con OpenCV);
- proporzioni verificate da misure deterministiche (non da asserzioni sui soli conteggi);
- sessione Playwright continua con percorsi registrati e zero errori console.

## 6. Stato delle fasi al checkpoint

- Fasi 1-8: eseguite nell'anteprima separata. Otto audit, pipeline metrica, atlas, mappe,
  collisioni poligonali, A*, corsie reali, arredo regolato, QA OpenCV/Vitest/Playwright.
- Fase 9: **aperta**. La build `dist/rebuild2.html` esiste, ma non è stata pubblicata su un
  repository Pages dedicato. La live resta M6.
- Recupero progressivo di famiglia, abitazioni, economia, carburante, Cumana/Circumflegrea,
  animali, negozi, inventario, smartphone e migrazione salvataggi: **non ancora innestato**
  nel runtime separato; la logica M6 resta disponibile nel ramo come sorgente da recuperare.

## 7. Problemi aperti

- Approvazione visiva finale: richiede il confronto diretto dell'utente. Ollama è solo supporto descrittivo.
- Pubblicazione anteprima: repository Pages separato, non ancora creato.
- Spawn su Via Antonio De Curtis e bbox completo di 353 edifici: ampliare la zona giocabile
  solo dopo approvazione della qualità della zona campione.
- Migrazione dei sistemi M6 nel runtime REBUILD 2.0: da fare dopo il gate visivo.
