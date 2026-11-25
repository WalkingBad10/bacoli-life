import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:4173/rebuild2.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.__rebuild2?.ready === true, null, { timeout: 120000 });
await page.waitForTimeout(1000);
for (const [key, label] of [['ArrowUp', 'nord'], ['ArrowRight', 'est'], ['ArrowDown', 'sud'], ['ArrowLeft', 'ovest']]) {
  const before = await page.evaluate(() => ({ ...window.__rebuild2.player }));
  await page.keyboard.down(key);
  const samples = [];
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(100);
    samples.push(await page.evaluate(() => ({ ...window.__rebuild2.player, bx: window.__rebuild2.blockedX, by: window.__rebuild2.blockedY })));
  }
  await page.keyboard.up(key);
  const after = samples[samples.length - 1];
  console.log(label, JSON.stringify({ before, after, delta: { x: after.x - before.x, y: after.y - before.y }, samples }));
}
await browser.close();
