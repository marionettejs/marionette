import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium, firefox, webkit } from '@playwright/test';

const root = resolve(import.meta.dirname, '../..');
const markdown = await readFile(resolve(root, 'docs/forms-and-accessibility.md'), 'utf8');
const marker = '<!-- executable-example: accessible-form-save -->';
assert.equal(markdown.split(marker).length - 1, 1);
const code = markdown.slice(markdown.indexOf(marker) + marker.length).match(/^\s*```javascript\n([\s\S]*?)\n```/)[1];
assert.ok(code.startsWith('import { View } from \'marionette\';'));
// Adapt only module linkage so the exact example runs against the standalone build.
const browserCode = code.replace('import { View } from \'marionette\';', 'const { View } = Marionette;')
  .replace('export const ProfileForm', 'const ProfileForm');
const failures = [];
for (const [name, browserType] of Object.entries({ chromium, firefox, webkit })) {
  let browser;
  try {
    browser = await browserType.launch({ headless: true });
    const page = await browser.newPage();
    await page.setContent('<!doctype html><main id="form"></main>');
    await page.addScriptTag({ path: resolve(root, 'dist/marionette.umd.js') });
    await page.addScriptTag({ content: `${browserCode}\nglobalThis.ProfileForm = ProfileForm;` });
    await page.evaluate(() => {
      globalThis.saves = [];
      globalThis.region = new Marionette.Region({ el: document.querySelector('#form') });
      globalThis.form = new globalThis.ProfileForm({
        displayName: '',
        save(profile, { signal }) {
          const pending = { profile, signal, ...Promise.withResolvers() };
          globalThis.saves.push(pending);
          return pending.promise;
        }
      });
      globalThis.region.show(globalThis.form);
    });
    const input = page.getByRole('textbox', { name: 'Display name' });
    await input.press('Enter');
    assert.equal(await page.evaluate(() => globalThis.saves.length), 0, `${name}: native required validation`);
    await input.fill('Unfinished draft');
    await input.focus();
    await page.evaluate(() => {
      globalThis.originalInput = document.querySelector('input');
      globalThis.originalInput.setSelectionRange(3, 8);
    });
    await input.press('Enter');
    assert.equal(await page.evaluate(() => globalThis.saves.length), 1, `${name}: keyboard submission`);
    assert.equal(await input.evaluate(el => el.readOnly), true);
    assert.equal(await page.getByRole('button', { name: 'Save' }).isDisabled(), true);
    assert.equal(await page.evaluate(() => globalThis.form.submit()), false, `${name}: duplicate suppression`);
    await page.evaluate(async() => {
      globalThis.saves[0].reject(new Error('private server detail'));
      await Promise.resolve();
    });
    const failed = await page.evaluate(() => ({
      same: document.querySelector('input') === globalThis.originalInput,
      focused: document.activeElement === globalThis.originalInput,
      value: globalThis.originalInput.value,
      start: globalThis.originalInput.selectionStart,
      end: globalThis.originalInput.selectionEnd,
      message: document.querySelector('[role="status"]').textContent,
      busy: globalThis.form.el.hasAttribute('aria-busy'),
    }));
    assert.equal(failed.same, true);
    assert.equal(failed.focused, true);
    assert.equal(failed.value, 'Unfinished draft');
    assert.equal(failed.start, 3);
    assert.equal(failed.end, 8);
    assert.match(failed.message, /Your changes are still here/);
    assert.doesNotMatch(failed.message, /private server/);
    assert.equal(failed.busy, false);
    await input.press('Enter');
    assert.equal(await page.evaluate(() => globalThis.saves.length), 2);
    await page.evaluate(async() => { globalThis.saves[1].resolve(); await Promise.resolve(); });
    assert.equal(await page.getByRole('status').textContent(), 'Saved.');
    const late = await page.evaluate(async() => {
      const pending = globalThis.form.submit();
      const request = globalThis.saves[2];
      globalThis.region.destroy();
      request.resolve();
      return { completed: await pending, aborted: request.signal.aborted,
        destroyed: globalThis.form.isDestroyed(), mountRemains: document.querySelector('#form').isConnected,
        count: document.querySelector('#form').children.length };
    });
    assert.deepEqual(late, { completed: false, aborted: true, destroyed: true, mountRemains: true, count: 0 });
    console.log(`${name}: documented form keyboard, validation, draft/focus/selection, retry and teardown passed`);
  } catch (error) {
    failures.push(new Error(`${name}: ${error.message}`, { cause: error }));
  } finally { await browser?.close(); }
}
if (failures.length) { throw new AggregateError(failures, 'Documented form browser checks failed.'); }
