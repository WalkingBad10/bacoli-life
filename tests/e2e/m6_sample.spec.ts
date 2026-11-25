import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const OUT = resolve(process.cwd(), 'docs', 'M6_SCREENSHOTS');

test('M6 zona campione: centro storico con pavimentazioni e arredo', async ({ page }) => {
  mkdirSync(OUT, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  await page.waitForTimeout(1200);

  const project = test.info().project.name.replace(/[^a-z0-9_-]/gi, '_');
  const info = await page.evaluate(() => {
    const d = (window as any).__bacoliDebug();
    return {
      region: d.region,
      player: d.player,
      places: d.places,
      solidTiles: d.solidTiles,
      vehicles: d.vehicles,
      traffic: d.traffic,
      urbanProps: d.urbanProps,
      lamps: d.lamps,
      busStops: d.busStops,
      alerts: d.alerts,
      loadedTextures: d.loadedTextures,
      actors: d.actors,
      trafficRoutes: d.trafficRoutes,
      npcs: d.npcs,
      walkingNpcs: d.walkingNpcs,
    };
  });
  await page.screenshot({ path: resolve(OUT, `02-zona-campione-overview-${project}.png`) });

  // Il teleport usa coordinate pixel: 1 tile = 16 px.
  await page.evaluate(() => (window as any).__bacoliTest.teleport(324 * 16 + 8, 478 * 16 + 8));
  await page.waitForTimeout(900);
  const focused = await page.evaluate(() => {
    const d = (window as any).__bacoliDebug();
    return { player: d.player, region: d.region, visibleNpcs: d.visibleNpcs };
  });
  await page.screenshot({ path: resolve(OUT, `02-zona-campione-strada-${project}.png`) });

  writeFileSync(
    resolve(OUT, `m6-sample-${project}.json`),
    JSON.stringify({ info, focused, errors }, null, 2),
  );
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
  expect(info.busStops).toBeGreaterThan(0);
  expect(info.alerts).toContain('cumana-baia-riaperta');
  expect(info.actors.length).toBeGreaterThan(40);
});
