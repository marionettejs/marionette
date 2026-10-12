import { test as base, expect } from '@playwright/test';
import { resolve } from 'node:path';

const fixtureURL = `/@fs${resolve(import.meta.dirname, 'composed-fixture.js')}`;

const test = base.extend({
  runtime: async({ page, baseURL }, use) => {
    const errors = [];
    const allowedOrigin = new URL(baseURL).origin;
    page.on('pageerror', error => errors.push(`pageerror: ${error.message}`));
    page.on('console', message => { if (message.type() === 'error') { errors.push(`console: ${message.text()}`); } });
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (['http:', 'https:'].includes(url.protocol) && url.origin !== allowedOrigin) {
        errors.push(`unexpected external request: ${url.origin}`); return route.abort();
      }
      return route.continue();
    });
    page.on('websocket', socket => {
      if (new URL(socket.url()).host !== new URL(allowedOrigin).host) { errors.push('unexpected external websocket'); }
    });
    await page.addInitScript(() => {
      window.unhandled = [];
      window.addEventListener('unhandledrejection', event => window.unhandled.push(String(event.reason)));
    });
    await use(errors);
    expect(errors).toEqual([]);
    expect(await page.evaluate(() => window.unhandled)).toEqual([]);
  }
});

// A full cross-section journey has an explicit bounded budget. This applies
// only to this new file; existing FormKit browser tests retain their budget.
test.describe.configure({ timeout: 90000 });

test('FLOW-NESTED native two-level RowViews retain focus, validate, reset membership and clean up', async({ page, runtime }) => {
  await page.goto('/nested.html');
  await expect(page.getByRole('heading', { name: 'Nested groups and items' })).toBeVisible();
  await expect(page.locator('form')).toHaveCount(1);
  const name = page.getByRole('textbox', { name: 'Group a, item x name', exact: true });
  const id = await name.getAttribute('id');
  await name.focus();
  await name.fill('Edited alpha');
  await page.evaluate(async url => {
    const { getNode } = await import(url);
    const { form } = window.nestedDemo;
    const input = form.el.querySelector('input');
    await getNode(input.id).settled;
    form.setValues({ groups: form.getValues().groups.map(group => ({ ...group, items: [...group.items].reverse() })).reverse() });
  }, fixtureURL);
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('id', id);
  await expect(name).toHaveValue('Edited alpha');
  expect(await page.evaluate(() => {
    const form = window.nestedDemo.form;
    const roots = [];
    form.node.walk(node => roots.push(node.root === form.node));
    return { oneRoot: roots.every(Boolean), groups: form.getValues().groups.map(group => group.id) };
  })).toEqual({ oneRoot: true, groups: ['b', 'a'] });
  await name.fill('');
  await page.getByRole('button', { name: 'Save locally', exact: true }).click();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await expect(name).toBeFocused();
  expect(await name.evaluate(input => input.getAttribute('aria-describedby').split(' ').every(key => document.getElementById(key)))).toBe(true);
  await name.fill('Valid alpha');
  await name.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Saved locally.');
  await page.locator('[data-group="a"]').getByRole('button', { name: 'Add item', exact: true }).click();
  await expect(page.locator('[data-group="a"] [data-item]')).toHaveCount(3);
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(page.locator('[data-group="a"] [data-item]')).toHaveCount(2);
  await expect(name).toHaveValue('Alpha X');
  const cleanup = await page.evaluate(async url => {
    const { getNode } = await import(url);
    const { form, owner } = window.nestedDemo;
    const controls = [...form.el.querySelectorAll('input')];
    const ids = [form.node.props.id, ...controls.map(input => input.id)];
    owner.destroy();
    controls.forEach(input => input.dispatchEvent(new Event('input', { bubbles: true })));
    return { destroyed: form.isDestroyed(), absent: ids.every(key => getNode(key) === undefined), forms: document.querySelectorAll('form').length };
  }, fixtureURL);
  expect(cleanup).toEqual({ destroyed: true, absent: true, forms: 0 });
});

test('FLOW-01 composed planning journey retains focus and drafts, validates across sections and rows, retries and resets', async({ page, runtime }) => {
  await page.goto('/composed.html');
  await expect(page.getByRole('heading', { name: 'Composed follow-up planning', exact: true })).toBeVisible();
  await expect(page.locator('form')).toHaveCount(1);
  await expect(page.locator('[data-row]')).toHaveCount(3);
  await expect(page.getByRole('button', { name: 'Save plan', exact: true })).toHaveCount(1);
  await expect(page.getByText('3 follow-ups in this draft.', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => {
    const form = window.composedPlan.form; const leaves = [];
    form.node.walk(node => { if (node.type === 'input') { leaves.push({ root: node.root === form.node, address: node.address.slice(1).join('.') }); } });
    return { allOwned: leaves.every(node => node.root), count: leaves.length, unique: new Set(leaves.map(node => node.address)).size,
      shape: form.getValues(), components: window.composedPlan.layout.componentViews.size };
  })).toEqual({ allOwned: true, count: 16, unique: 16, components: 2, shape: {
    overview: { title: 'Neighbourhood follow-up plan', email: '', startDate: '2026-12-01', priority: 'normal' },
    followUps: [
      { id: 'one', contact: { name: 'Ada', email: 'ada@example.test' }, due: '2026-12-03', notes: 'Confirm the meeting place.' },
      { id: 'two', contact: { name: 'Bryn', email: 'bryn@example.test' }, due: '2026-12-04', notes: '' },
      { id: 'three', contact: { name: 'Cleo', email: 'cleo@example.test' }, due: '2026-12-05', notes: '' }
    ]
  } });
  const owner = page.getByRole('textbox', { name: 'Plan owner email', exact: true });
  await owner.focus(); await owner.press('Enter');
  await expect(owner).toHaveAttribute('aria-invalid', 'true'); await expect(owner).toBeFocused();
  expect(await owner.evaluate(input => ({ labelled: document.querySelector(`label[for="${input.id}"]`)?.textContent,
    described: input.getAttribute('aria-describedby').split(' ').map(id => document.getElementById(id)?.textContent) })))
    .toEqual({ labelled: 'Plan owner email', described: ['Plan owner email is required.'] });
  expect(await page.evaluate(() => window.composedPlan.server.requests.length)).toBe(0);
  await owner.fill('owner@example.test');
  const priority = page.getByRole('combobox', { name: 'Plan priority' });
  await priority.focus(); await priority.press('ArrowDown');
  await expect(priority).toHaveValue('urgent');
  await expect(page.locator('[data-priority]')).toHaveAttribute('data-priority', 'urgent');
  const overviewTab = page.getByRole('tab', { name: 'Overview', exact: true });
  await overviewTab.focus(); await overviewTab.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Follow-ups', exact: true })).toBeFocused();
  await expect(overviewTab).toHaveAttribute('aria-selected', 'false');
  await expect(owner).toBeHidden();
  const twoEmail = page.getByRole('textbox', { name: 'two contact email', exact: true });
  await twoEmail.fill('ada@example.test');
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(twoEmail).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Use a different email for each follow-up.', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => window.composedPlan.server.requests.length)).toBe(0);
  await twoEmail.fill('bryn@example.test');
  const twoDue = page.getByLabel('two due date', { exact: true });
  await twoDue.fill('2026-11-20'); await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(twoDue).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Choose a date on or after the plan start.', { exact: true })).toBeVisible();
  await twoDue.fill('2026-12-04');
  const oneNotes = page.getByRole('textbox', { name: 'one notes', exact: true });
  await oneNotes.fill('Latest delayed note.');
  await page.evaluate(() => window.composedPlan.server.setMode('hold'));
  await twoEmail.press('Enter');
  await expect.poll(() => page.evaluate(() => window.composedPlan.server.requests.length)).toBe(1);
  expect(await page.evaluate(() => window.composedPlan.server.requests[0].values.followUps[0].notes)).toBe('Latest delayed note.');
  await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true');
  const progress = page.locator('[data-progress]');
  await expect(progress).toHaveAttribute('role', 'status');
  await expect(progress).toHaveAttribute('aria-live', 'polite');
  await expect(progress).toHaveText('Checking and saving…');
  await expect(twoEmail).toBeDisabled();
  await page.evaluate(() => window.composedPlan.server.requests[0].complete());
  await expect(page.locator('#result')).toHaveText('Saved 3 follow-ups for Neighbourhood follow-up plan.');
  await expect(progress).toBeEmpty();
  await expect(twoEmail).toBeFocused();
  await oneNotes.focus(); await oneNotes.evaluate(input => { window.retainedNotes = input; input.setSelectionRange(1, 3); });
  await page.evaluate(() => window.composedPlan.layout.reverseRows());
  await expect(oneNotes).toBeFocused();
  expect(await oneNotes.evaluate(input => [input === window.retainedNotes, input.selectionStart, input.selectionEnd])).toEqual([true, 1, 3]);
  expect(await page.evaluate(() => window.composedPlan.form.getValues().followUps.map(row => row.id))).toEqual(['three', 'two', 'one']);
  await page.evaluate(() => { window.hiddenEmail = document.querySelector('#plan-three-email'); });
  await page.getByRole('button', { name: 'Temporarily hide first follow-up', exact: true }).click();
  await expect(page.locator('[data-row="three"]')).toHaveCount(0);
  expect(await page.evaluate(() => window.composedPlan.form.getValues().followUps[0].contact.email)).toBe('cleo@example.test');
  await page.getByRole('button', { name: 'Show temporarily hidden follow-up', exact: true }).click();
  expect(await page.evaluate(() => document.querySelector('#plan-three-email') === window.hiddenEmail)).toBe(true);
  await page.getByRole('button', { name: 'Add follow-up', exact: true }).click();
  await page.getByRole('button', { name: 'Insert follow-up first', exact: true }).click();
  await expect(page.locator('[data-row]')).toHaveCount(5);
  expect(await page.evaluate(() => window.composedPlan.form.getValues().followUps.map(row => row.id))).toEqual(['new-5', 'three', 'two', 'one', 'new-4']);
  await page.getByRole('button', { name: 'Remove follow-up one', exact: true }).click();
  await expect(page.locator('[data-row]')).toHaveCount(4);
  expect(await page.evaluate(() => window.composedPlan.form.getValues().followUps.map(row => row.id))).toEqual(['new-5', 'three', 'two', 'new-4']);
  await page.getByRole('tab', { name: 'Follow-ups', exact: true }).press('ArrowLeft');
  await expect(owner).toHaveValue('owner@example.test');
  await page.getByRole('button', { name: 'Add partner details', exact: true }).click();
  const partner = page.getByRole('textbox', { name: 'Partner organisation', exact: true });
  await partner.fill('Invented community group');
  await page.getByRole('button', { name: 'Remove partner details', exact: true }).click();
  await expect(partner).toHaveCount(0);
  expect(await page.evaluate(() => ({ partner: window.composedPlan.form.getValues().partner, actorInValues: 'partnerNeeded' in window.composedPlan.form.getValues() })))
    .toEqual({ partner: undefined, actorInValues: false });
  const title = page.getByRole('textbox', { name: 'Plan title', exact: true });
  await title.fill('taken'); await page.evaluate(() => window.composedPlan.server.setMode('normal'));
  await page.getByRole('button', { name: 'Save plan', exact: true }).click();
  await expect(page.locator('[data-root-errors]')).toHaveText('The simulated service rejected this draft.');
  await expect(page.locator('[data-root-errors]')).toHaveAttribute('role', 'alert');
  await expect(page.locator('[data-root-errors]')).toHaveAttribute('aria-live', 'assertive');
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByText('Choose another plan title.', { exact: true })).toBeVisible();
  await title.fill('Neighbourhood visits'); await title.press('Enter');
  await expect(page.locator('#result')).toHaveText('Saved 4 follow-ups for Neighbourhood visits.');
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(title).toHaveValue('Neighbourhood follow-up plan'); await expect(owner).toHaveValue('');
  await expect(page.locator('[data-row]')).toHaveCount(3);
  expect(await page.evaluate(() => window.composedPlan.form.getValues().followUps.map(row => row.id))).toEqual(['one', 'two', 'three']);
  await expect(page.locator('#result')).toBeEmpty();
  expect(runtime).toEqual([]);
});

test('FLOW-02 stale callback errors cannot reach replacement rows or survive reset and destruction', async({ page, runtime }) => {
  await page.goto('/composed.html');
  await page.getByRole('textbox', { name: 'Plan owner email', exact: true }).fill('owner@example.test');
  await page.evaluate(() => {
    window.composedPlan.server.setMode('hold');
    window.firstSubmit = window.composedPlan.form.submit();
  });
  await expect.poll(() => page.evaluate(() => window.composedPlan.server.requests.length)).toBe(1);
  expect(await page.evaluate(() => window.composedPlan.form.submit())).toBe('busy');
  await page.getByRole('tab', { name: 'Follow-ups', exact: true }).click();
  await page.getByRole('button', { name: 'Remove follow-up two', exact: true }).click();
  expect(await page.evaluate(() => window.firstSubmit)).toBe('cancelled');
  expect(await page.evaluate(() => window.composedPlan.server.requests[0].signal.aborted)).toBe(true);
  await page.evaluate(() => {
    const rows = window.composedPlan.form.getValues().followUps;
    window.composedPlan.layout.writeRows([rows[0],
      { id: 'replacement', contact: { name: 'Replacement', email: 'replacement@example.test' }, due: '2026-12-10', notes: 'Fresh row.' }, rows[1]]);
  });
  await page.evaluate(async path => {
    const { SubmissionError } = await import(path);
    window.composedPlan.server.requests[0].reject(new SubmissionError('Stale failure.', { 'followUps.1.contact.email': ['Stale row error.'] }));
  }, fixtureURL);
  await expect(page.locator('[data-root-errors]')).toBeEmpty();
  await expect(page.getByText('Stale row error.', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => window.composedPlan.form.getValues().followUps.map(row => row.id))).toEqual(['one', 'replacement', 'three']);
  await page.evaluate(() => { window.secondSubmit = window.composedPlan.form.submit(); });
  await expect.poll(() => page.evaluate(() => window.composedPlan.server.requests.length)).toBe(2);
  await page.getByRole('button', { name: 'Reset and cancel', exact: true }).click();
  expect(await page.evaluate(() => window.secondSubmit)).toBe('cancelled');
  await page.evaluate(() => window.composedPlan.server.requests[1].complete());
  await expect(page.locator('#result')).toBeEmpty();
  expect(await page.evaluate(() => window.composedPlan.form.getValues().followUps.map(row => row.id))).toEqual(['one', 'two', 'three']);
  await page.getByRole('tab', { name: 'Overview', exact: true }).click();
  await page.getByRole('textbox', { name: 'Plan owner email', exact: true }).fill('owner@example.test');
  await page.evaluate(() => { window.thirdSubmit = window.composedPlan.form.submit(); });
  await expect.poll(() => page.evaluate(() => window.composedPlan.server.requests.length)).toBe(3);
  const cleanup = await page.evaluate(async path => {
    const { getNode } = await import(path);
    const app = window.composedPlan; const root = app.form.el; const input = document.querySelector('#plan-owner-email');
    const ids = [app.form.node.props.id]; app.form.node.walk(node => ids.push(node.props.id));
    let changes = 0; app.form.on('form:change', () => { changes++; });
    app.destroy();
    const before = changes;
    input.value = 'After destruction'; input.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = new Event('submit', { bubbles: true, cancelable: true }); root.dispatchEvent(submit);
    app.server.requests[2].complete();
    return { destroyed: app.form.isDestroyed(), connected: root.isConnected, prevented: submit.defaultPrevented,
      before, after: changes, registryEmpty: ids.every(id => getNode(id) === undefined), components: app.layout.componentViews.size };
  }, fixtureURL);
  expect(cleanup).toEqual({ destroyed: true, connected: false, prevented: false, before: 0, after: 0, registryEmpty: true, components: 0 });
  expect(await page.evaluate(() => window.thirdSubmit)).toBe('cancelled');
  await expect(page.locator('#result')).toBeEmpty();
  await page.getByRole('button', { name: 'Unrelated host action', exact: true }).click();
  await expect(page.locator('#unrelated-host output')).toHaveText('1');
  expect(runtime).toEqual([]);
});

test('FLOW-03 simultaneous same-named forms and repeated Region mount/destroy stay independent', async({ page, runtime }) => {
  await page.goto('/composed.html');
  await page.evaluate(async() => {
    const { mountComposedPlan } = await import('/composed.js');
    const host = document.createElement('div'); host.id = 'second-form'; document.body.append(host);
    window.secondPlan = mountComposedPlan(host, { instance: 'other' });
  });
  await expect(page.locator('form')).toHaveCount(2);
  await page.locator('#composed-form').getByRole('textbox', { name: 'Plan title', exact: true }).fill('First only');
  await expect(page.locator('#second-form').getByRole('textbox', { name: 'Plan title', exact: true })).toHaveValue('Neighbourhood follow-up plan');
  await page.evaluate(() => window.composedPlan.layout.removeRow('one'));
  expect(await page.evaluate(() => window.secondPlan.form.getValues().followUps.map(row => row.id))).toEqual(['one', 'two', 'three']);
  const independence = await page.evaluate(() => {
    const first = window.composedPlan; const second = window.secondPlan;
    first.destroy();
    return { first: first.form.isDestroyed(), second: second.form.isDestroyed(), secondRows: second.form.getValues().followUps.length };
  });
  expect(independence).toEqual({ first: true, second: false, secondRows: 3 });
  const attachment = await page.evaluate(async path => {
    const { getNode } = await import(path);
    const app = window.secondPlan; const input = document.querySelector('#other-one-email'); const node = getNode(input.id);
    const detached = app.owner.detachView();
    const between = { sameView: detached === app.form, connected: input.isConnected, alive: !app.form.isDestroyed(), sameNode: getNode(input.id) === node };
    app.owner.show(detached);
    app.layout.rowViews.get('one').replaceFields();
    return { between, connected: app.form.el.isConnected, valueAfterReplacement: document.querySelector('#other-one-email').value,
      replaced: document.querySelector('#other-one-email') !== input, oneCanonical: app.form.node.at('followUps.0.contact').children.filter(child => child.name === 'email').length };
  }, fixtureURL);
  expect(attachment).toEqual({ between: { sameView: true, connected: false, alive: true, sameNode: true },
    connected: true, valueAfterReplacement: 'ada@example.test', replaced: true, oneCanonical: 1 });
  await page.locator('#second-form').getByRole('textbox', { name: 'Plan owner email', exact: true }).fill('second@example.test');
  expect(await page.evaluate(() => window.secondPlan.form.submit())).toBe('success');
  expect(await page.evaluate(() => window.secondPlan.server.requests.length)).toBe(1);
  await page.evaluate(() => window.secondPlan.destroy());
  const repeats = await page.evaluate(async path => {
    const { mountComposedPlan } = await import('/composed.js');
    const { getNode } = await import(path);
    const host = document.querySelector('#composed-form'); const results = [];
    for (let index = 0; index < 3; index++) {
      const app = mountComposedPlan(host, { instance: `repeat-${index}` });
      const ids = [app.form.node.props.id]; app.form.node.walk(node => ids.push(node.props.id));
      const input = host.querySelector('input'); const root = app.form.el;
      app.destroy();
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const submit = new Event('submit', { cancelable: true }); root.dispatchEvent(submit);
      results.push({ empty: host.childElementCount === 0, registryEmpty: ids.every(id => getNode(id) === undefined), prevented: submit.defaultPrevented });
    }
    return results;
  }, fixtureURL);
  expect(repeats).toEqual(Array.from({ length: 3 }, () => ({ empty: true, registryEmpty: true, prevented: false })));
  await page.getByRole('button', { name: 'Unrelated host action', exact: true }).click();
  await expect(page.locator('#unrelated-host output')).toHaveText('1');
  expect(runtime).toEqual([]);
});
