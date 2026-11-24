# BACOLI LIFE — Roadmap

Este documento definisce l'ordine delle priorità. **Pianura non viene costruita ora**:
ne viene predisposta solo l'architettura dati.

## Priorità obbligatorie

1. **Completare Bacoli** con elevata qualità grafica e geografica.
2. **Completare tutte le meccaniche di simulazione della vita**.
3. **Verificare stabilità, interazioni e salvataggi**.
4. **Realizzare il sistema ferroviario Cumana e Circumflegrea**.
5. **Ricostruire Pianura fedelmente alla realtà**.
6. **Collegare entrambe le ambientazioni**.

## Fase 1 — Vertical slice (completata)
- Via Ortensio, Via Spiaggia, piazzetta sul mare.
- Casa di proprietà, bar, pizzeria, negozi visitabili.
- Pixel art 16x16, palette mediterranea, ciclo giorno/notte, collisioni.
- Salvataggi versionati fin dall'inizio.

## Fase 2 — Bacoli completa (milestone 2 verificata)
- [x] Centro storico, Villa Comunale, Marina Grande, Lago Miseno, Miseno,
  Miliscola, Baia, Fusaro, Torregaveta, Cappella nella mappa 480x680.
- [x] Monumenti: Piscina Mirabilis, Cento Camerelle, Castello Aragonese,
  Casina Vanvitelliana.
- [x] NPC con A*, routine, dialoghi in italiano/napoletano.
- [x] Lavoro, economia, attività ricreative, smartphone virtuale.
- [x] Arredamento, famiglia, umore e interni camminabili con arredi solidi.

## Fase 3 — Veicoli e trasporti locali (milestone 2 verificata)
- [x] Automobili e motociclette guidabili, concessionaria, carburante,
  parcheggi e traffico.
- [x] Autobus EAV 101/102/144/145/146/150/153 con biglietti e collegamenti.
- [ ] Biciclette e barche guidabili.
- [ ] Officine e manutenzione veicoli.

## Fase 4 — Sistema ferroviario (parzialmente implementato)
Rete reale EAV implementata con stazioni e stati di servizio verificati:
- [x] **Cumana**: Lucrino → Baia → Fusaro → Torregaveta, con Baia riaperta
  il 6/11/2025. Non esiste una stazione Miseno: Miseno si collega via bus.
- [x] **Circumflegrea**: Licola → Marina di Licola → Cuma → Lido Fusaro →
  Torregaveta, con servizio regolare sospeso oltre Licola dal 2014.
- [x] Biglietti, tempi di viaggio e verifiche E2E dei viaggi disponibili.
- [ ] Convogli animati, interni esplorabili, porte, annunci e paesaggio dai
  finestrini: il viaggio attuale resta un teletrasporto con tempo calcolato.

## Fase 5 — Espansione Pianura (Napoli, CAP 80126)
Solo dopo aver completato e testato Bacoli e la rete ferroviaria.
Luoghi da verificare con OSM/foto prima della ricostruzione:
- Stazione Circumflegrea di Pianura.
- Via Montagna Spaccata, Via Campanile, Via Provinciale Napoli,
  Via Comunale Napoli, centro storico.
- Bar Etoile, chiese, piazze, attività commerciali, palazzi residenziali,
  distributori, supermercati, pizzerie, bar, ristoranti, fermate autobus,
  abitazioni acquistabili e visitabili.

**Non è un secondo videogioco**: stessi inventario, economia, salvataggi,
qualità grafica e meccaniche. Il giocatore potrà vivere a Bacoli e lavorare
a Pianura, possedere una seconda casa e spostarsi con treno, autobus,
automobile o motocicletta.

## Fase 6 — Ottimizzazione, test e pubblicazione
- Test automatici, screenshot, compatibilità mobile, GitHub Pages, APK.
