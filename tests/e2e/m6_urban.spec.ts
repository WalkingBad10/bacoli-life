import { expect, test } from '@playwright/test';

type Spot = { x: number; y: number; radius: number };

test('M6 arredo urbano: posizionamento regolato e senza sovrapposizioni', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliDebug === 'function');
  await page.waitForTimeout(500);

  const data = await page.evaluate(() => {
    const d = (window as any).__bacoliDebug();
    return { spots: d.urbanSpots as Spot[], lamps: d.lamps, region: d.region };
  });

  expect(data.region).toBe('centro');
  expect(data.spots.length).toBeGreaterThan(25);
  expect(data.lamps).toBeGreaterThan(5);
  for (let i = 0; i < data.spots.length; i++) {
    for (let j = i + 1; j < data.spots.length; j++) {
      const a = data.spots[i];
      const b = data.spots[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      expect(distance, `prop ${i}/${j} sovrapposto`).toBeGreaterThanOrEqual(a.radius + b.radius + 7.9);
    }
  }
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});
