import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { test } from './fixtures.mjs';

async function loadGuide(page, name, bindings, fence = 1) {
  const candidate = JSON.parse(await readFile(process.env.MARIONETTE_BROWSER_CANDIDATE, 'utf8'));
  const core = candidate.packages.find(entry => entry.id === 'core');
  const source = await readFile(join(core.directory, 'docs/guides', `${name}.md`), 'utf8');
  const markup = [...source.matchAll(/```html\n([\s\S]*?)```/g)];
  const scripts = [...source.matchAll(/```js\n([\s\S]*?)```/g)];
  assert(scripts[fence - 1], `Missing ${name} JavaScript fence ${fence}`);
  await page.evaluate(async({ html, script, exports }) => {
    if (html) { document.body.innerHTML = html; }
    window.originalRoot = document.body.firstElementChild;
    window.originalButton = document.querySelector('button');
    const url = URL.createObjectURL(new Blob([`${script}\nexport { ${exports} };`], { type: 'text/javascript' }));
    try { window.guide = await import(url); } finally { URL.revokeObjectURL(url); }
  }, { html: markup[0]?.[1], script: scripts[fence - 1][1], exports: bindings });
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

test('Documented draft save preserves input through failure and retry', async({ page }) => {
  const errors = [];
  const payloads = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/titles/1', async route => {
    payloads.push(route.request().postDataJSON());
    if (payloads.length === 1) {
      await route.fulfill({ status: 503, body: '' });
      return;
    }
    await route.fulfill({ json: { title: 'Accepted draft' } });
  });
  await loadGuide(page, 'local-editing', 'draftEditor, savedTitle, draftRegion, mount', 2);
  const input = page.getByRole('textbox', { name: 'Title' });
  await input.fill('My draft');
  await input.press('ArrowLeft');
  assert.equal(await input.evaluate(el => el.selectionStart), 7);
  assert.equal(await page.evaluate(() => window.guide.savedTitle.get('title')), 'Original');
  await page.evaluate(() => { window.draftInput = window.guide.draftEditor.getUI('title')[0]; });
  await input.press('Enter');
  await expect(page.getByRole('alert')).toHaveText('Could not save. Your draft is still here; try again.');
  await expect(input).toHaveValue('My draft');
  await expect(input).not.toHaveAttribute('readonly');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'false');
  await expect(input).toBeFocused();
  assert.equal(await page.evaluate(() => window.guide.savedTitle.get('title')), 'Original');
  assert.equal(await page.evaluate(() => window.guide.draftEditor.getUI('title')[0] === window.draftInput), true);
  assert.equal(await input.evaluate(el => el.selectionStart), 7);
  await input.press('ArrowRight');
  await input.press('!');
  await expect(input).toHaveValue('My draft!');
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Saved.');
  await expect(input).toHaveValue('Accepted draft');
  await expect(input).not.toHaveAttribute('readonly');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'false');
  await expect(input).toBeFocused();
  assert.equal(await page.evaluate(() => window.guide.savedTitle.get('title')), 'Accepted draft');
  assert.deepEqual(payloads, [{ title: 'My draft' }, { title: 'My draft!' }]);
  assert.equal(await page.evaluate(() => {
    const { draftRegion, draftEditor, savedTitle } = window.guide;
    draftRegion.empty();
    return draftEditor.isDestroyed() && draftEditor.getState().isDestroyed() && !savedTitle.isDestroyed();
  }), true);
  assert.deepEqual(errors, []);
});

test('Documented draft teardown aborts a pending browser save', async({ page }) => {
  let pending;
  let requests = 0;
  await page.route('**/api/titles/1', route => { requests++; pending = route; });
  await loadGuide(page, 'local-editing', 'draftEditor, savedTitle, draftRegion, mount', 2);
  const input = page.getByRole('textbox', { name: 'Title' });
  await input.fill('Unfinished draft');
  await input.press('Enter');
  await expect(page.getByRole('status')).toHaveText('Saving…');
  await expect(input).toHaveAttribute('readonly', '');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toHaveAttribute('aria-disabled', 'true');
  await expect(input).toBeFocused();
  await input.press('Enter');
  assert.equal(requests, 1);
  const failed = page.waitForEvent('requestfailed', {
    predicate: request => request.url().endsWith('/api/titles/1'),
  });
  await page.evaluate(() => { window.guide.draftRegion.empty(); });
  await failed;
  await pending.fulfill({ json: { title: 'Late response' } }).catch(() => {});
  assert.equal(await page.evaluate(() => {
    const { draftEditor, savedTitle } = window.guide;
    return draftEditor.isDestroyed() && draftEditor.getState().isDestroyed() &&
      !savedTitle.isDestroyed() && savedTitle.get('title') === 'Original';
  }), true);
  await expect(page.getByRole('textbox', { name: 'Title' })).toHaveCount(0);
});

test('Documented asynchronous navigation retains its shell through readiness and errors', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  let aboutAttempts = 0;
  await page.route('**/pages/*.json', async route => {
    const about = route.request().url().endsWith('/about.json');
    if (about && ++aboutAttempts === 1) {
      await route.fulfill({ status: 503, body: '' });
      return;
    }
    await route.fulfill({ json: { title: about ? 'About' : 'Home', body: 'Ready' } });
  });
  await loadGuide(page, 'routing', 'app, mount', 2);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.shell = window.guide.app.getView();
    window.outgoing = window.guide.app.getChildApp('page').getView();
  });
  await page.getByRole('link', { name: 'About', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Could not load page' })).toBeVisible();
  assert.equal(await page.evaluate(() => window.guide.app.getView() === window.shell &&
    window.outgoing.isDestroyed() && !window.guide.app.getChildApp('page').isRunning()), true);
  assert.equal(new URL(page.url()).hash, '#about');
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  assert.equal(await page.evaluate(() => window.guide.app.getView() === window.shell), true);
  await page.evaluate(async() => { await window.guide.app.destroy(); });
  await expect(page.getByRole('navigation', { name: 'Pages' })).toHaveCount(0);
  assert.deepEqual(errors, []);
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

test('Documented host mount preserves the host and ends detached interaction', async({ page }) => {
  await loadGuide(page, 'existing-ui', '');
  await page.evaluate(() => {
    const host = document.createElement('section');
    document.body.append(host);
    window.host = host;
    window.counts = [];
    window.feature = window.guide.mountCounter(host, count => window.counts.push(count));
    window.retainedButton = host.querySelector('button');
  });
  await page.getByRole('button', { name: 'Count: 0' }).click();
  await expect(page.getByRole('button', { name: 'Count: 1' })).toBeVisible();
  assert.deepEqual(await page.evaluate(() => {
    window.feature.destroy();
    window.feature.destroy();
    window.retainedButton.click();
    const result = { counts: window.counts, mounted: window.host.isConnected,
      children: window.host.childElementCount };
    const next = window.guide.mountCounter(window.host, () => {});
    result.fresh = window.host.querySelector('button').textContent;
    next.destroy();
    window.host.remove();
    return result;
  }), { counts: [1], mounted: true, children: 0, fresh: 'Count: 0' });
});

test('Documented navigation handles direct links, history, focus and listener cleanup', async({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.evaluate(() => window.history.replaceState(null, '', '#about'));
  await loadGuide(page, 'routing', 'app, mount');
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About', exact: true })).not.toBeFocused();
  await expect(page).toHaveTitle('About');
  await page.evaluate(() => {
    window.shell = window.guide.app.getView();
    window.previous = window.shell.getChildView('content');
  });
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeFocused();
  await expect(page).toHaveTitle('Home');
  assert.equal(await page.evaluate(() => window.guide.app.getView() === window.shell && window.previous.isDestroyed()), true);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeFocused();
  await page.goForward();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeFocused();
  assert.equal(await page.evaluate(() => {
    const current = window.shell.getChildView('content');
    window.guide.app.showRoute();
    return window.shell.getChildView('content') === current;
  }), true);
  await page.evaluate(() => { window.location.hash = '#unknown'; });
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeFocused();
  assert.equal(await page.evaluate(async() => {
    const app = window.guide.app;
    const original = app.showRoute;
    window.routeCalls = 0;
    app.showRoute = function(...args) { window.routeCalls++; return original.apply(this, args); };
    await app.stop();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return window.routeCalls;
  }), 0);
  await page.evaluate(() => window.history.replaceState(null, '', '#about'));
  await page.evaluate(async() => { await window.guide.app.start(); });
  await expect(page.getByRole('heading', { name: 'About', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'About', exact: true })).not.toBeFocused();
  assert.equal(await page.evaluate(() => {
    window.routeCalls = 0;
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return window.routeCalls;
  }), 1);
  await page.evaluate(async() => {
    await window.guide.app.destroy();
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    window.guide.mount.remove();
  });
  assert.deepEqual(errors, []);
});

test('Documented list retains row input through sorting and filtering', async({ page }) => {
  await loadGuide(page, 'lists', 'catalog, items, region, mount');
  const notes = page.getByRole('textbox', { name: 'Notes for Blueberry' });
  await notes.fill('Unfinished notes');
  await page.evaluate(() => {
    window.originalRow = window.guide.catalog.list.children.findByModel(window.guide.items.get('b'));
    window.originalInput = window.originalRow.el.querySelector('input');
  });
  await page.getByRole('button', { name: 'Reverse order' }).click();
  await expect(notes).toHaveValue('Unfinished notes');
  await page.getByRole('checkbox', { name: 'Available only' }).check();
  await expect(notes).toHaveCount(0);
  await page.getByRole('checkbox', { name: 'Available only' }).uncheck();
  await expect(notes).toHaveValue('Unfinished notes');
  assert.equal(await page.evaluate(() => window.guide.catalog.list.children.findByModel(window.guide.items.get('b')) === window.originalRow &&
    window.originalRow.el.querySelector('input') === window.originalInput), true);
  await page.evaluate(() => { window.guide.catalog.list.setFilter(() => false); });
  await expect(page.getByText('No matching items.', { exact: true })).toBeVisible();
  assert.equal(await page.evaluate(() => window.guide.items.length), 2);
  await page.evaluate(() => {
    const { items, region, mount } = window.guide;
    region.destroy();
    items.destroy();
    mount.remove();
  });
});

test('Documented accessible toggle supports keyboard and explicit replacement focus', async({ page, browserName }) => {
  await loadGuide(page, 'accessibility-rendering', 'NotificationSettings, settings, region, mount');
  const button = page.getByRole('button', { name: 'Mute notifications' });
  // macOS WebKit uses Option-Tab to include native buttons in keyboard navigation.
  const nextControl = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
  await page.keyboard.press(nextControl);
  await expect(button).toBeFocused();
  await page.evaluate(() => { window.originalToggle = window.guide.settings.getUI('mute')[0]; });
  await button.press('Enter');
  await expect(button).toHaveAttribute('aria-pressed', 'true');
  await expect(button).toBeFocused();
  await button.press('Space');
  await expect(button).toHaveAttribute('aria-pressed', 'false');
  await expect(button).toBeFocused();
  assert.equal(await page.evaluate(() => window.guide.settings.getUI('mute')[0] === window.originalToggle), true);
  await page.evaluate(() => {
    window.guide.settings.getState().title = '<Alerts & updates>';
    window.guide.settings.render();
  });
  await expect(page.getByRole('heading', { name: '<Alerts & updates>' })).toBeVisible();
  await expect(page.locator('alerts')).toHaveCount(0);
  await expect(button).toBeFocused();
  assert.equal(await page.evaluate(() => {
    const { NotificationSettings, settings, region } = window.guide;
    const next = new NotificationSettings();
    region.show(next);
    next.focusHeading();
    return settings.isDestroyed();
  }), true);
  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeFocused();
  await page.keyboard.press(nextControl);
  await expect(button).toBeFocused();
  await page.evaluate(() => { window.guide.region.destroy(); window.guide.mount.remove(); });
});

test('Documented dialog closes before render, detach and destroy', async({ page }) => {
  await loadGuide(page, 'widgets', 'help, region, mount');
  const opener = page.getByRole('button', { name: 'Help', exact: true });
  const close = page.getByRole('button', { name: 'Close', exact: true });
  await opener.focus();
  await opener.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Help', exact: true })).toBeVisible();
  await expect(close).toBeFocused();
  await close.click();
  await expect(page.locator('dialog')).not.toHaveAttribute('open', '');
  await expect(opener).toBeFocused();
  await opener.focus();
  await opener.press('Enter');
  await close.press('Escape');
  await expect(page.locator('dialog')).not.toHaveAttribute('open', '');
  await expect(opener).toBeFocused();
  await opener.focus();
  await opener.press('Enter');
  assert.deepEqual(await page.evaluate(() => {
    const { help } = window.guide;
    const previous = help.getUI('dialog')[0];
    let closedBeforeRemoval = false;
    help.once('dom:remove', () => { closedBeforeRemoval = !previous.open && previous.isConnected; });
    help.render();
    return { closedBeforeRemoval, closed: !previous.open, removed: !previous.isConnected,
      replaced: help.getUI('dialog')[0] !== previous };
  }), { closedBeforeRemoval: true, closed: true, removed: true, replaced: true });
  await opener.focus();
  await opener.press('Enter');
  assert.deepEqual(await page.evaluate(() => {
    const { help, region } = window.guide;
    const dialog = help.getUI('dialog')[0];
    let closedBeforeRemoval = false;
    help.once('dom:remove', () => { closedBeforeRemoval = !dialog.open && dialog.isConnected; });
    region.detachView();
    const result = { closedBeforeRemoval, closed: !dialog.open, alive: !help.isDestroyed() };
    region.show(help);
    result.same = help.getUI('dialog')[0] === dialog;
    return result;
  }), { closedBeforeRemoval: true, closed: true, alive: true, same: true });
  await opener.focus();
  await opener.press('Enter');
  assert.deepEqual(await page.evaluate(() => {
    const { help, region, mount } = window.guide;
    const dialog = help.getUI('dialog')[0];
    let closedBeforeDestroy = false;
    help.once('before:destroy', () => { closedBeforeDestroy = !dialog.open && dialog.isConnected; });
    region.empty();
    const result = { closedBeforeDestroy, closed: !dialog.open, destroyed: help.isDestroyed() };
    region.destroy();
    mount.remove();
    return result;
  }), { closedBeforeDestroy: true, closed: true, destroyed: true });
});
