import { test, expect, type Page } from '@playwright/test';

/**
 * Add / move / remove a device through the UI.
 * Initial layout: 2U server at U1-U2, 1U switch at U3.
 */

const inventory = (page: Page) => page.getByRole('list', { name: 'Installed hardware' });
const rows = (page: Page) => inventory(page).getByRole('listitem');
const firewallRow = (page: Page) => rows(page).filter({ hasText: /firewall/i });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(rows(page)).toHaveCount(2);
});

test('add a device from the catalogue into the lowest free slot', async ({ page }) => {
  await page.getByRole('button', { name: /Firewall Appliance 1U/i }).click();
  await expect(rows(page)).toHaveCount(3);
  await expect(firewallRow(page)).toContainText('U4');
});

test('move a device up one U', async ({ page }) => {
  await page.getByRole('button', { name: /Firewall Appliance 1U/i }).click();
  await firewallRow(page).click();
  await page.getByRole('button', { name: 'Shift Position Up' }).click();
  await expect(firewallRow(page)).toContainText('U5');
});

test('remove a device', async ({ page }) => {
  await page.getByRole('button', { name: /Firewall Appliance 1U/i }).click();
  await expect(rows(page)).toHaveCount(3);
  await firewallRow(page).getByRole('button', { name: /^Remove firewall/ }).click();
  await expect(rows(page)).toHaveCount(2);
  await expect(firewallRow(page)).toHaveCount(0);
});
