import { expect, test } from '@playwright/test';

test('il mondo si carica e mostra HUD e canvas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#hud-clock')).toHaveText(/\d\d:\d\d/);
  await page.waitForTimeout(2500);

  await page.screenshot({ path: `screenshots/world-${test.info().project.name}.png` });
  expect(errors, `Errori console: ${errors.join(' | ')}`).toEqual([]);
});

test('movimento, interazione e smartphone non bloccano il gioco', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.keyboard.press('KeyT');
  await expect(page.locator('#hud-panel')).toHaveClass(/open/);
  await page.screenshot({ path: `screenshots/smartphone-${test.info().project.name}.png` });
  await page.keyboard.press('Escape');
});

test('gli NPC si muovono e gli interni sono visitabili', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliDebug === 'function');
  const before = await page.evaluate(() => (window as any).__bacoliDebug());
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => (window as any).__bacoliDebug());
  expect(after.places).toBeGreaterThan(100);
  expect(JSON.stringify(before.npcs)).not.toBe(JSON.stringify(after.npcs));

  await page.evaluate(() => {
    const world = (window as any).__bacoli.scene.getScene('World');
    world.scene.launch('Interior', {
      kind: 'cafe', name: 'Bar Pina', returnX: 1280, returnY: 1296,
    });
    world.scene.pause();
  });
  await expect(page.locator('#hud-panel')).toHaveClass(/open/);
  await expect(page.locator('#game canvas')).toBeVisible();
  await page.screenshot({ path: `screenshots/interior-${test.info().project.name}.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});

test('salvataggio manuale persiste dopo il reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.locator('#hud-save').click();
  await page.waitForTimeout(400);
  const saved = await page.evaluate(() =>
    Object.keys(localStorage).filter((k) => k.startsWith('bacoli-life')));
  expect(saved.length).toBeGreaterThan(0);
  await page.reload();
  await expect(page.locator('#hud-clock')).toHaveText(/\d\d:\d\d/);
});
