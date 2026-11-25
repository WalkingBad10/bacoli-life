# Confronto visivo deterministico

Stesse maschere e soglie usate per l'analisi dello screenshot segnalato. Un valore basso di `blue_components` indica assenza di marker rettangolari; un `edge_density` maggiore indica più dettaglio visivo.

| Metrica | M6 segnalato | REBUILD 2.0 |
|---|---:|---:|
| size | 1152x1536 | 1280x720 |
| dark<70 | 52.04 | 2.88 |
| mean_rgb | [83.6, 90.8, 88.5] | [144.1, 134.6, 119.1] |
| edge_density | 8.06 | 2.76 |
| unique_colors | 150907 | 421 |
| blue | 8.59 | 0.05 |
| blue_components | 122 | 2 |
| blue_max_component | 73403 | 234 |
| green | 8.57 | 0.0 |
| green_components | 21 | 0 |
| red | 5.24 | 8.02 |
| red_components | 70 | 10 |
| white | 5.26 | 0.0 |
| white_components | 236 | 0 |
| gray | 15.62 | 42.44 |
| gray_components | 188 | 26 |

## Limiti

Le metriche non certificano la bellezza: la approvazione finale resta visiva da parte dell'utente. Il modello corrente non può vedere le immagini; la descrizione Ollama è solo di supporto.
