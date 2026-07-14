#!/usr/bin/env node
/**
 * Record motion evidence for the feeding interaction into ux/motion/.
 *
 * Static screenshots cannot show how the drag feels, so this script performs
 * the REAL pointer interaction (grab → carry → hover near Sprig → release →
 * eating → satisfied) against the dev server and produces two artifacts:
 *
 *   ux/motion/feed-drag.webm       — Playwright-recorded video of the run
 *   ux/motion/feed-filmstrip.png   — labelled key frames, one image
 *
 * The filmstrip is rendered with the same HTML-grid trick as the contact
 * sheet (no native image dependency). ux/motion/ is git-ignored: regenerate
 * with `npm run ux:motion` and open both files whenever the interaction
 * changes. The run drives live pointer events, so exact pixels vary slightly
 * between runs — this is evidence for human/agent review, not a regression
 * baseline.
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'ux', 'motion');
const framesDir = path.join(outDir, 'frames');
const viewport = { width: 393, height: 851 };

await rm(outDir, { recursive: true, force: true });
await mkdir(framesDir, { recursive: true });

const server = await createServer({ root, server: { port: 0 }, logLevel: 'error' });
await server.listen();
const baseUrl = server.resolvedUrls.local[0];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport,
  deviceScaleFactor: 2,
  hasTouch: true,
  recordVideo: { dir: outDir, size: viewport },
});
const page = await context.newPage();
const errors = [];
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(String(e)));

await page.goto(new URL('?state=idle', baseUrl).href, { waitUntil: 'load' });
await page.locator('html[data-app-ready="true"]').waitFor({ state: 'attached' });

const frames = [];
async function frame(name, label) {
  const file = path.join(framesDir, `${name}.png`);
  await page.screenshot({ path: file });
  frames.push({ file, label });
}

const center = async (selector) => {
  const box = await page.locator(selector).boundingBox();
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

// 1. Activate Feed — the snack arrives.
await page.getByRole('button', { name: 'Feed' }).click();
await page.waitForTimeout(450);
await frame('1-ready', 'Feed active — snack resting');

// 2. Grab.
const snack = await center('.snack');
const sprig = await center('.creature-anchor');
await page.mouse.move(snack.x, snack.y);
await page.mouse.down();
await page.waitForTimeout(200);
await frame('2-grabbed', 'Grabbed — lift + Sprig notices');

// 3. Carry it in a soft arc.
await page.mouse.move((snack.x + sprig.x) / 2, snack.y - 110, { steps: 14 });
await page.waitForTimeout(120);
await frame('3-carry', 'Carried — eyes track the snack');

// 4. Hover near Sprig — anticipation.
await page.mouse.move(sprig.x, sprig.y - 10, { steps: 14 });
await page.waitForTimeout(300);
await frame('4-near', 'Near — Sprig leans in, mouth open');

// 5. Release — eating.
await page.mouse.up();
await page.waitForTimeout(400);
await frame('5-eating', 'Released — munching, cheeks puffed');

// 6. Satisfied.
await page.waitForTimeout(1300);
await frame('6-satisfied', 'Satisfied — happy sway + crumbs');

// 7. A missed drop for the return path.
await page.waitForTimeout(1700);
await page.getByRole('button', { name: 'Feed' }).click();
await page.waitForTimeout(400);
const snack2 = await center('.snack');
await page.mouse.move(snack2.x, snack2.y);
await page.mouse.down();
await page.mouse.move(snack2.x + 90, snack2.y - 250, { steps: 12 });
await page.mouse.up();
await page.waitForTimeout(180);
await frame('7-missed', 'Missed drop — rolling back gently');
await page.waitForTimeout(600);
await frame('8-recovered', 'Recovered — ready to try again');

await page.close();
const video = await page.video().path();
await context.close();
await rename(video, path.join(outDir, 'feed-drag.webm'));

// ---- Filmstrip -------------------------------------------------------------
const cells = [];
for (const f of frames) {
  const png = await readFile(f.file);
  cells.push(`
    <figure>
      <figcaption>${f.label}</figcaption>
      <img src="data:image/png;base64,${png.toString('base64')}" style="width:${Math.round(viewport.width / 2)}px" alt="" />
    </figure>`);
}
const html = `<!doctype html>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 24px; background: #101414; color: #e8e2d2;
         font: 13px/1.4 system-ui, sans-serif; }
  h1 { font-size: 16px; margin: 0 0 16px; }
  main { display: flex; flex-wrap: wrap; gap: 16px; align-items: flex-start; }
  figure { margin: 0; }
  figcaption { margin-bottom: 6px; font-weight: 600; max-width: ${Math.round(viewport.width / 2)}px; }
  img { display: block; border-radius: 8px; outline: 1px solid #2c3833; }
</style>
<h1>Feeding interaction — key frames (real pointer drive, ${new Date().toISOString()})</h1>
<main>${cells.join('\n')}</main>`;

const sheetPage = await browser.newPage({
  viewport: { width: 1800, height: 900 },
  deviceScaleFactor: 2,
});
await sheetPage.setContent(html, { waitUntil: 'load' });
await sheetPage.screenshot({ path: path.join(outDir, 'feed-filmstrip.png'), fullPage: true });
await browser.close();
await server.close();

if (errors.length > 0) {
  console.error(`Console errors during the run:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('Motion evidence written:');
console.log('  ux/motion/feed-drag.webm      (video of the real drag)');
console.log('  ux/motion/feed-filmstrip.png  (labelled key frames)');
