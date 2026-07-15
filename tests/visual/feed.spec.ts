import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { gotoState, collectConsoleErrors } from './helpers';

/**
 * Behavioural tests for the feeding interaction. The drag tests use the real
 * pointer path (mouse down → move → up) — they must never shortcut by
 * mutating application state directly.
 */

const snackButton = (page: Page) => page.getByRole('button', { name: 'Give snack to Sprig' });
const creature = (page: Page) => page.locator('.creature');

/** Centre of a locator's bounding box. */
async function centerOf(page: Page, selector: string): Promise<{ x: number; y: number }> {
  const box = await page.locator(selector).boundingBox();
  expect(box, `${selector} must be on screen`).not.toBeNull();
  return { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 };
}

test.describe('feeding Sprig', () => {
  test('activating Feed produces one snack as a world object', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await gotoState(page, '?state=idle');
    await expect(snackButton(page)).toHaveCount(0);

    await page.getByRole('button', { name: 'Feed' }).click();
    await expect(snackButton(page)).toHaveCount(1);
    await expect(snackButton(page)).toBeVisible();
    await expect(page.getByRole('status')).toContainText(/snack is ready/i);
    // Sprig notices it; the snack receives focus as the next logical target.
    await expect(creature(page)).toHaveAttribute('data-reaction', 'notice');
    await expect(snackButton(page)).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('the snack meets the 44px touch-target minimum', async ({ page }) => {
    await gotoState(page, '?state=feed-ready');
    const box = await snackButton(page).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test('dragging the snack to Sprig feeds it exactly once', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    const failedRequests: string[] = [];
    page.on('requestfailed', (request) => failedRequests.push(request.url()));

    await gotoState(page, '?state=feed-ready');
    const snack = await centerOf(page, '.snack');
    const sprig = await centerOf(page, '.creature-anchor');

    await page.mouse.move(snack.x, snack.y);
    await page.mouse.down();
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'held');

    // Partway there: still carried, and the snack stays under the pointer.
    const mid = { x: (snack.x + sprig.x) / 2, y: snack.y - 90 };
    await page.mouse.move(mid.x, mid.y, { steps: 8 });
    const midBox = await page.locator('.snack').boundingBox();
    expect(Math.abs(midBox!.x + midBox!.width / 2 - mid.x)).toBeLessThan(4);
    expect(Math.abs(midBox!.y + midBox!.height / 2 - mid.y)).toBeLessThan(4);

    // Over Sprig: anticipation.
    await page.mouse.move(sprig.x, sprig.y, { steps: 10 });
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'held-near');
    await expect(creature(page)).toHaveAttribute('data-reaction', 'anticipate');

    await page.mouse.up();
    // The snack is consumed, Sprig eats then looks satisfied, feed mode ends.
    await expect(snackButton(page)).toHaveCount(0);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'eating');
    await expect(page.getByRole('status')).toContainText(/eats the snack/i);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'satisfied', { timeout: 3000 });
    await expect(creature(page)).toHaveAttribute('data-reaction', 'none', { timeout: 4000 });
    await expect(page.getByRole('button', { name: 'Feed' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    // No second feeding happened: the snack did not respawn.
    await expect(snackButton(page)).toHaveCount(0);
    expect(errors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });

  test('a released snack drops, tumbles, and rests where it lands', async ({ page }) => {
    await gotoState(page, '?state=feed-ready');
    const snack = await centerOf(page, '.snack');

    await page.mouse.move(snack.x, snack.y);
    await page.mouse.down();
    // Carry it up and to the left, away from Sprig, and let go.
    await page.mouse.move(snack.x - 30, snack.y - 280, { steps: 8 });
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'held');
    await page.mouse.up();

    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'falling');
    await expect(page.getByRole('status')).toContainText(/tumbles/i);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'missed');
    // The berry is a physical thing: it lands on the floor plane and STAYS
    // there — no teleporting back to its original spot.
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'ready', { timeout: 4000 });
    const settled = await centerOf(page, '.snack');
    expect(Math.abs(settled.y - snack.y)).toBeLessThan(8); // back on the floor plane
    await expect(page.getByRole('button', { name: 'Feed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // …and it can be picked up again from its new spot and fed for real.
    const sprig = await centerOf(page, '.creature-anchor');
    await page.mouse.move(settled.x, settled.y);
    await page.mouse.down();
    await page.mouse.move(sprig.x, sprig.y, { steps: 10 });
    await page.mouse.up();
    await expect(creature(page)).toHaveAttribute('data-reaction', 'eating');
  });

  test('a berry set down at Sprig’s feet gets gobbled off the floor', async ({ page }) => {
    await gotoState(page, '?state=feed-ready');
    const snack = await centerOf(page, '.snack');
    const anchor = await page.locator('.creature-anchor').boundingBox();

    await page.mouse.move(snack.x, snack.y);
    await page.mouse.down();
    // Set it down low, right in front of Sprig — below the mouth zone.
    await page.mouse.move(anchor!.x + anchor!.width / 2 - 15, anchor!.y + anchor!.height - 12, {
      steps: 12,
    });
    await page.mouse.up();

    await expect(creature(page)).toHaveAttribute('data-reaction', 'gobbling', { timeout: 3000 });
    await expect(page.getByRole('status')).toContainText(/eats the snack/i);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'satisfied', { timeout: 4000 });
    await expect(page.getByRole('button', { name: 'Feed' })).toHaveAttribute(
      'aria-pressed',
      'false',
      { timeout: 4000 },
    );
  });

  test('a berry dropped on Sprig’s head perches, then gets shaken off', async ({ page }) => {
    await gotoState(page, '?state=feed-ready');
    const snack = await centerOf(page, '.snack');
    const anchor = await page.locator('.creature-anchor').boundingBox();

    await page.mouse.move(snack.x, snack.y);
    await page.mouse.down();
    await page.mouse.move(anchor!.x + anchor!.width / 2, anchor!.y + anchor!.height * 0.16, {
      steps: 12,
    });
    await page.mouse.up();

    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'perched');
    await expect(creature(page)).toHaveAttribute('data-reaction', 'perched');
    await expect(page.getByRole('status')).toContainText(/balances/i);
    // Sprig shakes it off after a moment; it tumbles and comes to rest.
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'falling', {
      timeout: 4000,
    });
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'ready', { timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Feed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('waggling the berry in Sprig’s face earns a cheek-puff pout', async ({ page }) => {
    await gotoState(page, '?state=feed-ready');
    const snack = await centerOf(page, '.snack');
    const anchor = await page.locator('.creature-anchor').boundingBox();
    const fx = anchor!.x + anchor!.width / 2;
    const fy = anchor!.y + anchor!.height * 0.4;

    await page.mouse.move(snack.x, snack.y);
    await page.mouse.down();
    await page.mouse.move(fx - 55, fy, { steps: 6 });
    for (let i = 0; i < 4; i += 1) {
      await page.mouse.move(fx - 15, fy, { steps: 4 });
      await page.mouse.move(fx - 70, fy, { steps: 4 });
    }
    await expect(creature(page)).toHaveAttribute('data-reaction', 'teased');
    // Teasing doesn't break feeding: give it to Sprig anyway.
    await page.mouse.move(fx, fy, { steps: 6 });
    await page.mouse.up();
    await expect(creature(page)).toHaveAttribute('data-reaction', 'eating');
  });

  test('Sprig reaches hopefully for a berry left resting on the floor', async ({ page }) => {
    test.slow(); // the yearning loop waits a few seconds by design
    await gotoState(page, '?state=idle');
    await page.getByRole('button', { name: 'Feed' }).click();
    await expect(snackButton(page)).toBeVisible();
    await expect(creature(page)).toHaveAttribute('data-reaction', 'yearning', { timeout: 6000 });
    await expect(page.getByText(/reaches hopefully/i)).toBeAttached();
    // …and settles back to simply noticing it.
    await expect(creature(page)).toHaveAttribute('data-reaction', 'notice', { timeout: 4000 });
  });

  test('keyboard: Enter on the snack feeds Sprig with the same result', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await gotoState(page, '?state=idle');
    // Activate Feed from the keyboard.
    await page.getByRole('button', { name: 'Feed' }).focus();
    await page.keyboard.press('Enter');
    await expect(snackButton(page)).toBeFocused();
    // Focus stays visible on the snack.
    const outline = await snackButton(page).evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outline).not.toBe('none');

    await page.keyboard.press('Enter');
    await expect(creature(page)).toHaveAttribute('data-reaction', 'anticipate');
    await expect(creature(page)).toHaveAttribute('data-reaction', 'eating', { timeout: 2000 });
    await expect(page.getByRole('status')).toContainText(/eats the snack/i);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'satisfied', { timeout: 3000 });
    // When the snack goes, focus lands somewhere sensible: the Feed button.
    await expect(page.getByRole('button', { name: 'Feed' })).toBeFocused();
    await expect(creature(page)).toHaveAttribute('data-reaction', 'none', { timeout: 4000 });
    expect(errors).toEqual([]);
  });

  test('Escape during a drag drops the berry safely; nothing gets stuck', async ({ page }) => {
    await gotoState(page, '?state=feed-ready');
    const snack = await centerOf(page, '.snack');
    await page.mouse.move(snack.x, snack.y);
    await page.mouse.down();
    await page.mouse.move(snack.x - 40, snack.y - 160, { steps: 6 });
    await page.keyboard.press('Escape');

    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'falling');
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'ready', { timeout: 4000 });
    // The stray pointer-up afterwards must not re-trigger anything.
    await page.mouse.up();
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'ready');
    await expect(creature(page)).toHaveAttribute('data-reaction', 'notice');
  });

  test('Escape on the resting snack puts it away and restores focus', async ({ page }) => {
    await gotoState(page, '?state=idle');
    await page.getByRole('button', { name: 'Feed' }).focus();
    await page.keyboard.press('Enter');
    await expect(snackButton(page)).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(snackButton(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Feed' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Feed' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  test('activating another category while the snack is out puts it away', async ({ page }) => {
    await gotoState(page, '?state=feed-ready');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect(snackButton(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Play' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('reduced motion: feeding still reads and completes', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoState(page, '?state=idle&motion=reduced');
    await page.getByRole('button', { name: 'Feed' }).click();
    await expect(snackButton(page)).toBeVisible();
    // The snack's idle bob must be suppressed.
    const duration = await page
      .locator('.snack-berry')
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);

    // A drop resolves instantly instead of animating a tumble.
    const snack = await centerOf(page, '.snack');
    await page.mouse.move(snack.x, snack.y);
    await page.mouse.down();
    await page.mouse.move(snack.x - 30, snack.y - 200, { steps: 6 });
    await page.mouse.up();
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'ready', { timeout: 1000 });

    await snackButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('status')).toContainText(/eats the snack/i, { timeout: 2000 });
    await expect(creature(page)).toHaveAttribute('data-reaction', 'satisfied', { timeout: 3000 });
    await expect(creature(page)).toHaveAttribute('data-reaction', 'none', { timeout: 4000 });
  });

  test('feed fixtures render deterministically without console errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    for (const state of [
      'feed-ready',
      'feed-hover',
      'feed-eaten',
      'feed-perched',
      'feed-gobbling',
      'feed-teased',
      'feed-yearning',
    ]) {
      await gotoState(page, `?state=${state}`);
      await expect(page.getByRole('button', { name: 'Feed' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    // Fixture-initialized phases must hold still (no timers auto-advance):
    // a fixture-perched berry is never shaken off, a fixture-yearning reach
    // never clears.
    await gotoState(page, '?state=feed-perched');
    await page.waitForTimeout(900);
    await expect(page.locator('.snack')).toHaveAttribute('data-phase', 'perched');
    await gotoState(page, '?state=feed-yearning');
    await page.waitForTimeout(900);
    await expect(creature(page)).toHaveAttribute('data-reaction', 'yearning');
    expect(errors).toEqual([]);
  });
});
