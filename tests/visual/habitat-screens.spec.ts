import { test, expect } from '@playwright/test';
import scenarios from './scenarios.json' with { type: 'json' };
import { gotoState, collectConsoleErrors } from './helpers';

/**
 * Visual regression: every deterministic scenario is compared against its
 * approved baseline in ux/baseline/. Update baselines deliberately with
 * `npm run test:visual:update` (see docs/visual-testing.md).
 */
for (const scenario of scenarios) {
  test(`screenshot: ${scenario.name}`, async ({ page }) => {
    const errors = collectConsoleErrors(page);
    await page.setViewportSize(scenario.viewport);
    if ('reducedMotion' in scenario && scenario.reducedMotion) {
      await page.emulateMedia({ reducedMotion: 'reduce' });
    }
    await gotoState(page, scenario.query);
    await expect(page).toHaveScreenshot(`${scenario.name}.png`);
    expect(errors, 'no console errors while rendering').toEqual([]);
  });
}
