#!/usr/bin/env node
/**
 * Combine the latest ux/current/ screenshots into one labelled contact sheet
 * at ux/reports/contact-sheet.png.
 *
 * No native image library is needed: the sheet is laid out as an HTML grid
 * (images embedded as data URIs) and rendered to PNG by the same Chromium
 * that produced the screenshots. Images are displayed at half their pixel
 * size and the sheet is captured at deviceScaleFactor 2, so the output keeps
 * the original screenshot resolution.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const currentDir = path.join(root, 'ux', 'current');
const reportDir = path.join(root, 'ux', 'reports');

let manifest;
try {
  manifest = JSON.parse(await readFile(path.join(currentDir, 'manifest.json'), 'utf8'));
} catch {
  console.error('No ux/current/manifest.json — run `npm run ux:capture` first.');
  process.exit(1);
}

const cells = [];
for (const entry of manifest) {
  const png = await readFile(path.join(currentDir, entry.file));
  // Captured at deviceScaleFactor 2 → display at CSS-pixel (half) size.
  const cssWidth = Math.round(entry.viewport.width);
  cells.push(`
    <figure>
      <figcaption>${entry.label ?? entry.name}<span>${entry.query}</span></figcaption>
      <img src="data:image/png;base64,${png.toString('base64')}" style="width:${cssWidth}px" alt="" />
    </figure>`);
}

const html = `<!doctype html>
<meta charset="utf-8">
<style>
  body { margin: 0; padding: 28px; background: #101414; color: #e8e2d2;
         font: 13px/1.4 system-ui, sans-serif; }
  h1 { font-size: 17px; margin: 0 0 4px; }
  p.meta { margin: 0 0 20px; color: #9aa695; }
  main { display: flex; flex-wrap: wrap; gap: 22px; align-items: flex-start; }
  figure { margin: 0; }
  figcaption { margin-bottom: 6px; font-weight: 600; }
  figcaption span { display: block; font-weight: 400; color: #9aa695;
                    font-family: ui-monospace, monospace; font-size: 11px; }
  img { display: block; border-radius: 10px; outline: 1px solid #2c3833; }
</style>
<h1>Vpet — visual contact sheet</h1>
<p class="meta">${manifest.length} states · captured ${manifest[0]?.capturedAt ?? ''}</p>
<main>${cells.join('\n')}</main>`;

await mkdir(reportDir, { recursive: true });
await writeFile(path.join(reportDir, 'contact-sheet.html'), html);

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1500, height: 1000 },
  deviceScaleFactor: 2,
});
await page.setContent(html, { waitUntil: 'load' });
const out = path.join(reportDir, 'contact-sheet.png');
await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log(`Contact sheet written to ${path.relative(root, out)}`);
