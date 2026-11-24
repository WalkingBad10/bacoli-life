import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'https://walkingbad10.github.io/bacoli-life/';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(url, { waitUntil: 'networkidle' });
await page.locator('#game canvas').waitFor({ timeout: 20_000 });
await page.waitForTimeout(2000);
const state = await page.evaluate(() => ({
  clock: document.getElementById('hud-clock')?.textContent,
  places: (window).__bacoliDebug?.().places ?? null,
}));
console.log(JSON.stringify({ url, state, errors }, null, 2));
await browser.close();
process.exit(errors.length ? 1 : 0);
