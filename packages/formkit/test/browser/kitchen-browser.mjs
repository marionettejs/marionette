import assert from 'node:assert/strict';
import { edits } from './kitchen-fixture.mjs';

const file = { name: 'fixture.txt', bytes: 'synthetic fixture' };
const values = {
  ...edits,
  select: 'beta', checkbox: ['beta'], radio: 'beta',
  file: [file], hidden: 'fixture-only', meta: 'example-metadata',
  group: { nested: 'nested edit' }, list: ['first item'],
};

export async function stockKitchen(browser, arm, origin) {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const field = key => page.locator('#field-' + key);
  try {
    await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    await page.goto(origin + '/?' + new URLSearchParams({ arm, scenario: 'stock-kitchen' }));
    await field('save').waitFor();
    for (const [key, value] of Object.entries({ ...edits, nested: 'nested edit', item: 'first item' })) {
      const input = field(key);
      if (key === 'range') {
        await input.press('Home');
        for (let i = 0; i < 7; i++) await input.press('ArrowRight');
      } else {
        await input.fill(value);
      }
    }
    await field('select').selectOption('beta');
    await page.locator('input[type=checkbox][value=beta]').press('Space');
    await page.locator('input[type=radio][value=alpha]').press('Space');
    await page.locator('input[type=radio][value=alpha]').press('ArrowRight');
    await field('file').setInputFiles({ name: file.name, mimeType: 'text/plain', buffer: Buffer.from(file.bytes) });
    await field('auxiliary').click();
    assert.equal(await page.evaluate(() => window.receipt.submissions.length), 0, 'non-submit button');
    await field('save').click();
    await page.waitForFunction(() => window.receipt.submissions.length === 1);
    const payload = await page.evaluate(async () => {
      const { file, ...values } = window.receipt.submissions[0];
      return { ...values, file: await Promise.all(file.map(async ({ name, file }) => ({ name, bytes: await file.text() }))) };
    });
    assert.deepEqual(payload, values, arm + ' stock input payload');
    await page.getByRole('button', { name: 'Remove fixture.txt', exact: true }).click();
    assert.equal(await field('file').evaluate(el => el.files.length), 0, 'file input reset');
    await field('save').click();
    await page.waitForFunction(() => window.receipt.submissions.length === 2);
    assert.deepEqual(await page.evaluate(() => window.receipt.submissions[1].file), []);
    await page.evaluate(() => window.receipt.destroy());
    assert.equal(await page.locator('#host form, #host input, #host button').count(), 0);
    assert.deepEqual(errors, []);
    return { fixture: 'stock', payloadKeys: Object.keys(payload).sort(), fileCleared: true, destroyed: true };
  } finally {
    await page.close();
  }
}
