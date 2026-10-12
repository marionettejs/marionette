import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

test('decimal edits retain native text and focus while authoritative writes replace pending drafts', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(async path => {
    const fixture = await import(path);
    window.decimalFixture = fixture.mountDecimals();
  }, `/@fs${resolve(import.meta.dirname, 'formkit-fixture.js')}`);
  const amount = page.getByRole('spinbutton', { name: 'Decimal amount', exact: true });
  const pending = page.getByRole('spinbutton', { name: 'Pending decimal', exact: true });
  await amount.fill('1.20');
  await expect.poll(() => page.evaluate(() => window.decimalFixture.form.getValues().amount)).toBe(1.2);
  await expect(amount).toHaveValue('1.20');
  await expect(amount).toBeFocused();
  await page.evaluate(() => {
    const fixture = window.decimalFixture;
    fixture.amountElement = fixture.form.el.querySelector('input');
    fixture.form.setValues({ amount: 2.5 }, { notify: false });
  });
  await expect(amount).toHaveValue('2.5');
  await expect(amount).toBeFocused();
  expect(await amount.evaluate(element => element === window.decimalFixture.amountElement)).toBe(true);
  await pending.fill('9.80');
  await expect(pending).toHaveValue('9.80');
  await page.evaluate(() => window.decimalFixture.form.setValues({ pending: 4.5 }, { notify: false }));
  await expect(pending).toHaveValue('4.5');
  await expect(pending).toBeFocused();
  // Cross the configured native debounce boundary to detect a late stale commit.
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => window.decimalFixture.form.getValues())).toEqual({ amount: 2.5, pending: 4.5 });
  const cleanup = await page.evaluate(() => {
    const { region, form, changes } = window.decimalFixture;
    const element = form.el.querySelector('input');
    const count = changes.length;
    region.destroy();
    element.value = '8.40';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    return { destroyed: form.isDestroyed(), connected: element.isConnected, count, after: changes.length };
  });
  expect(cleanup).toEqual({ destroyed: true, connected: false, count: cleanup.count, after: cleanup.count });
  expect(errors).toEqual([]);
});

test('template Regions preserve accordion drafts, clear conditional values and submit through the keyboard', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/composition.html');
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await email.fill('paul@example.com');
  const notes = page.getByRole('textbox', { name: 'Access needs', exact: true });
  await notes.fill('Step-free access');
  await page.getByRole('button', { name: 'Access needs', exact: true }).click();
  await expect(notes).toBeHidden();
  await expect(page.locator('#values')).toContainText('Step-free access');
  await page.getByRole('button', { name: 'Access needs', exact: true }).click();
  await expect(notes).toHaveValue('Step-free access');
  const invoice = page.getByRole('checkbox', { name: 'Request a company invoice' });
  await invoice.check();
  const company = page.getByRole('textbox', { name: 'Company', exact: true });
  await company.fill('Example company');
  await invoice.uncheck();
  await expect(company).toHaveCount(0);
  await expect(page.locator('#values')).not.toContainText('Example company');
  await email.press('Enter');
  await expect(page.locator('#result')).toHaveText('Registered Paul.');
  await expect(email).toBeFocused();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await expect(email).toHaveValue('');
  await expect(notes).toHaveValue('');
  await expect(page.locator('#result')).toHaveText('');
  expect(errors).toEqual([]);
});

test('adopted forms mount, preserve keyed sibling edits and focus, and can be reused', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(async path => {
    const fixture = await import(path);
    window.formkitReview = fixture.mountReviewCases();
  }, `/@fs${resolve(import.meta.dirname, 'formkit-fixture.js')}`);
  const first = page.getByRole('textbox', { name: 'First', exact: true });
  await expect(first).toHaveValue('Alpha');
  await expect(page.getByRole('combobox', { name: 'Initial choice' })).toHaveValue('b');
  await first.fill('Edited');
  const id = await first.getAttribute('id');
  await first.evaluate(input => input.setSelectionRange(1, 3));
  await page.evaluate(() => window.formkitReview.reorder());
  await expect(first).toHaveAttribute('id', id);
  await expect(first).toHaveValue('Edited');
  await expect(first).toBeFocused();
  expect(await first.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([1, 3]);
  expect(await page.evaluate(() => window.formkitReview.form.getValues())).toEqual({ first: 'Edited', second: 'Beta' });
  await first.press('Enter');
  await expect.poll(() => page.evaluate(() => window.formkitReview.submissions)).toBe(1);
  await page.evaluate(() => window.formkitReview.reuse());
  await expect(first).toHaveValue('Alpha');
  await first.fill('');
  await first.press('Enter');
  await expect(first).toHaveAttribute('aria-invalid', 'true');
  const descriptions = await first.evaluate(input => input.getAttribute('aria-describedby').split(' ').map(descriptionId => {
    const element = document.getElementById(descriptionId);
    return element && { text: element.textContent, inForm: input.form.contains(element) };
  }));
  expect(descriptions).toEqual([{ text: 'Your name', inForm: true }, { text: 'First is required.', inForm: true }]);
  expect(await page.evaluate(() => window.formkitReview.submissions)).toBe(1);
  await first.fill('Alpha');
  await first.press('Enter');
  await expect.poll(() => page.evaluate(() => window.formkitReview.submissions)).toBe(2);
  const result = await page.evaluate(() => {
    const fixture = window.formkitReview;
    const element = fixture.form.el;
    fixture.destroy();
    let calls = 0;
    element.addEventListener('host', () => { calls++; });
    element.dispatchEvent(new Event('host'));
    const event = new Event('submit', { cancelable: true });
    element.dispatchEvent(event);
    return { calls, prevented: event.defaultPrevented };
  });
  expect(result).toEqual({ calls: 1, prevented: false });
  expect(errors).toEqual([]);
});

test('profile example supports keyboard validation, server errors, retry and native reset', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const email = page.getByRole('textbox', { name: 'Email', exact: true });
  await email.focus();
  await email.press('Enter');
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(email).toBeFocused();
  await expect(page.getByText('Email is required.', { exact: true })).toBeVisible();
  await email.fill('paul@example.com');
  const name = page.getByRole('textbox', { name: 'Display name' });
  await name.fill('taken');
  await page.getByRole('button', { name: 'Save profile' }).click();
  await expect(email).toBeDisabled();
  await expect(page.getByText('This name is already taken.', { exact: true })).toBeVisible();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await name.fill('Ada');
  await name.press('Enter');
  await expect(page.getByText('Saved Ada.', { exact: true })).toBeVisible();
  await expect(name).toBeFocused();
  await page.getByRole('button', { name: 'Reset' }).click();
  await expect(name).toHaveValue('Paul');
  await expect(email).toHaveValue('');
  await expect(name).not.toHaveAttribute('aria-invalid');
  expect(errors).toEqual([]);
});

test('external snapshots and schema reordering preserve real browser focus and selection, then clean up', async({ page }) => {
  await page.goto('/');
  await page.evaluate(async path => {
    const fixture = await import(path);
    window.nativeFormkit = fixture.mount();
  }, `/@fs${resolve(import.meta.dirname, 'formkit-fixture.js')}`);
  const name = page.getByRole('textbox', { name: 'Name', exact: true });
  await name.focus();
  await name.evaluate(element => element.setSelectionRange(1, 3, 'backward'));
  await page.evaluate(() => {
    const { form } = window.nativeFormkit;
    form.setValues({ name: 'External' }, { notify: false });
    form.render();
  });
  await expect(name).toBeFocused();
  expect(await name.evaluate(element => [element.selectionStart, element.selectionEnd, element.selectionDirection])).toEqual([1, 3, 'backward']);
  const beta = page.getByRole('textbox', { name: 'b', exact: true });
  await beta.focus();
  await beta.evaluate(element => element.setSelectionRange(1, 2));
  await page.evaluate(() => {
    const fixture = window.nativeFormkit;
    fixture.schema.update({ items: [...fixture.items].reverse() });
  });
  await expect(beta).toBeFocused();
  expect(await beta.evaluate(element => [element.selectionStart, element.selectionEnd])).toEqual([1, 2]);
  const result = await page.evaluate(() => {
    const { form, region, schema, schemaContainer, values } = window.nativeFormkit;
    const root = form.el;
    const field = root.querySelector('input');
    const count = values.length;
    region.destroy();
    schema.destroy();
    field.value = 'After destroy';
    field.dispatchEvent(new Event('input'));
    const submit = new Event('submit', { cancelable: true });
    root.dispatchEvent(submit);
    return { destroyed: form.isDestroyed(), connected: field.isConnected, count, after: values.length,
      prevented: submit.defaultPrevented, schemaEmpty: schemaContainer.childElementCount === 0 };
  });
  expect(result).toEqual({ destroyed: true, connected: false, count: result.count, after: result.count,
    prevented: false, schemaEmpty: true });
});

test('official schema form supports conditional fields, steps, files, lists, server errors and cancellation', async({ page }) => {
  await page.addInitScript(() => {
    const NativeObserver = window.ResizeObserver;
    const targets = new Map();
    window.observedFormkitTargets = () => [...targets.values()].reduce((count, entries) =>
      count + [...entries].filter(element => element.closest('form')).length, 0);
    window.ResizeObserver = class extends NativeObserver {
      observe(element, options) {
        if (!targets.has(this)) { targets.set(this, new Set()); }
        targets.get(this).add(element);
        super.observe(element, options);
      }
      unobserve(element) { targets.get(this)?.delete(element); super.unobserve(element); }
      disconnect() { targets.delete(this); super.disconnect(); }
    };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/schema.html');
  await page.waitForFunction(() => !!window.formkitExample, undefined, { timeout: 5000 }).catch(() => {
    throw new Error(`Schema example did not mount: ${errors.join('; ')}`);
  });
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await next.click();
  const email = page.getByRole('textbox', { name: 'Contact email', exact: true });
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await email.fill('paul@example.com');
  await page.getByRole('checkbox', { name: 'Request an invoice' }).check();
  const company = page.getByRole('textbox', { name: 'Company', exact: true });
  await expect(company).toBeVisible();
  await company.fill('Marionette');
  await page.getByRole('checkbox', { name: 'Request an invoice' }).uncheck();
  await expect(company).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Accept registration terms' }).check();
  await next.click();
  const team = page.getByRole('textbox', { name: 'Team name', exact: true });
  await expect(team).toBeVisible();
  const developer = page.getByRole('radio', { name: 'Developer', exact: true });
  await developer.focus(); await developer.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Designer', exact: true })).toBeChecked();
  await page.getByRole('listbox', { name: 'Sessions', exact: true }).selectOption(['Architecture', 'Testing']);
  const attachment = page.getByLabel('Optional attachment', { exact: true });
  await attachment.setInputFiles({ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('Native forms') });
  await expect(page.getByText('notes.txt', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.formkitExample.form.getValues().registration.team.attachment[0].file.name)).toBe('notes.txt');
  const note = page.getByRole('textbox', { name: 'Notes', exact: true });
  await note.fill('First line\nSecond line\nThird line');
  await expect.poll(() => page.evaluate(() => window.observedFormkitTargets())).toBeGreaterThan(0);
  await expect.poll(() => note.evaluate(element => parseInt(element.style.minHeight))).toBeGreaterThan(0);
  const rows = page.getByRole('textbox', { name: 'Participant name', exact: true });
  await expect(rows).toHaveCount(2);
  const adaId = await rows.nth(1).getAttribute('id');
  await rows.nth(1).focus();
  await rows.nth(1).evaluate(input => input.setSelectionRange(1, 2));
  await page.evaluate(() => {
    const { form } = window.formkitExample;
    const participants = form.getValues().registration.team.participants;
    form.setValues({ registration: { team: { participants: [...participants].reverse() } } }, { notify: false });
  });
  await expect(rows.nth(0)).toHaveAttribute('id', adaId);
  await expect(rows.nth(0)).toBeFocused();
  expect(await rows.nth(0).evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([1, 2]);
  await page.getByRole('button', { name: 'Add participant', exact: true }).click();
  await expect(rows).toHaveCount(3);
  await rows.nth(2).fill('Grace');
  await team.fill('taken');
  await page.getByRole('button', { name: 'Register team', exact: true }).click();
  await expect(team).toBeDisabled();
  await expect(page.getByText('This team name is already taken.', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.retryChangeSources = [];
    window.formkitExample.form.on('form:change', (_values, _state, metadata) => window.retryChangeSources.push(metadata.source));
  });
  await team.fill('Native team');
  await expect(team).toHaveValue('Native team');
  await expect.poll(() => page.evaluate(() => window.formkitExample.form.getValues().registration.team.name)).toBe('Native team');
  await expect.poll(() => page.evaluate(() => window.retryChangeSources)).toEqual(['user']);
  await expect.poll(() => page.evaluate(() => window.formkitExample.form.getState().errors)).toEqual([]);
  await page.getByRole('button', { name: 'Register team', exact: true }).click();
  await expect(page.getByText('Registered Native team.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Register team', exact: true }).click();
  await expect(team).toBeDisabled();
  await page.getByRole('button', { name: 'Reset and cancel', exact: true }).click();
  await expect(page.locator('#result')).toBeEmpty();
  expect(await page.evaluate(() => window.formkitExample.form.getState().submitting)).toBe(false);
  const disposed = await page.evaluate(() => {
    const { form, region } = window.formkitExample;
    const root = form.el;
    const input = root.querySelector('input');
    region.destroy();
    const values = form.getValues();
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const submit = new Event('submit', { cancelable: true }); root.dispatchEvent(submit);
    return { destroyed: form.isDestroyed(), connected: root.isConnected, prevented: submit.defaultPrevented,
      unchanged: JSON.stringify(form.getValues()) === JSON.stringify(values) };
  });
  expect(disposed).toEqual({ destroyed: true, connected: false, prevented: false, unchanged: true });
  expect(await page.evaluate(() => window.observedFormkitTargets())).toBe(0);
  expect(errors).toEqual([]);
});

test('explicit owner placement preserves sibling selection and ends validation on removal', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.evaluate(async path => {
    const fixture = await import(path);
    window.conditionalFixture = fixture.mountOwnedFields();
  }, `/@fs${resolve(import.meta.dirname, 'formkit-fixture.js')}`);
  const keep = page.getByRole('textbox', { name: 'Keep', exact: true });
  const company = page.getByRole('textbox', { name: 'Conditional company', exact: true });
  await expect(company).toHaveCount(0);
  await keep.focus();
  await keep.evaluate(input => input.setSelectionRange(1, 3));
  await page.evaluate(() => window.conditionalFixture.project({ invoice: true, company: 'Acme' }));
  await expect(company).toHaveValue('Acme');
  await expect(keep).toBeFocused();
  expect(await keep.evaluate(input => [input.selectionStart, input.selectionEnd])).toEqual([1, 3]);
  const id = await company.getAttribute('id');
  await page.evaluate(() => {
    window.conditionalFixture.project({ invoice: true });
    window.conditionalFixture.form.render();
  });
  await expect(company).toHaveAttribute('id', id);
  expect(await page.evaluate(() => window.conditionalFixture.fields.length)).toBe(1);
  await company.fill('');
  expect(await page.evaluate(() => window.conditionalFixture.form.submit())).toBe('invalid');
  await expect(company).toBeFocused();
  await expect(company).toHaveAttribute('aria-invalid', 'true');
  await keep.focus();
  await page.evaluate(() => window.conditionalFixture.project({ invoice: false }));
  await expect(company).toHaveCount(0);
  expect(await page.evaluate(() => window.conditionalFixture.form.submit())).toBe('success');
  await expect(keep).toBeFocused();
  await page.evaluate(() => window.conditionalFixture.project({ invoice: true, company: 'Latest' }));
  await expect(company).toHaveValue('Latest');
  expect(await company.getAttribute('id')).not.toBe(id);
  await page.evaluate(() => window.conditionalFixture.reset());
  await expect(company).toHaveCount(0);
  await expect(keep).toHaveValue('Sibling');
  await page.evaluate(() => window.conditionalFixture.destroy());
  await expect(keep).toHaveCount(0);
  expect(errors).toEqual([]);
});
