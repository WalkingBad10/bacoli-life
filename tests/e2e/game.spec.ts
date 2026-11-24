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

test('i viaggi EAV sono animati con interni, passeggeri e paesaggio mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  await page.evaluate(() => {
    (window as any).__bacoliTest.teleport(194 * 16 + 8, 257 * 16 + 16);
    (window as any).__bacoliTest.giveTickets();
  });
  const origin = await page.evaluate(() => (window as any).__bacoliTest.origin());
  const line = await page.evaluate(() => (window as any).__bacoliTest.tripLine('baia_station'));
  expect(origin).toBe('fusaro_station');
  expect(line).toBe('cumana');
  await page.evaluate(() => (window as any).__bacoliTest.travel('baia_station'));
  await page.waitForFunction(() => typeof (window as any).__bacoliTransit === 'object');

  const first = await page.evaluate(() => ({
    progress: (window as any).__bacoliTransit.progress(),
    sceneryX: (window as any).__bacoliTransit.sceneryX(),
    passengers: (window as any).__bacoliTransit.passengers(),
    line: (window as any).__bacoliTransit.line(),
  }));
  expect(first.line).toBe('cumana');
  expect(first.passengers).toBeGreaterThanOrEqual(4);
  await page.waitForTimeout(700);
  const second = await page.evaluate(() => ({
    progress: (window as any).__bacoliTransit.progress(),
    sceneryX: (window as any).__bacoliTransit.sceneryX(),
    minutes: (window as any).__bacoliTransit.minutes(),
  }));
  expect(second.progress).toBeGreaterThan(first.progress);
  expect(second.sceneryX).toBeGreaterThan(first.sceneryX);
  expect(second.minutes).toBeGreaterThan(0);

  await page.evaluate(() => (window as any).__bacoliTransit.complete());
  await page.waitForFunction(() => (window as any).__bacoli.scene.getScene('World').scene.isActive());
  const destination = await page.evaluate(() => (window as any).__bacoliTest.player());
  expect(Math.hypot(destination.x - 4296, destination.y - 4096)).toBeLessThan(140);
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});

test('adozione di un animale: sprite, follow e persistenza', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  await page.evaluate(() => (window as any).__bacoliTest.adopt('dog'));

  const adopted = await page.evaluate(() => (window as any).__bacoliTest.state());
  expect(adopted.pets).toHaveLength(1);
  const pet = adopted.pets[0];
  expect(pet.species).toBe('dog');
  // Si sposta il giocatore verso una piazzola libera e con percorso senza muri:
  // l'animale deve seguirlo senza attraversare ostacoli solidi.
  const target = await page.evaluate((p) => {
    const test = (window as any).__bacoliTest;
    const offsets: [number, number][] = [];
    for (const axis of ['x', 'y']) {
      for (const direction of [1, -1]) {
        for (const distance of [48, 64, 80, 96, 112, 128, 160]) {
          offsets.push(axis === 'x'
            ? [direction * distance, 0] : [0, direction * distance]);
        }
      }
    }
    for (const [dx, dy] of offsets) {
      const length = Math.max(Math.abs(dx), Math.abs(dy));
      let clear = true;
      for (let step = 8; step <= length; step += 8) {
        const t = step / length;
        if (!test.canStand(p.x + dx * t, p.y + dy * t, 6)) { clear = false; break; }
      }
      if (!clear || !test.canStand(p.x + dx, p.y + dy, 6)) continue;
      test.teleport(p.x + dx, p.y + dy);
      return { dx, dy };
    }
    return null;
  }, pet);
  expect(target, 'Nessun percorso libero per il test del follow').not.toBeNull();
  await page.waitForTimeout(700);
  const followed = await page.evaluate(() => (window as any).__bacoliTest.state().pets[0]);
  const movedX = followed.x - pet.x;
  const movedY = followed.y - pet.y;
  expect(Math.hypot(movedX, movedY)).toBeGreaterThan(5);
  expect(movedX * target!.dx + movedY * target!.dy).toBeGreaterThan(0);
  expect(await page.evaluate(
    (p) => (window as any).__bacoliTest.canStand(p.x, p.y, 4), followed,
  )).toBe(true);

  await page.screenshot({ path: `screenshots/pet-${test.info().project.name}.png` });
  await page.locator('#hud-save').click();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  const reloaded = await page.evaluate(() => (window as any).__bacoliTest.state());
  expect(reloaded.pets).toHaveLength(1);
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});

test('matrimonio con un NPC persiste dopo il reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  await page.evaluate(() => {
    (window as any).__bacoliTest.giveMoney(30_000);
    (window as any).__bacoliTest.buyHome();
    (window as any).__bacoliTest.setAffinity('Maria', 30);
    (window as any).__bacoliTest.propose('Maria');
  });
  const married = await page.evaluate(() => (window as any).__bacoliTest.state());
  expect(married.spouse).toBe('Maria');
  expect(married.family.some((m: { name: string }) => m.name === 'Maria')).toBe(true);
  await page.locator('#hud-save').click();
  await page.waitForTimeout(300);
  await page.reload();
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  expect(await page.evaluate(() => (window as any).__bacoliTest.state().spouse)).toBe('Maria');
});

test('tagliando in officina aggiorna condizione e denaro', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  await page.evaluate(() => (window as any).__bacoliTest.damage());
  const before = await page.evaluate(() => ({
    condition: (window as any).__bacoliTest.state().condition,
    money: (window as any).__bacoliTest.money(),
  }));
  expect(before.condition).toBe(40);
  await page.evaluate(() => (window as any).__bacoliTest.service());
  const after = await page.evaluate(() => ({
    condition: (window as any).__bacoliTest.state().condition,
    money: (window as any).__bacoliTest.money(),
  }));
  expect(after.condition).toBe(100);
  expect(after.money).toBeCloseTo(before.money - 65, 2);
});

test('nel bar si beve il caffè e si occupa un posto a sedere', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliDebug === 'function');
  await page.evaluate(() => {
    (window as any).__bacoliTest.giveItem('caffe', 2);
    const world = (window as any).__bacoli.scene.getScene('World');
    world.scene.launch('Interior', {
      kind: 'cafe', name: 'Bar Pina', returnX: 1280, returnY: 1296,
    });
    world.scene.pause();
  });
  await expect(page.locator('#hud-panel')).toHaveClass(/open/);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(120);
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(200);
  const inside = await page.evaluate(() => {
    const room = (window as any).__bacoli.scene.getScene('Interior');
    return {
      caffe: room.state.inventory.caffe ?? 0,
      occupied: Object.values(room.seats).some((s: any) => s.occupiedBy === 'player'),
    };
  });
  expect(inside.caffe).toBe(1);
  expect(inside.occupied).toBe(true);
  await page.screenshot({ path: `screenshots/cafe-${test.info().project.name}.png` });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const released = await page.evaluate(() => {
    const room = (window as any).__bacoli.scene.getScene('Interior');
    return Object.values(room.seats).every((s: any) => s.occupiedBy === null);
  });
  expect(released).toBe(true);
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});

