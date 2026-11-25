import { expect, test } from '@playwright/test';

interface Case {
  label: string;
  placeId?: string;
  kind: string;
  name: string;
  template: string;
  action: string;
  regionId?: string;
  floors?: number;
  facadeWidth?: number;
  staff: boolean;
}

// Ogni caso usa un luogo reale del dataset quando disponibile: la stanza deve
// ereditare placeId, regione, piani e larghezza dell'impronta OSM.
const CASES: Case[] = [
  {
    label: 'albergo da edificio OSM', placeId: 'place-lago_miseno-195',
    kind: 'home', name: 'Domus Fortunae B&B', template: 'hotel',
    action: 'Check-in', regionId: 'lago_miseno', floors: 3, facadeWidth: 256, staff: true,
  },
  {
    label: 'lido da spiaggia OSM', placeId: 'place-baia-743',
    kind: 'beach', name: 'Spiaggia Villa Ferretti', template: 'lido',
    action: 'Prendersole', regionId: 'baia', staff: true,
  },
  {
    label: 'stazione da fermata bus OSM', placeId: 'place-245',
    kind: 'bus_stop', name: 'Fermata · Bacoli - Via Roma, 137', template: 'station',
    action: 'Biglietti', regionId: 'centro', staff: true,
  },
  {
    label: 'distributore OSM', placeId: 'place-torregaveta-449',
    kind: 'fuel', name: 'IP', template: 'fuel',
    action: 'Ricevimento', regionId: 'torregaveta', staff: true,
  },
  {
    label: 'chiesa OSM', placeId: 'place-151',
    kind: 'home', name: 'Chiesa di San Gioacchino', template: 'church',
    action: 'Prega', regionId: 'centro', floors: 1, facadeWidth: 672, staff: false,
  },
  {
    label: 'banca OSM', placeId: 'place-fusaro-699',
    kind: 'bank', name: 'Banco di Napoli', template: 'bank',
    action: 'Sportello', regionId: 'fusaro', floors: 2, facadeWidth: 176, staff: true,
  },
  {
    label: 'tabaccheria senza edificio OSM',
    kind: 'shop', name: 'Tabaccheria Centrale', template: 'tobacco',
    action: 'Giornali', staff: true,
  },
];

test('interni M6: template data-driven da luoghi OSM reali', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });
  await page.waitForFunction(() => typeof (window as any).__bacoliTest === 'object');

  for (const item of CASES) {
    await page.evaluate((entry) => {
      const world = (window as any).__bacoli.scene.getScene('World');
      world.scene.launch('Interior', {
        kind: entry.kind, name: entry.name,
        returnX: 1280, returnY: 1296,
        placeId: entry.placeId, regionId: entry.regionId,
        floors: entry.floors, facadeWidth: entry.facadeWidth,
      });
      world.scene.pause();
    }, item);

    await page.waitForFunction(
      (template) => {
        const interior = (window as any).__bacoli?.scene.getScene('Interior');
        return Boolean(interior?.scene.isActive()) && interior.template === template;
      },
      item.template,
      { timeout: 10_000 },
    );
    const info = await page.evaluate(() => {
      const interior = (window as any).__bacoli.scene.getScene('Interior');
      return {
        template: interior.template,
        placeId: interior.placeData?.id ?? interior.data2?.placeId ?? null,
        regionId: interior.data2?.regionId ?? null,
        floors: interior.placeData?.floors ?? interior.data2?.floors ?? null,
        facadeWidth: interior.placeData?.facadeWidth ?? interior.data2?.facadeWidth ?? null,
        furniture: interior.furniture.map((entry: { action: string }) => entry.action),
        staff: Boolean(interior.staff),
      };
    });
    expect(info.template, item.label).toBe(item.template);
    expect(info.furniture, item.label).toContain(item.action);
    expect(info.staff, item.label).toBe(item.staff);
    if (item.placeId) expect(info.placeId, item.label).toBe(item.placeId);
    if (item.regionId) expect(info.regionId, item.label).toBe(item.regionId);
    if (item.floors) expect(info.floors, item.label).toBe(item.floors);
    if (item.facadeWidth) expect(info.facadeWidth, item.label).toBe(item.facadeWidth);

    await page.evaluate(() => {
      const interior = (window as any).__bacoli.scene.getScene('Interior');
      interior.exit();
    });
    await page.waitForTimeout(80);
  }

  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});

test('interni M6: salvataggi v4 conservati attraverso ingresso e uscita', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  await page.goto('/');
  await expect(page.locator('#game canvas')).toBeVisible({ timeout: 20_000 });

  const payload = {
    player: {
      x: 5192, y: 7656, money: 777, savings: 25, energy: 88, hunger: 91,
      job: null, homeId: 'home-1',
    },
    inventory: { biglietto_bus: 2, biglietto_treno: 1 },
    relationships: {}, time: 600, day: 4, weather: 'sun',
    home: { owned: true, address: 'Via Ortensio 12', furniture: ['bed'], upgrades: [] },
    family: [], vehicles: [], jobState: null,
    transport: { ticketBus: 0, ticketTrain: 0, monthlyPass: false, lastTrip: null },
    stats: { distanceWalked: 0, distanceDriven: 0, npcsMet: 0 },
    social: { bonds: {}, spouseId: null, marriedOnDay: null },
    pets: [],
    career: {
      level: 3, xp: 5, shifts: 2, promotions: 1,
      lastPayDay: 1, unpaidWage: 0, totalEarned: 40,
    },
    activeHomeId: 'home-1', businesses: [], deliveries: [], events: [],
    regionId: 'centro',
  };

  // Envelope v4 reale: checksum FNV-1a e base64 come in SaveSystem.encodeExport.
  await page.evaluate((state) => {
    const checksum = (input: string) => {
      let hash = 0x811c9dc5;
      for (let i = 0; i < input.length; i++) {
        hash ^= input.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash.toString(16).padStart(8, '0');
    };
    const envelope = { version: 4, checksum: '', payload: state };
    envelope.checksum = checksum(JSON.stringify(envelope.payload));
    const bytes = new TextEncoder().encode(JSON.stringify(envelope));
    let binary = '';
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    localStorage.setItem('bacoli-life:save', btoa(binary));
  }, payload);

  await page.reload();
  await page.waitForFunction(() => {
    const d = (window as any).__bacoliDebug?.();
    return d && !d.loading && typeof (window as any).__bacoliTest === 'object';
  });
  const loaded = await page.evaluate(() => ({
    money: (window as any).__bacoliTest.money(),
    state: (window as any).__bacoliTest.state(),
    careerLevel: (window as any).__bacoliDebug().careerLevel,
  }));
  expect(loaded.money).toBe(777);
  expect(loaded.state.day).toBe(4);
  expect(loaded.state.inventory.biglietto_bus).toBe(2);
  expect(loaded.careerLevel).toBe(3);

  await page.evaluate(() => {
    const world = (window as any).__bacoli.scene.getScene('World');
    world.scene.launch('Interior', {
      kind: 'home', name: 'Casa di Via Ortensio', returnX: 5192, returnY: 7656,
      placeId: 'home-1', regionId: 'centro', floors: 2, facadeWidth: 256,
    });
    world.scene.pause();
  });
  await page.waitForTimeout(400);
  const inside = await page.evaluate(() => {
    const interior = (window as any).__bacoli.scene.getScene('Interior');
    return interior.furniture.map((entry: { action: string }) => entry.action);
  });
  expect(inside).toContain('Dormi');
  await page.evaluate(() => {
    const interior = (window as any).__bacoli.scene.getScene('Interior');
    interior.exit();
  });
  await page.waitForTimeout(200);
  await page.reload();
  await page.waitForFunction(() => {
    const d = (window as any).__bacoliDebug?.();
    return d && !d.loading && typeof (window as any).__bacoliTest === 'object';
  });
  const after = await page.evaluate(() => ({
    money: (window as any).__bacoliTest.money(),
    day: (window as any).__bacoliTest.state().day,
    level: (window as any).__bacoliDebug().careerLevel,
  }));
  expect(after).toEqual({ money: 777, day: 4, level: 3 });
  expect(errors, `Errori: ${errors.join(' | ')}`).toEqual([]);
});
