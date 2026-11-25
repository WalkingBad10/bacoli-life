import { expect, test, type Page } from '@playwright/test';

interface RebuildHook {
  ready: boolean;
  player: { x: number; y: number };
  blockedX: boolean;
  blockedY: boolean;
  blockedFrames: number;
  vehicles: Array<{ x: number; y: number; angle: number; frame: string; bus: boolean; onDrivableLane: boolean }>;
  buildings: number;
  props: number;
  npcPathNodes: number;
  playerScalePx: number;
  carScalePx: number;
  busScalePx: number;
  insideBuilding: boolean;
  debugVisible: boolean;
  visibleText: string[];
}

declare global {
  interface Window {
    __rebuild2?: RebuildHook;
  }
}

async function openPreview(page: Page): Promise<string[]> {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console: ${message.text()}`);
  });
  page.on('pageerror', (error) => errors.push(`page: ${String(error)}`));
  await page.goto('/rebuild2.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__rebuild2?.ready === true, null, { timeout: 120_000 });
  await page.waitForTimeout(800);
  return errors;
}

async function hook(page: Page): Promise<RebuildHook> {
  return page.evaluate(() => window.__rebuild2 as RebuildHook);
}

async function walk(page: Page, key: string, durationMs: number) {
  const samples: Array<{ x: number; y: number; t: number }> = [];
  const start = await page.evaluate(() => ({
    x: window.__rebuild2!.player.x,
    y: window.__rebuild2!.player.y,
    t: performance.now(),
  }));
  samples.push(start);
  await page.keyboard.down(key);
  const deadline = Date.now() + durationMs;
  while (Date.now() < deadline) {
    await page.waitForTimeout(80);
    samples.push(await page.evaluate(() => ({
      x: window.__rebuild2!.player.x,
      y: window.__rebuild2!.player.y,
      t: performance.now(),
    })));
  }
  await page.keyboard.up(key);
  return samples;
}

function expectContinuous(samples: Array<{ x: number; y: number; t: number }>, axis: 'x' | 'y', sign: number) {
  expect(samples.length).toBeGreaterThanOrEqual(4);
  for (let i = 1; i < samples.length; i++) {
    const previous = samples[i - 1];
    const current = samples[i];
    const delta = (current[axis] - previous[axis]) * sign;
    const elapsed = Math.max(1, current.t - previous.t);
    // 92 px/s è la velocità dichiarata; 1.6 tollera il frame delta e il polling.
    expect(delta).toBeGreaterThanOrEqual(-3);
    expect(delta).toBeLessThanOrEqual(92 * (elapsed / 1000) * 1.6 + 3);
  }
}

test.describe('REBUILD 2.0 — anteprima separata', () => {
  test('carica dati reali, proporzioni e zero errori', async ({ page }) => {
    const errors = await openPreview(page);
    const state = await hook(page);
    expect(state.ready).toBe(true);
    expect(state.buildings).toBe(353);
    expect(state.props).toBeGreaterThanOrEqual(40);
    expect(state.vehicles.length).toBe(4);
    expect(state.npcPathNodes).toBeGreaterThan(0);
    expect(state.playerScalePx).toBe(28);
    expect(state.carScalePx).toBe(64);
    expect(state.busScalePx).toBe(176);
    expect(state.insideBuilding).toBe(false);
    expect(state.visibleText.join(' ')).not.toMatch(/BAR|PIZZERIA|CASA|MARKER/);
    for (const vehicle of state.vehicles) {
      expect(vehicle.onDrivableLane).toBe(true);
      expect(Number.isFinite(vehicle.angle)).toBe(true);
    }
    expect(state.vehicles.some((vehicle) => vehicle.bus && Math.abs(vehicle.angle) > 0.01)).toBe(true);
    expect(state.vehicles.some((vehicle) => !vehicle.bus && Math.abs(vehicle.angle) > 0.01)).toBe(true);
    expect(errors).toEqual([]);
  });

  test('cammina nelle quattro direzioni senza teletrasporti in una sessione continua', async ({ page }) => {
    const errors = await openPreview(page);
    const initial = await hook(page);
    const directions = [
      { key: 'ArrowUp', axis: 'y' as const, sign: -1 },
      { key: 'ArrowRight', axis: 'x' as const, sign: 1 },
      { key: 'ArrowDown', axis: 'y' as const, sign: 1 },
      { key: 'ArrowLeft', axis: 'x' as const, sign: -1 },
    ];
    for (const direction of directions) {
      const samples = await walk(page, direction.key, 700);
      expectContinuous(samples, direction.axis, direction.sign);
      const net = (samples[samples.length - 1][direction.axis] - samples[0][direction.axis]) * direction.sign;
      expect(net, `spostamento ${direction.key}`).toBeGreaterThan(20);
    }
    const final = await hook(page);
    expect(final.buildings).toBe(initial.buildings);
    expect(final.vehicles.length).toBe(initial.vehicles.length);
    expect(final.insideBuilding).toBe(false);
    expect(errors).toEqual([]);
  });

  test('F1 mostra hitbox solo su richiesta e non modifica la simulazione', async ({ page }) => {
    await openPreview(page);
    const before = await hook(page);
    await page.keyboard.press('F1');
    await page.waitForTimeout(250);
    const shown = await hook(page);
    expect(shown.debugVisible).toBe(true);
    expect(shown.buildings).toBe(before.buildings);
    expect(shown.vehicles.length).toBe(before.vehicles.length);
    await page.keyboard.press('F1');
    await page.waitForTimeout(250);
    expect((await hook(page)).debugVisible).toBe(false);
  });
});
