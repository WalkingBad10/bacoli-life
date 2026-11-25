import { expect, test } from '@playwright/test';

type Route = {
  id: string; x: number; y: number; remaining: number;
  target: { x: number; y: number } | null; stalls: number;
};

const FRAMES = 12;
const SAMPLE_MS = 250;

test('M6 traffico: percorre le strade senza teletrasporti', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliDebug === 'function');
  await page.waitForTimeout(500);

  const samples: Route[][] = [];
  for (let frame = 0; frame < FRAMES; frame++) {
    samples.push(await page.evaluate(() => (window as any).__bacoliDebug().trafficRoutes));
    await page.waitForTimeout(SAMPLE_MS);
  }

  expect(samples[0].length, 'veicoli di traffico generati').toBeGreaterThanOrEqual(6);
  const byId = new Map<string, Route[]>();
  for (const sample of samples) {
    for (const route of sample) {
      const list = byId.get(route.id) ?? [];
      list.push(route);
      byId.set(route.id, list);
    }
  }

  let moved = 0;
  for (const [id, list] of byId) {
    let distance = 0;
    let largestStep = 0;
    for (let i = 1; i < list.length; i++) {
      const step = Math.hypot(list[i].x - list[i - 1].x, list[i].y - list[i - 1].y);
      largestStep = Math.max(largestStep, step);
      distance += step;
      // 250 ms a 36 px/s = 9 px: anche con latenza non si può teletrasportare.
      expect(step, `${id} ha fatto un salto di ${step.toFixed(1)} px`).toBeLessThan(24);
    }
    if (distance > 12) moved++;
    expect(Math.max(...list.map((route) => route.stalls)), `${id} resta bloccato`).toBeLessThan(46);
  }
  expect(moved, 'veicoli che si muovono realmente').toBeGreaterThanOrEqual(3);
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});
