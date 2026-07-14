import type { Page } from '@playwright/test';

/**
 * Navigate to a deterministic app state and wait for the explicit
 * screenshot-ready signal (html[data-app-ready="true"], set by the app after
 * its first painted frame).
 */
export async function gotoState(page: Page, query: string): Promise<void> {
  await page.goto(`/${query}`);
  await page.locator('html[data-app-ready="true"]').waitFor({ state: 'attached' });
}

/** Collect console errors and page crashes for the lifetime of the page. */
export function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => {
    errors.push(String(error));
  });
  return errors;
}
