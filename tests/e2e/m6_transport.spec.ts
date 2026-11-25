import { expect, test } from '@playwright/test';

const ALERT_TITLES = [
  'Circumflegrea: servizio regolare sospeso oltre Licola',
  'Cumana: Baia riaperta dal 6 novembre 2025',
  'Bus 144/145: collegamento di supporto alle linee flegree',
];

test('M6 trasporti: fermate OSM, quadro EAV e stazioni sospese', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => {
    const d = (window as any).__bacoliDebug?.();
    return d && !d.loading && typeof (window as any).__bacoliTest === 'object';
  });

  const worldInfo = await page.evaluate(() => {
    const d = (window as any).__bacoliDebug();
    const world = (window as any).__bacoli.scene.getScene('World');
    const stops = world.region.places
      .filter((place: { kind: string }) => place.kind === 'bus_stop')
      .map((place: { name: string; source?: string }) => ({ name: place.name, source: place.source }));
    return { stops, count: d.busStops, alerts: d.alerts };
  });
  expect(worldInfo.stops.length, 'fermate bus OSM nel centro').toBeGreaterThanOrEqual(6);
  expect(worldInfo.stops.every((stop) => stop.source?.includes('OSM node highway=bus_stop'))).toBe(true);
  expect(worldInfo.count, 'fermate posizionate sul marciapiede').toBeGreaterThan(0);
  expect(worldInfo.alerts).toHaveLength(3);
  expect(worldInfo.alerts).toEqual(expect.arrayContaining([
    'circumflegrea-licola-torregaveta',
    'cumana-baia-riaperta',
    'bus-144-145-supporto',
  ]));

  // Il telefono mostra sempre il quadro completo, con i pertinenti in cima.
  await page.keyboard.press('KeyT');
  await expect(page.locator('#hud-panel')).toHaveClass(/open/);
  const phoneText = await page.locator('#hud-panel').innerText();
  expect(phoneText).toContain('Avvisi EAV');
  for (const title of ALERT_TITLES) expect(phoneText).toContain(title);
  await page.locator('#hud-panel button', { hasText: 'Circumflegrea: servizio regolare sospeso' }).click();
  await expect(page.locator('#hud-panel h2')).toHaveText(ALERT_TITLES[0]);
  expect(await page.locator('#hud-panel').innerText()).toContain('Dal 2014 non circolano treni regolari');
  await page.locator('#hud-panel button', { hasText: 'Ho capito' }).click();

  const suspended = await page.evaluate(() => {
    const test = (window as any).__bacoliTest;
    test.giveTickets();
    return {
      reachable: test.reachable(),
      baia: test.tripLine('baia_station'),
      cuma: test.tripLine('cuma_station'),
      lido: test.tripLine('lido_fusaro'),
    };
  });
  expect(suspended.reachable).toContain('baia_station');
  expect(suspended.reachable).not.toContain('cuma_station');
  expect(suspended.reachable).not.toContain('lido_fusaro');
  expect(suspended.baia).toBe('bus_101');
  expect(suspended.cuma).toBeNull();
  expect(suspended.lido).toBeNull();

  await page.evaluate(() => (window as any).__bacoliTest.travel('cuma_station'));
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => typeof (window as any).__bacoliTransit)).toBe('undefined');

  // I binari sono solo sulle stazioni ferroviarie attive; nessun treno
  // attraversa l'asfalto o le strade del mondo.
  const switched = await page.evaluate(() => (window as any).__bacoliTest.setRegion('torregaveta'));
  expect(switched).toBe(true);
  await page.waitForFunction(() => {
    const d = (window as any).__bacoliDebug?.();
    return d && !d.loading && d.region === 'torregaveta';
  });
  const rails = await page.evaluate(() => {
    const d = (window as any).__bacoliDebug();
    return { rails: d.rails, trains: d.trainSprites };
  });
  expect(rails.rails.some((rail: { id: string }) => rail.id === 'torregaveta')).toBe(true);
  for (const train of rails.trains) {
    expect(
      rails.rails.some((rail: { x: number; y: number }) =>
        Math.hypot(rail.x - train.x, rail.y - train.y) < 12),
      `treno fuori binario in ${JSON.stringify(train)}`,
    ).toBe(true);
  }

  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});
