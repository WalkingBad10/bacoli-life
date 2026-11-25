import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const REGIONS = [
  'centro', 'marina_grande', 'lago_miseno', 'villa_comunale', 'miseno',
  'miliscola', 'baia', 'fusaro', 'torregaveta',
];
// La baseline M5 resta intoccabile: il QA visivo delle nove regioni M6 va in
// una cartella dedicata, così rieseguire E2E non sovrascrive i riferimenti.
const OUT = resolve(process.cwd(), 'docs', 'M6_SCREENSHOTS', 'regioni');

for (const region of REGIONS) {
  test(`QA visiva regione M6: ${region}`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    mkdirSync(OUT, { recursive: true });
    await page.goto('/');
    await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
    await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
    const switched = await page.evaluate(
      (id) => (window as any).__bacoliTest.setRegion(id), region,
    );
    expect(switched).toBe(true);
    await page.waitForFunction(
      (id) => (window as any).__bacoliDebug().region === id, region, { timeout: 20_000 },
    );
    await page.waitForTimeout(600);
    const info = await page.evaluate(() => ({
      region: (window as any).__bacoliDebug().region,
      places: (window as any).__bacoliDebug().places,
      solidTiles: (window as any).__bacoliDebug().solidTiles,
      station: (window as any).__bacoliDebug().station,
    }));
    expect(info.region).toBe(region);
    expect(info.places).toBeGreaterThan(2);
    expect(info.solidTiles).toBeGreaterThan(0);
    const project = test.info().project.name.replace(/[^a-z0-9_-]/gi, '_');
    await page.screenshot({ path: resolve(OUT, `${region}-${project}.png`) });
    expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
  });
}
