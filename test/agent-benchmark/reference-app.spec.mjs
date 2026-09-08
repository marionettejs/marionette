import { test, expect } from '@playwright/test';

test('Fieldnotes filters projects, saves a note, and closes its shared overlay', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Fieldnotes' })).toBeVisible();
  await expect(page.locator('.list')).toContainText('Community garden');
  await page.getByRole('searchbox').fill('reading');
  await expect(page.locator('.list')).toContainText('Reading room');
  await expect(page.locator('.list')).not.toContainText('Community garden');
  await page.getByRole('searchbox').fill('');
  await expect(page.locator('.list')).toContainText('Community garden');
  await page.getByRole('textbox', { name: 'Draft' }).fill('<strong>A local note</strong>');
  await page.getByRole('textbox', { name: 'Draft' }).press('Control+Enter');
  await expect(page.locator('.saved li')).toHaveText('<strong>A local note</strong>');
  await expect(page.locator('.saved strong')).toHaveCount(0);
  await expect(page.locator('output')).toHaveText('Note saved in this session.');
  await page.getByRole('button', { name: 'How this works' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'How this works' })).toBeFocused();
  expect(errors).toEqual([]);
});
