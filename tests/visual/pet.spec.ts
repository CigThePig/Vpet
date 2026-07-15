import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoState, collectConsoleErrors } from './helpers';

/**
 * Behavioural tests for the petting interaction. The stroke tests use the
 * real pointer path (mouse down → strokes → up) — they must never shortcut
 * by mutating application state directly.
 */

const petZone = (page: Page) => page.getByRole('button', { name: 'Pet Sprig' });
const creature = (page: Page) => page.locator('.creature');

/** Centre of the pettable area. */
async function zoneCenter(page: Page): Promise<{ x: number; y: number }> {
  const box = await petZone(page).boundingBox();
  expect(box, 'the pet zone must be on screen').not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

/** One gentle left-right stroke across Sprig, starting from pointer-down. */
async function stroke(page: Page, c: { x: number; y: number }) {
  await page.mouse.move(c.x - 55, c.y, { steps: 6 });
  await page.mouse.move(c.x + 55, c.y, { steps: 6 });
}

test.describe('petting Sprig', () => {
  test('activating Care makes Sprig pettable and hopeful', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await gotoState(page, '?state=idle');
    await expect(petZone(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Care' }).click();
    await expect(petZone(page)).toHaveCount(1);
    await expect(page.getByRole('status')).toContainText(/hoping to be petted/i);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-ready');
    // Sprig is the interaction; the pettable area receives focus directly.
    await expect(petZone(page)).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('the pettable area generously exceeds the 44px touch-target minimum', async ({ page }) => {
    await gotoState(page, '?state=pet-ready');
    const box = await petZone(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('stroking Sprig melts it into bliss exactly once, then Care ends', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await gotoState(page, '?state=pet-ready');
    const c = await zoneCenter(page);

    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-stroking');

    // Keep stroking until Sprig has had enough.
    for (let i = 0; i < 4; i += 1) await stroke(page, c);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-bliss');
    await expect(page.getByRole('status')).toContainText(/melts into the petting/i);
    await expect(petZone(page)).toHaveCount(0);

    // A stray release afterwards changes nothing, and Care mode winds down.
    await page.mouse.up();
    await expect(creature(page)).toHaveAttribute('data-reaction', 'none', { timeout: 4000 });
    await expect(page.getByRole('button', { name: 'Care' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(petZone(page)).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('Sprig leans toward the stroking hand', async ({ page }) => {
    await gotoState(page, '?state=pet-ready');
    const c = await zoneCenter(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    // One short stroke to the left edge: not enough for bliss, but Sprig
    // should visibly lean that way (--pet-x < 0 on the anchor).
    await page.mouse.move(c.x - 60, c.y, { steps: 6 });
    const lean = await page
      .locator('.creature-anchor')
      .evaluate((el) => parseFloat(el.style.getPropertyValue('--pet-x')));
    expect(lean).toBeLessThan(0);
    // Lifting the hand rests back to hopeful and clears the lean.
    await page.mouse.up();
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-ready');
    const cleared = await page
      .locator('.creature-anchor')
      .evaluate((el) => el.style.getPropertyValue('--pet-x'));
    expect(cleared).toBe('');
  });

  test('short strokes add up across presses within one Care session', async ({ page }) => {
    await gotoState(page, '?state=pet-ready');
    const c = await zoneCenter(page);
    // Two separate half-sessions of stroking reach bliss together.
    for (let round = 0; round < 2; round += 1) {
      await page.mouse.move(c.x, c.y);
      await page.mouse.down();
      await stroke(page, c);
      await stroke(page, c);
      await page.mouse.up();
      if (round === 0) {
        await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-ready');
      }
    }
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-bliss');
  });

  test('keyboard: Enter pats Sprig into the same bliss', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await gotoState(page, '?state=idle');
    await page.getByRole('button', { name: 'Care' }).focus();
    await page.keyboard.press('Enter');
    await expect(petZone(page)).toBeFocused();
    // Focus stays visible on the pettable area.
    const outline = await petZone(page).evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-stroking');
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-bliss', { timeout: 2000 });
    await expect(page.getByRole('status')).toContainText(/melts into the petting/i);
    // When the pettable area goes, focus lands somewhere sensible: Care.
    await expect(page.getByRole('button', { name: 'Care' })).toBeFocused();
    await expect(creature(page)).toHaveAttribute('data-reaction', 'none', { timeout: 4000 });
    await expect(page.getByRole('button', { name: 'Care' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(errors).toEqual([]);
  });

  test('Escape on the pettable area settles Sprig and restores focus', async ({ page }) => {
    await gotoState(page, '?state=idle');
    await page.getByRole('button', { name: 'Care' }).focus();
    await page.keyboard.press('Enter');
    await expect(petZone(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(petZone(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Care' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Care' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(page.getByRole('status')).toContainText(/settles back down/i);
  });

  test('Escape during a stroke rests the hand; nothing gets stuck', async ({ page }) => {
    await gotoState(page, '?state=pet-ready');
    const c = await zoneCenter(page);
    await page.mouse.move(c.x, c.y);
    await page.mouse.down();
    await page.mouse.move(c.x - 40, c.y, { steps: 4 });
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-stroking');
    await page.keyboard.press('Escape');
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-ready');
    // The stray pointer-up afterwards must not re-trigger anything.
    await page.mouse.up();
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-ready');
    await expect(petZone(page)).toHaveCount(1);
  });

  test('activating another category while petting settles Sprig', async ({ page }) => {
    await gotoState(page, '?state=pet-ready');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(petZone(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('Feed and Care swap cleanly: one world object at a time', async ({ page }) => {
    await gotoState(page, '?state=feed-ready');
    await page.getByRole('button', { name: 'Care' }).click();
    await expect(page.getByRole('button', { name: 'Give snack to Sprig' })).toHaveCount(0);
    await expect(petZone(page)).toHaveCount(1);
    await page.getByRole('button', { name: 'Feed' }).click();
    await expect(petZone(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Give snack to Sprig' })).toHaveCount(1);
  });

  test('reduced motion: petting still reads and completes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoState(page, '?state=idle&motion=reduced');
    await page.getByRole('button', { name: 'Care' }).click();
    await expect(petZone(page)).toBeVisible();
    await petZone(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText(/melts into the petting/i, {
      timeout: 2000,
    });
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-bliss');
    await expect(creature(page)).toHaveAttribute('data-reaction', 'none', { timeout: 4000 });
  });

  test('pet fixtures render deterministically without console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    for (const state of ['pet-ready', 'pet-stroking', 'pet-bliss']) {
      await gotoState(page, `?state=${state}`);
      await expect(page.getByRole('button', { name: 'Care' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    // Fixture-initialized phases must hold still (no timers auto-advance):
    // fixture bliss never ends Care by itself.
    await gotoState(page, '?state=pet-bliss');
    await page.waitForTimeout(900);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-bliss');
    await gotoState(page, '?state=pet-stroking');
    await page.waitForTimeout(900);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'pet-stroking');
    expect(errors).toEqual([]);
  });
});
