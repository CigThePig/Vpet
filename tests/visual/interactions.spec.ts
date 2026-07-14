import { test, expect } from '@playwright/test';
import { gotoState, collectConsoleErrors } from './helpers';

test.describe('care tray', () => {
  test('buttons respond visually and announce a message', async ({ page }) => {
    await gotoState(page, '?state=idle');
    const feed = page.getByRole('button', { name: 'Feed' });
    await expect(feed).toHaveAttribute('aria-pressed', 'false');

    await feed.click();
    await expect(feed).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('status')).toContainText(/snack/i);

    // Tapping again releases the category.
    await feed.click();
    await expect(feed).toHaveAttribute('aria-pressed', 'false');
  });

  test('all main controls have accessible names', async ({ page }) => {
    await gotoState(page, '?state=idle');
    for (const name of ['Feed', 'Care', 'Play', 'Room', 'Journal and settings']) {
      await expect(page.getByRole('button', { name })).toBeVisible();
    }
    await expect(page.getByRole('navigation', { name: 'Care actions' })).toBeVisible();
  });

  test('every interactive control meets the 44px touch-target minimum', async ({ page }) => {
    await gotoState(page, '?state=idle');
    const buttons = await page.locator('button').all();
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box, 'button must be visible').not.toBeNull();
      expect(box!.width, 'touch target width').toBeGreaterThanOrEqual(44);
      expect(box!.height, 'touch target height').toBeGreaterThanOrEqual(44);
    }
  });

  test('keyboard focus reaches the tray and stays visible', async ({ page }) => {
    await gotoState(page, '?state=idle');
    await page.keyboard.press('Tab');
    const first = page.locator(':focus');
    await expect(first).toHaveAccessibleName(/journal|feed/i);
    // Focus outline is applied via :focus-visible; verify it computes to a
    // real outline rather than being suppressed.
    const outlineStyle = await first.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outlineStyle).not.toBe('none');
  });
});

test.describe('dev state system', () => {
  test('?state=night switches the habitat to night', async ({ page }) => {
    await gotoState(page, '?state=night');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-time', 'night');
  });

  test('?state=care-tray pre-activates the feed category', async ({ page }) => {
    await gotoState(page, '?state=care-tray');
    await expect(page.getByRole('button', { name: 'Feed' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('?motion=reduced forces the reduced-motion attribute', async ({ page }) => {
    await gotoState(page, '?state=idle&motion=reduced');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-motion', 'reduced');
  });

  test('OS-level reduced motion stops ambient animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await gotoState(page, '?state=idle');
    const duration = await page
      .locator('.mote')
      .first()
      .evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeLessThanOrEqual(0.001);
  });

  test('?dev=1 shows the dev panel, plain URLs hide it', async ({ page }) => {
    await gotoState(page, '?dev=1');
    await expect(
      page.getByRole('complementary', { name: 'Development state panel' }),
    ).toBeVisible();
    await gotoState(page, '');
    await expect(page.getByRole('complementary', { name: 'Development state panel' })).toHaveCount(
      0,
    );
  });

  test('unknown state falls back to idle without errors', async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await gotoState(page, '?state=bogus');
    await expect(page.locator('.app-shell')).toHaveAttribute('data-time', 'day');
    expect(errors).toEqual([]);
  });
});
