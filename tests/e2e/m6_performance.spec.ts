import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

const OUT = resolve(process.cwd(), 'docs', 'M6_SCREENSHOTS');

test('M6 prestazioni: boot, FPS e caricamento dinamico delle facciate', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  mkdirSync(OUT, { recursive: true });

  const start = Date.now();
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => {
    const d = (window as any).__bacoliDebug?.();
    return d && !d.loading && typeof (window as any).__bacoliTest === 'object';
  });
  const bootMs = Date.now() - start;

  const initial = await page.evaluate(() => (window as any).__bacoliDebug().loadedTextures);
  // Il centro non deve precaricare le facciate delle altre otto regioni.
  expect(initial, 'texture del solo centro').toBeLessThan(400);

  const runtime = await page.evaluate(async () => {
    const deltas: number[] = [];
    let last = performance.now();
    const end = last + 1200;
    await new Promise<void>((resolvePromise) => {
      const tick = (now: number) => {
        deltas.push(now - last);
        last = now;
        if (now < end) requestAnimationFrame(tick);
        else resolvePromise();
      };
      requestAnimationFrame(tick);
    });
    const average = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
    const memory = (performance as Performance & {
      memory?: { usedJSHeapSize: number };
    }).memory;
    return {
      fps: Math.round(1000 / average),
      frames: deltas.length,
      heapMb: memory ? Math.round(memory.usedJSHeapSize / 1048576) : null,
    };
  });
  expect(runtime.fps, `FPS misurati: ${runtime.fps}`).toBeGreaterThan(20);

  const changed = await page.evaluate(() => (window as any).__bacoliTest.setRegion('torregaveta'));
  expect(changed).toBe(true);
  await page.waitForFunction(() => {
    const d = (window as any).__bacoliDebug?.();
    return d && !d.loading && d.region === 'torregaveta';
  });
  const afterRegion = await page.evaluate(() => (window as any).__bacoliDebug().loadedTextures);
  expect(afterRegion, 'facciate aggiuntive caricate solo all arrivo').toBeGreaterThan(initial);
  expect(afterRegion, 'non tutte le regioni in memoria').toBeLessThan(600);

  const report = {
    project: test.info().project.name,
    bootMs,
    initialTextures: initial,
    texturesAfterTorregaveta: afterRegion,
    ...runtime,
    errors,
  };
  const file = resolve(OUT, `m6-performance-${test.info().project.name}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});
