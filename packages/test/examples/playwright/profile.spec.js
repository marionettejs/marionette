import { test, expect } from '@playwright/test';

test.afterEach(async({ page }) => {
  await page.evaluate(async() => { await window.unmount?.(); });
});

test('gallery mount preserves draft on update and unmount removes UI', async({ mount }) => {
  const component = await mount('profile/Editable');
  await component.getByRole('textbox', { name: 'Name' }).fill('Grace');
  await component.update({ title: 'Edit account' });
  await expect(component.getByRole('heading')).toHaveText('Edit account');
  await expect(component.getByRole('textbox', { name: 'Name' })).toHaveValue('Grace');
  await component.getByRole('button', { name: 'Save profile' }).click();
  await expect(component.getByRole('status')).toHaveText('Profile saved.');
  await component.unmount();
  await expect(component).toBeEmpty();
});

test('prepared feature supports actual keyboard submission', async({ mount, page }) => {
  const component = await mount('profile/Prepared');
  await page.keyboard.press('Tab');
  await expect(component.getByRole('textbox', { name: 'Name' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(component.getByRole('textbox', { name: 'Email' })).toBeFocused();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Enter');
  await expect(component.getByRole('status')).toHaveText('Profile saved.');
  await component.unmount();
  await expect(component).toBeEmpty();
});

test('unknown gallery story rejects', async({ mount }) => {
  await expect(mount('unknown')).rejects.toThrow('Unknown story');
});
