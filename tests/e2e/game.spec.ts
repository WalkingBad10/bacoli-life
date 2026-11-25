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
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(300);
  // Lascia al pannello aperto da E il tempo di chiudersi prima di aprire
  // lo smartphone: su Android emulato il caricamento iniziale è più lento.
  await page.waitForTimeout(250);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  // Su Android emulato il primo input può arrivare prima che la HUD sia
  // completamente pronta: riprova senza mai ri-chiudere un pannello già aperto.
  for (let attempt = 0; attempt < 6; attempt++) {
    const className = (await page.locator('#hud-panel').getAttribute('class')) ?? '';
    if (/open/.test(className)) break;
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(300);
  }
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
  await page.waitForTimeout(900);
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
    // La nuova mappa metrica copre il centro storico: la fermata locale è
    // Bacoli centro, collegata a Baia dalla linea EAV 101.
    (window as any).__bacoliTest.giveTickets();
  });
  const origin = await page.evaluate(() => (window as any).__bacoliTest.origin());
  const line = await page.evaluate(() => (window as any).__bacoliTest.tripLine('baia_station'));
  expect(origin).toBe('bacoli_centro');
  expect(line).toBe('bus_101');
  await page.evaluate(() => (window as any).__bacoliTest.travel('baia_station'));
  await page.waitForFunction(() => typeof (window as any).__bacoliTransit === 'object');

  const first = await page.evaluate(() => ({
    progress: (window as any).__bacoliTransit.progress(),
    sceneryX: (window as any).__bacoliTransit.sceneryX(),
    passengers: (window as any).__bacoliTransit.passengers(),
    line: (window as any).__bacoliTransit.line(),
  }));
  expect(first.line).toBe('bus_101');
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
    // I pedoni sono ostacoli reali: il test cerca una corsia libera dagli
    // altri attori, non una corsia vuota di gente.
    const ignored = [
      p.id, `pet-${p.id}`, 'player',
      ...(window as any).__bacoliDebug().actors
        .filter((actor: { id: string }) => actor.id.startsWith('npc-'))
        .map((actor: { id: string }) => actor.id),
    ];
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
        if (!test.canStand(p.x + dx * t, p.y + dy * t, 6, ignored)) {
          clear = false;
          break;
        }
      }
      if (!clear || !test.canStand(p.x + dx, p.y + dy, 6, ignored)) continue;
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
    (p) => (window as any).__bacoliTest.canStand(p.x, p.y, 4, [`pet-${p.id}`, p.id]),
    followed,
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

test('la scala universale è rispettata da personaggi, edifici e veicoli', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');

  const scale = await page.evaluate(() => {
    const world = (window as any).__bacoli.scene.getScene('World');
    const find = (prefix: string) => world.children.list.find((item: any) =>
      typeof item.texture?.key === 'string' && item.texture.key.startsWith(prefix));
    const player = world.player;
    const building = find('building_');
    const roof = find('roof_');
    const car = find('car_');
    const bus = world.children.list.find((item: any) => item.texture?.key === 'bus');
    return {
      playerFrame: { width: player.width, height: player.height },
      building: building && {
        key: building.texture.key,
        width: building.width,
        height: building.height,
        scaleX: building.scaleX,
        scaleY: building.scaleY,
      },
      roof: roof && { width: roof.width, height: roof.height },
      car: car && { width: car.width, height: car.height },
      bus: bus && { width: bus.width, height: bus.height },
      tileWidth: world.map?.tileWidth,
      mapWidth: world.width,
      mapHeight: world.height,
    };
  });

  expect(scale.playerFrame).toEqual({ width: 16, height: 32 });
  expect(scale.tileWidth).toBe(16);
  expect(scale.mapWidth).toBe(463);
  expect(scale.mapHeight).toBe(722);
  expect(scale.building).not.toBeNull();
  expect(scale.building!.scaleX).toBe(1);
  expect(scale.building!.scaleY).toBe(1);
  expect([...Array.from({ length: 23 }, (_, i) => 96 + i * 16),
    480, 512, 544, 576, 608, 640, 672, 704, 768, 832, 896, 960, 1024, 1088,
  ]).toContain(scale.building!.width);
  // CORNICE 4 px + 52 px per piano: il palazzo è sempre molto più alto
  // del riquadro del personaggio (16x32), senza alcuno stiramento.
  expect(scale.building!.height).toBeGreaterThanOrEqual(56);
  expect(scale.building!.height).toBeLessThanOrEqual(212);
  expect(scale.roof!.height).toBe(24);
  expect(scale.car).toEqual({ width: 72, height: 40 });
  expect(scale.bus).toEqual({ width: 192, height: 52 });
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});

test('il debug mostra griglia, collisioni e impronte senza bloccare il gioco', async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  expect(await page.evaluate(() => (window as any).__bacoliTest.debugOverlay())).toBe(false);

  await page.keyboard.press('KeyG');
  await page.waitForTimeout(150);
  const overlay = await page.evaluate(() => {
    const world = (window as any).__bacoli.scene.getScene('World');
    const graphics = world.children.list.find((item: any) =>
      item.type === 'Graphics' && item.depth === 1_000_000);
    const label = world.children.list.find((item: any) =>
      item.type === 'Text' && item.depth === 1_000_001);
    return {
      active: (window as any).__bacoliTest.debugOverlay(),
      graphicsVisible: graphics?.visible ?? false,
      labelVisible: label?.visible ?? false,
      label: label?.text ?? '',
    };
  });
  expect(overlay.active).toBe(true);
  expect(overlay.graphicsVisible).toBe(true);
  expect(overlay.labelVisible).toBe(true);
  expect(overlay.label).toContain('1m=16px');
  expect(overlay.label).toContain('solidi');
  await page.screenshot({ path: `screenshots/debug-scale-${testInfo.project.name}.png` });

  await page.keyboard.press('KeyG');
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).__bacoliTest.debugOverlay())).toBe(false);
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});

