import { test, expect } from '@playwright/test';

test('editing a row survives reordering and opening its detail', async({ page }) => {
  await page.goto('/');
  const drafts = page.getByRole('textbox', { name: 'Draft title' });
  await drafts.first().fill('Keep my draft');
  await page.getByRole('button', { name: 'Reverse rows' }).click();
  await expect(drafts.last()).toHaveValue('Keep my draft');
  await page.getByRole('button', { name: 'Open', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Selected: first' })).toBeVisible();
  await expect(drafts.last()).toHaveValue('Keep my draft');
});

test('the latest selection wins when an earlier load completes later', async({ page }) => {
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z') });
  await page.goto('/');
  await page.clock.pauseAt(new Date('2026-01-01T01:00:00Z'));
  const open = page.getByRole('button', { name: 'Open', exact: true });
  await open.first().click();
  await expect(page.getByRole('status')).toHaveText('Loading…');
  await open.last().click();
  await page.clock.runFor(50);
  await expect(page.getByRole('heading', { name: 'Selected: second' })).toBeVisible();
  // Fire the first load's remaining delay after the second has completed.
  await page.clock.runFor(550);
  await expect(page.getByRole('heading', { name: 'Selected: second' })).toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Loaded.');
});

test('leaving releases the workspace and its pending work', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await expect(page.getByRole('status')).toHaveText('Loading…');
  const detached = await page.evaluate(async() => {
    const button = document.querySelector('li button');
    const status = document.querySelector('[role="status"]');
    window.dispatchEvent(new PageTransitionEvent('pagehide'));
    button.click();
    await new Promise(resolve => setTimeout(resolve, 700));
    return { connected: button.isConnected, status: status.textContent };
  });
  expect(detached).toEqual({ connected: false, status: 'Loading…' });
  await expect(page.locator('main')).toBeEmpty();
  expect(errors).toEqual([]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
});
