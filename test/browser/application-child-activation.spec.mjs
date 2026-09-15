import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

test('Application optional children activate explicitly and stop beneath a stopped owner', async({ page }) => {
  await page.evaluate(async() => {
    const { Application, View } = await import('marionette');
    const Editor = View.extend({ template: () => '<input aria-label="Draft" value="Initial">' });
    const Panel = Application.extend({
      region: '#content',
      onStart() { this.showView(new Editor()); }
    });
    const owner = new Application();
    const child = owner.addChildApp('panel', new Panel());
    await owner.start();
    window.childExample = { owner, child };
  });
  try {
    await expect(page.locator('#content')).toBeEmpty();
    await page.evaluate(() => window.childExample.child.start());
    await page.evaluate(() => { window.childExample.firstView = window.childExample.child.getView(); });
    await page.getByLabel('Draft').fill('Unsaved draft');
    await page.getByLabel('Draft').focus();
    await expect(page.getByLabel('Draft')).toBeFocused();
    await page.evaluate(() => window.childExample.owner.restart());
    await expect(page.locator('#content')).toBeEmpty();
    assert.equal(await page.evaluate(() => window.childExample.child.isRunning()), false);
    await page.evaluate(() => window.childExample.owner.stop());
    await page.evaluate(() => window.childExample.child.start());
    await expect(page.getByLabel('Draft')).toBeVisible();
    assert.equal(await page.evaluate(() => window.childExample.firstView.isDestroyed()), true);
    assert.equal(await page.evaluate(() => window.childExample.firstView === window.childExample.child.getView()), false);
    assert.equal(await page.evaluate(() => window.childExample.owner.isRunning()), false);
    await page.evaluate(() => window.childExample.owner.stop());
    await expect(page.locator('#content')).toBeEmpty();
    assert.equal(await page.evaluate(() => window.childExample.child.isRunning()), false);
  } finally {
    await page.evaluate(async() => { await window.childExample.owner.destroy(); delete window.childExample; });
  }
});
