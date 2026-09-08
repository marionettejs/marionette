import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

test('beta starter preserves draft focus, rejects stale selection and releases handlers', async({ page }) => {
  await page.evaluate(async() => {
    const { createWorkspace } = await import('/starter.mjs');
    globalThis.requests = [];
    globalThis.workspace = createWorkspace({
      el: document.querySelector('main'),
      loadNote(id, { signal }) {
        const request = { id, signal, ...Promise.withResolvers() };
        globalThis.requests.push(request);
        return request.promise;
      }
    });
  });
  const input = page.getByRole('textbox', { name: 'Draft title' }).first();
  await input.fill('Unfinished draft');
  await input.focus();
  await input.evaluate(el => { globalThis.originalInput = el; el.setSelectionRange(2, 7); });
  await page.evaluate(() => globalThis.workspace.notes.move(globalThis.workspace.notes.at(0), 1));
  expect(await page.evaluate(() => ({
    same: document.querySelectorAll('input')[1] === globalThis.originalInput,
    focus: document.activeElement === globalThis.originalInput,
    value: globalThis.originalInput.value,
    start: globalThis.originalInput.selectionStart,
    end: globalThis.originalInput.selectionEnd,
  }))).toEqual({ same: true, focus: true, value: 'Unfinished draft', start: 2, end: 7 });
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  await page.getByRole('button', { name: 'Open', exact: true }).last().click();
  await page.evaluate(() => globalThis.requests[1].resolve({ title: 'Newest', body: '<literal>' }));
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Newest');
  await page.evaluate(() => globalThis.requests[0].resolve({ title: 'Stale', body: '' }));
  await expect(page.getByRole('heading', { level: 2 })).toHaveText('Newest');
  await page.getByRole('button', { name: 'Open', exact: true }).first().click();
  expect(await page.evaluate(async() => {
    const oldButton = document.querySelector('li button');
    globalThis.workspace.destroy();
    globalThis.requests[2].resolve({ title: 'Too late', body: '' });
    await Promise.resolve();
    oldButton.click();
    return { aborted: globalThis.requests[2].signal.aborted,
      children: document.querySelector('main').children.length, requests: globalThis.requests.length };
  })).toEqual({ aborted: true, children: 0, requests: 3 });
});
