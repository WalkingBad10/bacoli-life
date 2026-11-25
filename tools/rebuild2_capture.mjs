import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://127.0.0.1:4173/rebuild2.html';
const out = process.argv[3] ?? 'docs/rebuild2/audit/rebuild2_preview.png';
mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
page.on('pageerror', (error) => errors.push(`page: ${error.stack ?? String(error)}`));

await page.goto(url, { waitUntil: 'load' });
let hook = null;
try {
  await page.waitForFunction(() => window.__rebuild2?.ready === true, null, { timeout: 120000 });
  await page.waitForTimeout(3500);
  hook = await page.evaluate(() => window.__rebuild2);
} catch (error) {
  errors.push(`wait: ${String(error)}`);
}
await page.screenshot({ path: out });
console.log(JSON.stringify({ url, out, hook, errors }, null, 2));
await browser.close();
