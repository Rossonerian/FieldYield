import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('register, trade, refresh account flows, and log out', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign Up' }).click();
  await page.getByLabel('Username').fill('e2e_user');
  await page.getByLabel('Date of birth').fill('1990-01-01');
  await page.getByLabel('Email').fill('e2e@example.com');
  await page.getByLabel('Password').fill('StrongPass1');
  await page.locator('form').getByRole('button', { name: 'Sign Up', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.evaluate(async () => {
    const token = window.localStorage.getItem('fieldyield.localAuthToken');
    const response = await fetch('http://127.0.0.1:8000/api/v1/wallet/credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currency: 'gold', amount: 1000, idempotency_key: 'e2e-credit' }),
    });
    if (!response.ok) throw new Error(`Credit failed: ${response.status}`);
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await page.getByRole('button', { name: /open currency balances/i }).click();
  const walletDialog = page.getByRole('dialog', { name: 'Wallet' });
  await expect(walletDialog).toBeVisible();
  await walletDialog.getByRole('button', { name: 'Close dialog' }).click();

  const search = page.getByRole('combobox');
  await search.fill('Review Dividends');
  await page.getByRole('option', { name: /Review Dividends/ }).click();
  const dividendDialog = page.getByRole('dialog', { name: 'Dividend Feed' });
  await expect(dividendDialog).toBeVisible();
  await dividendDialog.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Markets' }).last().click();
  await page.getByRole('button', { name: 'Buy' }).click();
  await page.getByRole('button', { name: 'Confirm Buy' }).click();
  await expect(page.getByText(/authoritative total/i)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  const retry = await page.evaluate(async () => {
    const token = window.localStorage.getItem('fieldyield.localAuthToken');
    const submit = () => fetch('http://127.0.0.1:8000/api/v1/trading/orders/market-buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ symbol: 'HA9', quantity: 1, idempotency_key: 'e2e-lost-response-retry' }),
    }).then(async (response) => {
      if (!response.ok) throw new Error(`Retry trade failed: ${response.status}`);
      return response.json() as Promise<{ id: number }>;
    });
    return [await submit(), await submit()];
  });
  expect(retry[0].id).toBe(retry[1].id);

  await page.getByRole('button', { name: 'Open Asset' }).click();
  await expect(page.getByRole('heading', { name: 'E2E Player' })).toBeVisible();
  await search.click();
  await search.fill('Add to Watchlist');
  await page.getByRole('option', { name: /Add to Watchlist/ }).click();
  await page.getByRole('button', { name: 'Watchlist' }).last().click();
  await expect(page.getByText('E2E Player')).toBeVisible();
  await page.getByRole('button', { name: 'Remove E2E Player from watchlist' }).click();
  await expect(page.getByText('Your watchlist is empty')).toBeVisible();

  await page.getByRole('button', { name: 'Squad' }).last().click();
  await page.getByRole('button', { name: 'Move to Active' }).click();
  await expect(page.getByRole('status')).toContainText('moved to Active');
  await page.reload();
  await page.getByRole('button', { name: 'Squad' }).last().click();
  await expect(page.getByText('Active', { exact: true })).toBeVisible();
  const reserveButton = page.getByRole('button', { name: 'Hold to move E2E Player to reserve' });
  await reserveButton.focus();
  await page.keyboard.down('Enter');
  await page.waitForTimeout(1_000);
  await page.keyboard.up('Enter');
  await expect(page.getByRole('status')).toContainText('moved to Reserve');
  await page.reload();
  await page.getByRole('button', { name: 'Squad' }).last().click();
  await expect(page.getByRole('button', { name: 'Move to Active' })).toBeVisible();

  await page.getByRole('button', { name: /open notifications/i }).click();
  const unreadNotifications = page.getByRole('button', { name: /Buy 1 E2E Player/ });
  const unreadBefore = await unreadNotifications.count();
  expect(unreadBefore).toBeGreaterThan(0);
  await unreadNotifications.first().click();
  await expect(unreadNotifications).toHaveCount(unreadBefore - 1);
  await page.getByRole('button', { name: 'Close notifications' }).click();

  await page.getByRole('button', { name: 'Markets' }).last().click();
  await page.getByRole('button', { name: 'Open Asset' }).click();
  await page.getByRole('button', { name: 'Sell' }).first().click();
  await page.getByRole('button', { name: 'Review Sell' }).click();
  const sellDialog = page.getByRole('dialog', { name: 'Confirm Sell' });
  await sellDialog.getByLabel('Shares').fill('2');
  await page.getByRole('button', { name: 'Confirm Sell' }).click();
  await expect(page.getByText(/authoritative total/i)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Portfolio' }).last().click();
  await expect(page.getByText('Realized P/L from closed trades:')).toBeVisible();
  await expect(page.getByText('-4.00')).toBeVisible();
  await expect(page.getByText('Your portfolio is empty')).toBeVisible();

  await page.getByRole('button', { name: /open profile/i }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('keyboard login view has no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Login', exact: true }).first()).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')).toEqual([]);
});
