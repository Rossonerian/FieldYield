import { expect, test } from '@playwright/test';

test('mobile authentication layout is usable without horizontal overflow', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.width);
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await expect(page.getByLabel('Date of birth')).toBeVisible();
});
