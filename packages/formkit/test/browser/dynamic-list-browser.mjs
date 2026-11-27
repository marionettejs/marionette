import assert from 'node:assert/strict';

const moved = ['Gamma edited', 'Alpha', 'Beta'];
const removed = ['Gamma edited', 'Beta'];

export async function dynamicList(browser, arm, origin) {
  const page = await browser.newPage();
  const rows = page.getByRole('textbox', { name: 'Row value' });
  const link = origin + '/?' + new URLSearchParams({ arm, scenario: 'dynamic-list' });
  const waitForValues = expected => page.waitForFunction(list => {
    const found = [...document.querySelectorAll('#host input[type=text]')].map(input => input.value);
    return found.length === list.length && found.every((value, i) => value === list[i]);
  }, expected);
  try {
    await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort());
    await page.goto(link);
    await waitForValues(['Alpha', 'Beta', 'Gamma']);
    const edited = rows.nth(2);
    await edited.fill('Gamma edited');
    await edited.press('Home');
    await edited.press('ArrowRight');
    await edited.press('ArrowRight');
    const snapshot = await edited.evaluate(input => {
      window.originalRowInput = input;
      return { focused: document.activeElement === input, caret: input.selectionStart };
    });
    assert.deepEqual(snapshot, { focused: true, caret: 2 });
    await page.evaluate(() => window.receipt.move(2, 0));
    await waitForValues(moved);
    const afterMove = await rows.first().evaluate(input => ({
      sameInput: input === window.originalRowInput,
      focused: input === document.activeElement,
      caret: input.selectionStart,
    }));
    assert.equal(afterMove.sameInput, true);
    await page.evaluate(() => window.receipt.remove(1));
    await waitForValues(removed);
    await page.getByRole('button', { name: 'Save rows', exact: true }).click();
    await page.waitForFunction(() => window.receipt.submissions.length === 1);
    assert.deepEqual(await page.evaluate(() => window.receipt.submissions[0]), { rows: removed });
    await page.evaluate(() => window.receipt.destroy());
    assert.equal(await rows.count(), 0);
    return { afterMove, rowsReordered: true, submittedAfterRemoval: true, destroyed: true };
  } finally {
    await page.close();
  }
}
