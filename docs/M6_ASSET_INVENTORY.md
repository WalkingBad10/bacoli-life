# M6 — Inventario asset (usati vs archiviati)

Generato da `tools/asset_inventory.py`. "Usati" sono le chiavi che `BootScene.preload()` carica davvero; il resto resta su disco ma non entra nel bundle runtime.

- PNG in `public/assets/scale/`: **835**
- PNG caricati a runtime: **487**
- PNG archiviati (non caricati): **347**
- Chiavi mancanti: **0**

| Categoria | File caricati |
|---|---:|
| personaggi | 14 |
| edifici OSM | 249 |
| tetti | 144 |
| ombre | 37 |
| arredo e veicoli | 24 |
| interni | 17 |
| tileset | 2 |

## Asset originali forniti

L'audit distingue gli asset originali effettivamente usati come drop-in dagli asset consultati solo come riferimento. La tabella seguente è stabilita dal confronto byte-per-byte fra `public/assets/original/` e `public/assets/scale/`.

| File originale | Stato |
|---|---|
| `public/assets/original/Animals/pet_cat.png` | archiviato / riferimento |
| `public/assets/original/Animals/pet_dog.png` | archiviato / riferimento |
| `public/assets/original/Beach/rock.png` | archiviato / riferimento |
| `public/assets/original/Beach/sand_texture.png` | archiviato / riferimento |
| `public/assets/original/Beach/water_texture.png` | archiviato / riferimento |
| `public/assets/original/Buildings/church.png` | archiviato / riferimento |
| `public/assets/original/Buildings/door_accessible.png` | archiviato / riferimento |
| `public/assets/original/Buildings/door_stone.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_1_1.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_1_2.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_1_3.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_1_4.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_2_1.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_2_2.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_2_3.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_2_4.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_3_1.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_3_2.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_3_3.png` | archiviato / riferimento |
| `public/assets/original/Buildings/facade_3_4.png` | archiviato / riferimento |
| `public/assets/original/Buildings/stone_wall_a.png` | archiviato / riferimento |
| `public/assets/original/Buildings/stone_wall_b.png` | archiviato / riferimento |
| `public/assets/original/Buildings/stone_wall_c.png` | archiviato / riferimento |
| `public/assets/original/Buildings/stone_wall_d.png` | archiviato / riferimento |
| `public/assets/original/Buildings/stone_wall_e.png` | archiviato / riferimento |
| `public/assets/original/Buildings/stone_wall_f.png` | archiviato / riferimento |
| `public/assets/original/Buildings/stone_wall_g.png` | archiviato / riferimento |
| `public/assets/original/Characters/npc_1.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_10.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_11.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_12.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_2.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_3.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_4.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_5.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_6.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_7.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_8.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_9.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/npc_fisher.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Characters/player.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_bathtub.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_bed.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_chair.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_crib.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_desk.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_espresso.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_fridge.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_microwave.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_plant.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_register.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_shelf.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_sofa.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_stove.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_table.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_toilet.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_tv.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Furniture/f_washing_machine.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Harbor/boat.png` | **usato** (identico in `scale/`) |
| `public/assets/original/Interiors/bathroom.png` | archiviato / riferimento |
| `public/assets/original/Interiors/bedroom.png` | archiviato / riferimento |
| `public/assets/original/Interiors/kitchen_1.png` | archiviato / riferimento |
| `public/assets/original/Interiors/kitchen_2.png` | archiviato / riferimento |
| `public/assets/original/Interiors/kitchen_3.png` | archiviato / riferimento |
| `public/assets/original/Roads/mosaic_a.png` | archiviato / riferimento |
| `public/assets/original/Roads/road_stone_a.png` | archiviato / riferimento |
| `public/assets/original/Roads/road_stone_b.png` | archiviato / riferimento |
| `public/assets/original/Roads/stairs_flowers_a.png` | archiviato / riferimento |
| `public/assets/original/Roads/stairs_flowers_b.png` | archiviato / riferimento |
| `public/assets/original/Shops/shop_bar.png` | archiviato / riferimento |
| `public/assets/original/Shops/shop_cafe.png` | archiviato / riferimento |
| `public/assets/original/Shops/shop_restaurant.png` | archiviato / riferimento |
| `public/assets/original/Shops/shop_trattoria.png` | archiviato / riferimento |
| `public/assets/original/Stations/platform.png` | **usato** (identico in `scale/`) |
| `public/assets/original/Stations/rail.png` | **usato** (identico in `scale/`) |
| `public/assets/original/Stations/station_eav.png` | **usato** (identico in `scale/`) |
| `public/assets/original/Trains/train.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/UrbanProps/arch_flowers_a.png` | archiviato / riferimento |
| `public/assets/original/UrbanProps/arch_flowers_b.png` | archiviato / riferimento |
| `public/assets/original/UrbanProps/bench.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/UrbanProps/drain.png` | archiviato / riferimento |
| `public/assets/original/UrbanProps/fence_metal_a.png` | archiviato / riferimento |
| `public/assets/original/UrbanProps/fence_metal_b.png` | archiviato / riferimento |
| `public/assets/original/UrbanProps/fence_metal_c.png` | archiviato / riferimento |
| `public/assets/original/UrbanProps/fence_metal_d.png` | archiviato / riferimento |
| `public/assets/original/UrbanProps/fountain.png` | archiviato / riferimento |
| `public/assets/original/UrbanProps/lamp.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/UrbanProps/planters_flowers.png` | archiviato / riferimento |
| `public/assets/original/Vegetation/cactus.png` | archiviato / riferimento |
| `public/assets/original/Vegetation/palm.png` | sostituito dalla versione M6 rigenerata |
| `public/assets/original/Vegetation/pergola.png` | archiviato / riferimento |
| `public/assets/original/Vegetation/pergola_b.png` | archiviato / riferimento |
| `public/assets/original/Vegetation/tree_a.png` | archiviato / riferimento |
| `public/assets/original/Vegetation/tree_b.png` | archiviato / riferimento |
| `public/assets/original/Vegetation/tree_c.png` | archiviato / riferimento |
| `public/assets/original/Vehicles/bicycle.png` | archiviato / riferimento |
| `public/assets/original/Vehicles/car_a.png` | archiviato / riferimento |
| `public/assets/original/Vehicles/car_b.png` | archiviato / riferimento |
| `public/assets/original/Vehicles/scooter.png` | archiviato / riferimento |

## Archiviati (estratto)

I primi 40 nomi, in ordine lessicografico; l'elenco completo è ricostruibile con lo script.

- `building_1024_1_1.png`
- `building_1024_2_0.png`
- `building_1024_2_1.png`
- `building_1024_2_2.png`
- `building_1024_2_3.png`
- `building_1024_3_0.png`
- `building_1024_3_1.png`
- `building_1024_3_2.png`
- `building_1024_3_3.png`
- `building_1024_4_0.png`
- `building_1024_4_1.png`
- `building_1024_4_2.png`
- `building_1024_4_3.png`
- `building_1088_2_0.png`
- `building_1088_2_1.png`
- `building_1088_2_2.png`
- `building_1088_3_0.png`
- `building_1088_3_1.png`
- `building_1088_3_2.png`
- `building_1088_3_3.png`
- `building_1088_4_0.png`
- `building_1088_4_1.png`
- `building_1088_4_2.png`
- `building_1088_4_3.png`
- `building_112_1_0.png`
- `building_112_1_1.png`
- `building_112_1_2.png`
- `building_112_1_3.png`
- `building_112_3_3.png`
- `building_112_4_0.png`
- `building_112_4_1.png`
- `building_112_4_2.png`
- `building_112_4_3.png`
- `building_128_1_0.png`
- `building_128_1_1.png`
- `building_128_1_2.png`
- `building_128_1_3.png`
- `building_128_3_3.png`
- `building_128_4_0.png`
- `building_128_4_1.png`

## Tavole e fotografie

Le tavole e le fotografie consegnate sono state usate solo come riferimento per palette, geometria delle facciate e arredo; il loro ritaglio automatico con alpha/GrabCut è risultato inaffidabile e non è stato immesso nel runtime. `tileset_m5_legacy.png` conserva il vecchio tileset per confronto e rollback.
