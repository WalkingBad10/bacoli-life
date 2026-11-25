import { expect, test } from '@playwright/test';

const DIRECTIONS = [
  { key: 'KeyW', anim: 'walk-up-player', axis: 'y', sign: -1 },
  { key: 'KeyA', anim: 'walk-left-player', axis: 'x', sign: -1 },
  { key: 'KeyS', anim: 'walk-down-player', axis: 'y', sign: 1 },
  { key: 'KeyD', anim: 'walk-right-player', axis: 'x', sign: 1 },
] as const;

test('M6 attori: ombre ai piedi, depth by feet e WASD nelle quattro direzioni', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');
  await page.waitForTimeout(700);

  const initial = await page.evaluate(() => (window as any).__bacoliDebug());
  // Pedoni e animali sono solidi condivisi: nessuna coppia può sovrapporsi.
  const walkers = initial.actors.filter((actor: { id: string }) =>
    !actor.id.startsWith('traffic-'));
  for (let i = 0; i < walkers.length; i++) {
    for (let j = i + 1; j < walkers.length; j++) {
      const a = walkers[i];
      const b = walkers[j];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      expect(distance, `${a.id}/${b.id} sovrapposti`).toBeGreaterThanOrEqual(a.radius + b.radius - 0.5);
    }
  }

  // Ogni ombra coincide con il punto di contatto, non con la testa dello sprite.
  for (const id of ['player', ...initial.npcs.map((_: unknown, index: number) => `npc-${index}`)]) {
    const actor = initial.actors.find((item: { id: string }) => item.id === id);
    const shadow = initial.shadows.find((item: { id: string }) => item.id === id);
    expect(actor && shadow, `ombra mancante per ${id}`).toBeTruthy();
    expect(shadow.x).toBeCloseTo(actor.x, 1);
    expect(shadow.y).toBeCloseTo(actor.y - 1, 1);
    expect(shadow.depth).toBeCloseTo(actor.y - 1, 1);
  }

  // Cerca una piazzola con 32 px liberi in tutte le direzioni, così il test
  // verifica la mappatura dei tasti e non un muro che blocca il passo.
  const spot = await page.evaluate(() => {
    const test = (window as any).__bacoliTest;
    const world = (window as any).__bacoli.scene.getScene('World');
    // Tutti gli altri attori restano ostacoli: la piazzola deve essere libera
    // anche di veicoli, non solo di muri.
    const ignore = ['player'];
    for (let ty = 4; ty < world.height - 4; ty++) {
      for (let tx = 4; tx < world.width - 4; tx++) {
        const x = tx * 16 + 8;
        const y = ty * 16 + 16;
        const clear = [[32, 0], [-32, 0], [0, 32], [0, -32]].every(([dx, dy]) => {
          for (let step = 8; step <= 32; step += 8) {
            if (!test.canStand(x + dx * step / 32, y + dy * step / 32, 5, ignore)) return false;
          }
          return true;
        });
        if (clear) return { x, y };
      }
    }
    return null;
  });
  expect(spot, 'nessuna piazzola libera per il test WASD').not.toBeNull();
  await page.evaluate((target) => (window as any).__bacoliTest.teleport(target.x, target.y), spot);

  for (const direction of DIRECTIONS) {
    const before = await page.evaluate(() => (window as any).__bacoliDebug().player);
    await page.keyboard.down(direction.key);
    await page.waitForTimeout(230);
    const during = await page.evaluate(() => (window as any).__bacoliDebug());
    await page.keyboard.up(direction.key);
    expect(during.playerAnim, direction.key).toBe(direction.anim);
    expect(
      direction.sign * (during.player[direction.axis] - before[direction.axis]),
      `${direction.key} da ${JSON.stringify(before)} a ${JSON.stringify(during.player)}`,
    ).toBeGreaterThan(1);
    expect(during.playerDepth).toBeCloseTo(during.player.y, 1);
    const shadow = during.shadows.find((item: { id: string }) => item.id === 'player');
    expect(shadow.x).toBeCloseTo(during.player.x, 1);
    expect(shadow.y).toBeCloseTo(during.player.y - 1, 1);
  }

  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});
