/** Chiavi texture delle facciate effettivamente usate da una regione OSM. */

export interface AssetPlace {
  bounds?: [number, number, number, number];
  facadeWidth?: number;
  floors?: number;
  variant?: number;
}

/**
 * Il dataset contiene 3.460 edifici ma solo alcune combinazioni larghezza /
 * piani / variante. Caricare il prodotto cartesiano (oltre 800 PNG) era il
 * principale costo di avvio: qui restituiamo solo le chiavi che la regione
 * attiva disegna davvero, in ordine deterministico.
 */
export function regionTextureKeys(places: readonly AssetPlace[]): string[] {
  const keys = new Set<string>();
  for (const place of places) {
    if (!place.bounds) continue;
    const width = place.facadeWidth ?? 128;
    const floors = place.floors ?? 3;
    const variant = place.variant ?? 0;
    keys.add(`building_${width}_${floors}_${variant}`);
    keys.add(`roof_${width}_${variant}`);
    keys.add(`shadow_${width}`);
  }
  return [...keys].sort();
}
