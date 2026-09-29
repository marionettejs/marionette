import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

async function loadGuide(page, name, bindings) {
  const candidate = JSON.parse(await readFile(process.env.MARIONETTE_BROWSER_CANDIDATE, 'utf8'));
  const core = candidate.packages.find(entry => entry.id === 'core');
  const source = await readFile(join(core.directory, 'docs/guides', `${name}.md`), 'utf8');
  const markup = [...source.matchAll(/```html\n([\s\S]*?)```/g)];
  const scripts = [...source.matchAll(/```js\n([\s\S]*?)```/g)];
  assert.equal(scripts.length, 1);
  await page.evaluate(async({ html, script, exports }) => {
    if (html) { document.body.innerHTML = html; }
    window.originalRoot = document.body.firstElementChild;
    window.originalButton = document.querySelector('button');
    const url = URL.createObjectURL(new Blob([`${script}\nexport { ${exports} };`], { type: 'text/javascript' }));
    try { window.guide = await import(url); } finally { URL.revokeObjectURL(url); }
  }, { html: markup[0]?.[1], script: scripts[0][1], exports: bindings });
}

test('Documented local editing retains focus and cleans up borrowed-model listeners', async({ page }) => {
  await loadGuide(page, 'local-editing', 'editor, region, model');
  const input = page.getByRole('textbox', { name: 'Title' });
  await input.fill('Edited title');
  await input.press('ArrowLeft');
  await input.press('X');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Edited titlXe');
  await expect(page.locator('.preview')).toHaveText('Edited titlXe');
  assert.equal(await input.evaluate(el => el.selectionStart), 12);
  const result = await page.evaluate(() => {
    const { editor, region, model } = window.guide;
    const field = editor.getUI('title')[0];
    model.set('title', '<External update>');
    editor.render();
    const before = { value: field.value, text: editor.getUI('preview')[0].textContent,
      same: editor.getUI('title')[0] === field };
    region.empty();
    model.set('title', 'After cleanup');
    field.dispatchEvent(new Event('input', { bubbles: true }));
    const after = { value: field.value, model: model.get('title'), borrowed: !model.isDestroyed(),
      destroyed: editor.isDestroyed(), mounted: field.isConnected };
    region.destroy();
    model.destroy();
    return { before, after };
  });
  assert.deepEqual(result, {
    before: { value: '<External update>', text: '<External update>', same: true },
    after: { value: '<External update>', model: 'After cleanup', borrowed: true, destroyed: true, mounted: false }
  });
});

test('Documented existing HTML preserves native controls until the View is destroyed', async({ page }) => {
  await loadGuide(page, 'existing-html', 'details');
  const button = page.getByRole('button', { name: 'Details' });
  await button.focus();
  await button.press('Enter');
  await expect(button).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#details-body')).toBeVisible();
  assert.equal(await page.evaluate(() => {
    window.guide.details.render();
    return document.querySelector('button') === window.originalButton &&
      window.guide.details.el === window.originalRoot;
  }), true);
  await expect(button).toBeFocused();
  await button.press('Space');
  await expect(button).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('#details-body')).toBeHidden();
  const result = await page.evaluate(() => {
    window.guide.details.destroy();
    window.originalButton.click();
    return { connected: window.originalRoot.isConnected,
      expanded: window.originalButton.getAttribute('aria-expanded') };
  });
  assert.deepEqual(result, { connected: false, expanded: 'false' });
});

test('Documented refresh retains unfinished input and focus', async({ page }) => {
  await page.evaluate(() => {
    let initial = true;
    window.fetch = async() => {
      if (initial) {
        initial = false;
        return new Response(JSON.stringify({ openTasks: 5 }));
      }
      return new Promise(resolve => { window.finishRefresh = () => resolve(new Response(JSON.stringify({ openTasks: 8 }))); });
    };
  });
  await loadGuide(page, 'retained-refresh', 'app, mount');
  const notes = page.getByRole('textbox', { name: 'Working notes' });
  await notes.fill('Unfinished draft');
  await page.evaluate(() => {
    window.originalNotes = document.querySelector('textarea');
    window.originalPage = window.guide.app.getView();
    window.refreshDone = window.guide.app.refresh();
  });
  await expect(page.getByRole('status')).toHaveText('Refreshing…');
  await expect(notes).toBeFocused();
  await page.evaluate(async() => { window.finishRefresh(); await window.refreshDone; });
  await expect(notes).toBeFocused();
  await expect(notes).toHaveValue('Unfinished draft');
  await expect(page.locator('.summary')).toContainText('Open tasks: 8');
  assert.equal(await page.evaluate(() => document.querySelector('textarea') === window.originalNotes &&
    window.guide.app.getView() === window.originalPage), true);
  await page.evaluate(async() => { await window.guide.app.destroy(); window.guide.mount.remove(); });
});
