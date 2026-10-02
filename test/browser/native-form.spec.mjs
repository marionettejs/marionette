import assert from 'node:assert/strict';
import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

test('Native form delegation preserves validation keyboard submission focus and teardown', async({ page }) => {
  await page.evaluate(async() => {
    const { View, Region } = await import('marionette');
    const submissions = [];
    const edits = [];
    const Form = View.extend({
      tagName: 'form',
      template: () => '<label>Name <input name="name" required></label><button type="submit">Save</button>',
      ui: { name: 'input' },
      events: {
        'input @ui.name'() { edits.push(this.getUI('name')[0].value); },
        submit(event) {
          event.preventDefault();
          submissions.push({ value: this.getUI('name')[0].value, prevented: event.defaultPrevented });
        }
      }
    });
    const region = new Region({ el: '#content' });
    const form = new Form();
    region.show(form);
    window.formFixture = { form, region, submissions, edits, input: form.getUI('name')[0] };
  });
  const input = page.getByRole('textbox', { name: 'Name' });
  await input.press('Enter');
  assert.equal(await page.evaluate(() => window.formFixture.submissions.length), 0);
  assert.equal(await input.evaluate(el => el.validity.valueMissing), true);
  await input.fill('Draft');
  await input.evaluate(el => el.setSelectionRange(1, 3));
  await input.press('Enter');
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Draft');
  const result = await page.evaluate(() => {
    const { form, region, submissions, edits, input: field } = window.formFixture;
    const before = {
      submissions: [...submissions], edits: [...edits],
      same: form.getUI('name')[0] === field,
      selection: [field.selectionStart, field.selectionEnd]
    };
    const root = form.el;
    region.destroy();
    // Detached native nodes still dispatch; the destroyed View must not handle them.
    root.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    field.dispatchEvent(new Event('input', { bubbles: true }));
    return {
      before, submissions, edits, destroyed: form.isDestroyed(),
      mounted: field.isConnected, empty: document.querySelector('#content').childElementCount === 0
    };
  });
  assert.deepEqual(result, {
    before: { submissions: [{ value: 'Draft', prevented: true }], edits: ['Draft'], same: true, selection: [1, 3] },
    submissions: [{ value: 'Draft', prevented: true }], edits: ['Draft'],
    destroyed: true, mounted: false, empty: true
  });
});
