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

test('il giocatore non attraversa edifici e muri solidi', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  const wall = await page.evaluate(() => (window as any).__bacoliTest.findWall());
  expect(wall).not.toBeNull();
  const standOnWall = await page.evaluate((w) =>
    (window as any).__bacoliTest.canStand(w.solidX, w.solidY), wall);
  expect(standOnWall).toBe(false);
  await page.evaluate((w) =>
    (window as any).__bacoliTest.teleport(w.startX, w.startY), wall);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1000);
  await page.keyboard.up('KeyD');
  const after = await page.evaluate(() => (window as any).__bacoliTest.player());
  expect(after.x).toBeLessThan(wall.boundary);
});

test('la guida consuma carburante e il veicolo si muove', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  const vehicles = await page.evaluate(() => (window as any).__bacoliTest.vehicles());
  expect(vehicles.length).toBeGreaterThan(0);
  const vehicle = vehicles[0];
  await page.evaluate((v) => {
    (window as any).__bacoliTest.teleport(v.x, v.y);
    (window as any).__bacoliTest.enterVehicle();
  }, vehicle);
  const driving = await page.evaluate(() => (window as any).__bacoliDebug().driving);
  expect(driving).toBe(vehicle.id);
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyS');
  const after = await page.evaluate(() => ({
    player: (window as any).__bacoliTest.player(),
    fuel: (window as any).__bacoliDebug().fuel,
  }));
  expect(after.player.y).toBeGreaterThan(vehicle.y + 10);
  expect(after.fuel).toBeLessThan(vehicle.fuel);
  await page.evaluate(() => (window as any).__bacoliTest.enterVehicle());
  expect(await page.evaluate(() => (window as any).__bacoliDebug().driving)).toBeNull();
});

test('negli interni il giocatore cammina e interagisce con gli arredi', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliDebug === 'function');
  await page.evaluate(() => {
    const world = (window as any).__bacoli.scene.getScene('World');
    world.scene.launch('Interior', {
      kind: 'home', name: 'Casa', returnX: 5656, returnY: 6928,
    });
    world.scene.pause();
  });
  await expect(page.locator('#hud-panel')).toHaveClass(/open/);
  const before = await page.evaluate(() => {
    const room = (window as any).__bacoli.scene.getScene('Interior');
    return { x: room.player.x, y: room.player.y, furniture: room.furniture.length };
  });
  expect(before.furniture).toBeGreaterThan(5);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyA');
  const after = await page.evaluate(() => {
    const room = (window as any).__bacoli.scene.getScene('Interior');
    return { x: room.player.x, y: room.player.y };
  });
  expect(after.x).toBeLessThan(before.x - 20);
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});

test('i viaggi EAV usano i biglietti e le fermate sospese sono escluse', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  const reachable = await page.evaluate(() => (window as any).__bacoliTest.reachable());
  expect(reachable).toContain('baia_station');
  expect(reachable).not.toContain('cuma_station');
  await page.evaluate(() => (window as any).__bacoliTest.giveTickets());
  await page.evaluate(() => (window as any).__bacoliTest.travel('baia_station'));
  await page.waitForTimeout(200);
  const lastTrip = await page.evaluate(() => (window as any).__bacoliTest.lastTrip());
  expect(lastTrip).toContain('Baia');
});
