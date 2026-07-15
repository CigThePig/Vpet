#!/usr/bin/env node
/**
 * Record motion evidence for the petting interaction into ux/motion/.
 *
 * Sibling of capture-motion.mjs (the feeding drag): performs the REAL
 * pointer interaction (Care on → press → strokes → bliss → Care ends, plus
 * a keyboard pat) against the dev server and produces two artifacts:
 *
 *   ux/motion/pet-strokes.webm     — Playwright-recorded video of the run
 *   ux/motion/pet-filmstrip.png    — labelled key frames, one image
 *
 * ux/motion/ is git-ignored: regenerate with `npm run ux:motion:pet` and
 * open both files whenever the interaction changes. The run drives live
 * pointer events, so exact pixels vary slightly between runs — this is
 * evidence for human/agent review, not a regression baseline.
 */
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'ux', 'motion');
const framesDir = path.join(outDir, 'pet-frames');
const viewport = { width: 393, height: 851 };

await rm(framesDir, { recursive: true, force: true });
await rm(path.join(outDir, 'pet-strokes.webm'), { force: true });
await rm(path.join(outDir, 'pet-filmstrip.png'), { force: true });
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

// 1. Activate Care — Sprig perks up, hoping for the hand.
await page.getByRole('button', { name: 'Care' }).click();
await page.waitForTimeout(450);
await frame('1-hopeful', 'Care active — Sprig hopes for the hand');

// 2. The hand comes down: the stroke begins, eyes close.
const zone = await page.getByRole('button', { name: 'Pet Sprig' }).boundingBox();
const c = { x: zone.x + zone.width / 2, y: zone.y + zone.height / 2 };
await page.mouse.move(c.x, c.y);
await page.mouse.down();
await page.waitForTimeout(300);
await frame('2-stroke-begins', 'Pressed — eyes close, blush deepens');

// 3. Stroke left: Sprig leans into the hand.
await page.mouse.move(c.x - 55, c.y, { steps: 8 });
await page.waitForTimeout(250);
await frame('3-lean-left', 'Stroking left — Sprig leans that way');

// 4. Stroke right.
await page.mouse.move(c.x + 55, c.y, { steps: 8 });
await page.waitForTimeout(250);
await frame('4-lean-right', 'Stroking right — following the hand');

// 5. A rest between strokes: hopeful again.
await page.mouse.up();
await page.waitForTimeout(350);
await frame('5-rest', 'Hand lifted — hopeful for more');

// 6. Keep stroking until Sprig has had enough.
await page.mouse.move(c.x, c.y);
await page.mouse.down();
for (let i = 0; i < 4; i += 1) {
  await page.mouse.move(c.x - 55, c.y, { steps: 6 });
  await page.mouse.move(c.x + 55, c.y, { steps: 6 });
}
await page.mouse.up();
await page.waitForTimeout(400);
await frame('6-bliss', 'Enough petting — bliss, wiggle, hearts');

// 7. Care mode winds down by itself.
await page.waitForTimeout(2200);
await frame('7-settled', 'Care over — Sprig back to calm');

// 8. The keyboard path: one pat melts Sprig the same way.
await page.getByRole('button', { name: 'Care' }).focus();
await page.keyboard.press('Enter');
await page.waitForTimeout(350);
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
await frame('8-pat', 'Keyboard pat — savoured before bliss');
await page.waitForTimeout(700);
await frame('9-pat-bliss', 'The pat lands — same bliss as stroking');

await page.close();
const video = await page.video().path();
await context.close();
await rename(video, path.join(outDir, 'pet-strokes.webm'));

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
<h1>Petting interaction — key frames (real pointer drive, ${new Date().toISOString()})</h1>
<main>${cells.join('\n')}</main>`;

const sheetPage = await browser.newPage({
  viewport: { width: 1800, height: 900 },
  deviceScaleFactor: 2,
});
await sheetPage.setContent(html, { waitUntil: 'load' });
await sheetPage.screenshot({ path: path.join(outDir, 'pet-filmstrip.png'), fullPage: true });
await browser.close();
await server.close();

if (errors.length > 0) {
  console.error(`Console errors during the run:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
console.log('Motion evidence written:');
console.log('  ux/motion/pet-strokes.webm    (video of the real strokes)');
console.log('  ux/motion/pet-filmstrip.png   (labelled key frames)');
