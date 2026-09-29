import { expect, test } from '@playwright/test';

const records = [
  { id: 'alpha', title: 'Alpha', description: 'First record description.' },
  { id: 'beta', title: 'Beta', description: 'Second record description.' },
];

async function openRecords(page) {
  await page.route('**/api/records.json', route => route.fulfill({ json: records }));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('2 records');
}

// Test transport that deliberately ignores cancellation.
async function controlPreparation(page) {
  await openRecords(page);
  await page.getByRole('button', { name: 'Close records', exact: true }).click();
  return page.evaluateHandle(async() => {
    const { application: main } = await import('/src/main.js');
    const application = main.getChildApp('records');
    const control = { application, requests: [] };
    const { recordsApi } = await import('/src/records-api.js');
    recordsApi.list = ({ signal }) => new Promise((resolve, reject) => {
      control.requests.push({ signal, resolve, reject });
    });
    return control;
  });
}

test('selection coordinates detail without replacing the page, list, or rows', async({ page }) => {
  await openRecords(page);
  const list = page.getByRole('list', { name: 'Records', exact: true });
  const detail = page.getByRole('region', { name: 'Record details', exact: true });
  await expect(detail).toHaveText('Select a record.');
  const nodes = [
    await page.getByRole('heading', { name: 'Records example', exact: true }).elementHandle(),
    await list.elementHandle(),
    await list.getByRole('button', { name: 'Alpha', exact: true }).elementHandle(),
  ];
  for (const title of ['Alpha', 'Beta']) {
    await list.getByRole('button', { name: title, exact: true }).click();
    await expect(detail.getByRole('heading', { name: title, exact: true })).toBeVisible();
    await expect(list.locator('[aria-pressed="true"]')).toHaveText(title);
  }
  await expect(detail).toContainText('Second record description.');
  for (const node of nodes) {
    expect(await node.evaluate(element => element.isConnected)).toBe(true);
  }
});

test('empty data shows the empty detail View', async({ page }) => {
  await page.route('**/api/records.json', route => route.fulfill({ json: [] }));
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('0 records');
  await expect(page.getByRole('list', { name: 'Records', exact: true }).getByRole('button')).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Record details', exact: true })).toHaveText('Select a record.');
});

test('start waits for preparation and mounts records only after data arrives', async({ page }) => {
  let request;
  await page.route('**/api/records.json', route => { request = route; });
  await page.goto('/');
  await expect(page.getByRole('status')).toHaveText('Loading records…');
  const control = await page.evaluateHandle(async() => {
    const { application: main } = await import('/src/main.js');
    const application = main.getChildApp('records');
    const value = { application, start: application.start() };
    const { RecordsLayout } = await import('/src/records-views.js');
    RecordsLayout.prototype.onAttach = function() {
      value.attachedWithChildren = Boolean(this.getChildView('list') && this.getChildView('detail'));
    };
    value.start.then(result => { value.result = result; });
    return value;
  });
  await expect(page.getByRole('list', { name: 'Records', exact: true })).toHaveCount(0);
  expect(await control.evaluate(value => ({ running: value.application.isRunning(), result: value.result })))
    .toEqual({ running: false, result: undefined });
  const loading = await page.getByRole('status').elementHandle();
  await expect.poll(() => Boolean(request)).toBe(true);
  await request.fulfill({ json: [{ id: 'ready', title: 'Ready record', description: 'Prepared.' }] });
  expect(await control.evaluate(value => value.start)).toBe(true);
  await expect(page.getByRole('status')).toHaveText('1 record');
  await expect(page.getByRole('button', { name: 'Ready record', exact: true })).toBeVisible();
  expect(await control.evaluate(value => value.application.isRunning())).toBe(true);
  expect(await control.evaluate(value => value.attachedWithChildren)).toBe(true);
  expect(await loading.evaluate(element => element.isConnected)).toBe(false);
});

test('Open is idempotent during preparation and after readiness', async({ page }) => {
  const control = await controlPreparation(page);
  await page.getByRole('button', { name: 'Open records', exact: true }).click();
  await page.getByRole('button', { name: 'Open records', exact: true }).click();
  expect(await control.evaluate(value => value.requests.length)).toBe(1);
  await control.evaluate(value => value.requests[0].resolve([{ id: 'ready', title: 'Ready record' }]));
  await expect(page.getByRole('status')).toHaveText('1 record');
  const list = await page.getByRole('list', { name: 'Records', exact: true }).elementHandle();
  await page.getByRole('button', { name: 'Open records', exact: true }).click();
  expect(await control.evaluate(value => value.requests.length)).toBe(1);
  expect(await list.evaluate(element => element.isConnected)).toBe(true);
});

test('Retry can fail again and then restart preparation successfully', async({ page }) => {
  let requests = 0;
  await page.route('**/api/records.json', route => {
    requests += 1;
    return requests < 3 ? route.fulfill({ status: 503 }) : route.fulfill({ json: records });
  });
  await page.goto('/');
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    await expect(page.getByRole('alert')).toHaveText('Could not open records.');
    await expect(page.getByRole('status')).toHaveCount(0);
    expect(requests).toBe(attempt);
    expect(await page.evaluate(async() => {
      const { application: main } = await import('/src/main.js');
      const application = main.getChildApp('records');
      return application.isRunning();
    })).toBe(false);
    const errorNode = await page.getByRole('alert').elementHandle();
    await page.getByRole('button', { name: 'Retry', exact: true }).click();
    await expect.poll(() => errorNode.evaluate(element => element.isConnected)).toBe(false);
  }
  await expect(page.getByRole('status')).toHaveText('2 records');
  expect(requests).toBe(3);
});

test('closing the error View permits a fresh open', async({ page }) => {
  let requests = 0;
  await page.route('**/api/records.json', route => {
    requests += 1;
    return requests === 1 ? route.fulfill({ status: 503 }) : route.fulfill({ json: records });
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Close records', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open records', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('2 records');
  expect(requests).toBe(2);
});

for (const outcome of ['success', 'failure']) {
  test(`an obsolete preparation ${outcome} cannot change a reopened feature`, async({ page }) => {
    const control = await controlPreparation(page);
    await page.getByRole('button', { name: 'Open records', exact: true }).click();
    await control.evaluate(value => { value.oldStart = value.application.start(); });
    await page.getByRole('button', { name: 'Close records', exact: true }).click();
    expect(await control.evaluate(value => value.oldStart)).toBe(false);
    expect(await control.evaluate(value => value.requests[0].signal.aborted)).toBe(true);
    await expect(page.getByRole('status')).toHaveCount(0);
    await page.getByRole('button', { name: 'Open records', exact: true }).click();
    await control.evaluate(value => value.requests[1].resolve([{ id: 'current', title: 'Current record' }]));
    await expect(page.getByRole('status')).toHaveText('1 record');
    await control.evaluate(async(value, result) => {
      if (result === 'success') { value.requests[0].resolve([{ id: 'old', title: 'Old record' }]); } else { value.requests[0].reject(new Error('Obsolete failure')); }
      // Let the framework consume the settled service promise.
      await new Promise(resolve => setTimeout(resolve, 0));
    }, outcome);
    await expect(page.getByRole('list', { name: 'Records', exact: true }).getByRole('button')).toHaveText(['Current record']);
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(await control.evaluate(value => value.application.records.map(model => model.id))).toEqual(['current']);
  });
}

test('a failure in onStart is logged and its partial UI/data are cleaned up', async({ page }) => {
  await openRecords(page);
  await page.getByRole('button', { name: 'Close records', exact: true }).click();
  const control = await page.evaluateHandle(async() => {
    const { application: main } = await import('/src/main.js');
    const application = main.getChildApp('records');
    const onStart = application.onStart;
    const result = {};
    application.onStart = function(...args) {
      this.onStart = onStart;
      onStart.apply(this, args);
      result.view = this.getView();
      throw new Error('Deliberate rendering failure');
    };
    return result;
  });
  const logged = page.waitForEvent('console', {
    predicate: message => message.type() === 'error' && message.text().includes('Could not open records.'),
  });
  await page.getByRole('button', { name: 'Open records', exact: true }).click();
  expect(await (await logged).args()[1].evaluate(error => error.message)).toBe('Deliberate rendering failure');
  await expect(page.getByRole('alert')).toBeVisible();
  expect(await control.evaluate(value => value.view.isDestroyed())).toBe(true);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('2 records');
});

test('record values use ordinary text rendering', async({ page }) => {
  const title = '<img src=x onerror="document.body.dataset.injected=1">';
  const description = '<script>document.body.dataset.injected=1</script>';
  await page.route('**/api/records.json', route => route.fulfill({ json: [{ id: 'text', title, description }] }));
  await page.goto('/');
  await page.getByRole('button', { name: title, exact: true }).click();
  const detail = page.getByRole('region', { name: 'Record details', exact: true });
  await expect(detail.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(detail).toContainText(description);
  await expect(page.locator('main img, main script')).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveAttribute('data-injected', '1');
});

test('repeated close/open resets selection and makes one load per start', async({ page }) => {
  let requests = 0;
  await page.route('**/api/records.json', route => {
    requests += 1;
    return route.fulfill({ json: records });
  });
  await page.goto('/');
  for (let cycle = 1; cycle <= 3; cycle += 1) {
    if (cycle > 1) { await page.getByRole('button', { name: 'Open records', exact: true }).click(); }
    await expect(page.getByRole('status')).toHaveText('2 records');
    await expect(page.getByRole('region', { name: 'Record details', exact: true })).toHaveText('Select a record.');
    await page.getByRole('button', { name: 'Beta', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Record details', exact: true }).getByRole('heading', { name: 'Beta', exact: true })).toBeVisible();
    expect(requests).toBe(cycle);
    await page.getByRole('button', { name: 'Close records', exact: true }).click();
    await expect(page.getByRole('list', { name: 'Records', exact: true })).toHaveCount(0);
  }
});

test('stop releases views, records, and old intent listeners; destroy releases owned state', async({ page }) => {
  await openRecords(page);
  const owned = await page.evaluateHandle(async() => {
    const { application: main } = await import('/src/main.js');
    const application = main.getChildApp('records');
    const layout = application.getView();
    const list = layout.getChildView('list');
    const model = application.records.get('alpha');
    return { application, layout, list, row: list.children.findByModel(model), state: application.getState() };
  });
  await page.getByRole('button', { name: 'Close records', exact: true }).click();
  expect(await owned.evaluate(({ application, layout, list, row, state }) => {
    list.triggerMethod('select:record', row);
    return {
      layout: layout.isDestroyed(), list: list.isDestroyed(), row: row.isDestroyed(),
      hasView: Boolean(application.getView()), state: state.isDestroyed(), selected: state.get('selectedId'),
    };
  })).toEqual({ layout: true, list: true, row: true, hasView: false, state: false, selected: null });
  await page.getByRole('button', { name: 'Open records', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('2 records');
  expect(await owned.evaluate(async({ application, state }) => {
    await application.destroy();
    return { state: state.isDestroyed(), hasView: Boolean(application.getView()) };
  })).toEqual({ state: true, hasView: false });
  await expect(page.locator('main')).toBeEmpty();
  await expect(page.getByRole('heading', { name: 'Records example', exact: true })).toBeVisible();
});


test('restart replaces the active feature and awaits a fresh prepared collection', async({ page }) => {
  await openRecords(page);
  await page.getByRole('button', { name: 'Alpha', exact: true }).click();
  const pageNode = await page.getByRole('heading', { name: 'Records example', exact: true }).elementHandle();
  const control = await page.evaluateHandle(async() => {
    const { application: main } = await import('/src/main.js');
    const application = main.getChildApp('records');
    const value = { application, previousView: application.getView(), previousCollection: application.records };
    const { recordsApi } = await import('/src/records-api.js');
    recordsApi.list = ({ signal }) => {
      value.signal = signal;
      return new Promise(resolve => { value.resolve = resolve; });
    };
    value.restart = application.restart();
    value.restart.then(result => { value.result = result; });
    return value;
  });
  await expect(page.getByRole('status')).toHaveText('Loading records…');
  expect(await control.evaluate(value => ({
    viewDestroyed: value.previousView.isDestroyed(),
    running: value.application.isRunning(), result: value.result,
  }))).toEqual({ viewDestroyed: true, running: false, result: undefined });
  expect(await control.evaluate(async value => {
    value.resolve([{ id: 'beta', title: 'Updated Beta', description: 'New preparation.' }]);
    return value.restart;
  })).toBe(true);
  await expect(page.getByRole('status')).toHaveText('1 record');
  await expect(page.getByRole('list', { name: 'Records', exact: true }).getByRole('button')).toHaveText(['Updated Beta']);
  await expect(page.getByRole('region', { name: 'Record details', exact: true })).toHaveText('Select a record.');
  expect(await control.evaluate(value => value.application.records !== value.previousCollection)).toBe(true);
  expect(await pageNode.evaluate(element => element.isConnected)).toBe(true);
});


test('Close aborts the real fetch used for preparation', async({ page }) => {
  await page.route('**/api/records.json', () => {});
  const requested = page.waitForRequest('**/api/records.json');
  await page.goto('/');
  const request = await requested;
  await expect(page.getByRole('status')).toHaveText('Loading records…');
  const aborted = page.waitForEvent('requestfailed', { predicate: failed => failed === request });
  await page.getByRole('button', { name: 'Close records', exact: true }).click();
  expect((await aborted).failure()).not.toBeNull();
  await expect(page.locator('main')).toBeEmpty();
  expect(await page.evaluate(async() => {
    const { application: main } = await import('/src/main.js');
    const application = main.getChildApp('records');
    return application.isRunning();
  })).toBe(false);
});


test('the main Application owns the existing page and child teardown', async({ page }) => {
  await openRecords(page);
  const control = await page.evaluateHandle(async() => {
    const { application } = await import('/src/main.js');
    const child = application.getChildApp('records');
    return { application, records: child, page: application.getView(), state: child.getState() };
  });
  expect(await control.evaluate(async value => {
    await value.application.stop();
    return {
      pageDestroyed: value.page.isDestroyed(), childRunning: value.records.isRunning(),
      hasView: Boolean(value.records.getView()), stateDestroyed: value.state.isDestroyed(),
    };
  })).toEqual({ pageDestroyed: true, childRunning: false, hasView: false, stateDestroyed: false });
  await expect(page.locator('#app')).toHaveCount(0);
  expect(await control.evaluate(async value => {
    await value.application.destroy();
    return { main: value.application.isDestroyed(), child: value.records.isDestroyed(), state: value.state.isDestroyed() };
  })).toEqual({ main: true, child: true, state: true });
  await expect(page.locator('#app')).toHaveCount(0);
});


test('PageView uses the original HTML and controls without rendering', async({ page }) => {
  let mainModule;
  await page.route('**/src/main.js', route => { mainModule = route; });
  await page.route('**/api/records.json', route => route.fulfill({ json: records }));
  await page.goto('/', { waitUntil: 'commit' });
  const heading = page.getByRole('heading', { name: 'Records example', exact: true });
  await expect(heading).toBeVisible();
  const original = await page.locator('#app').elementHandle();
  const originalHeading = await heading.elementHandle();
  await expect.poll(() => Boolean(mainModule)).toBe(true);
  await mainModule.continue();
  await expect(page.getByRole('status')).toHaveText('2 records');
  expect(await original.evaluate(async element => {
    const { application } = await import('/src/main.js');
    return application.getView().el === element;
  })).toBe(true);
  expect(await originalHeading.evaluate(element => element.isConnected)).toBe(true);
  await page.getByRole('button', { name: 'Close records', exact: true }).click();
  await expect(page.locator('main')).toBeEmpty();
  expect(await originalHeading.evaluate(element => element.isConnected)).toBe(true);
});

test('UI close reports a rejected stop without an unhandled Promise', async({ page }) => {
  const unhandled = [];
  const reports = [];
  page.on('pageerror', error => unhandled.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { reports.push(message.text()); } });
  await openRecords(page);
  await page.evaluate(async() => {
    const { application } = await import('/src/main.js');
    application.getChildApp('records').prepareStop = () => Promise.reject(new Error('Stop blocked'));
  });
  await page.getByRole('button', { name: 'Close records', exact: true }).click();
  await expect.poll(() => reports.some(value => value.includes('Could not close records.'))).toBe(true);
  await expect(page.getByRole('status')).toHaveText('2 records');
  expect(unhandled).toEqual([]);
});

test('retry intent reports failure during recovery without replacing the live feature', async({ page }) => {
  const unhandled = [];
  const reports = [];
  page.on('pageerror', error => unhandled.push(error.message));
  page.on('console', message => { if (message.type() === 'error') { reports.push(message.text()); } });
  await openRecords(page);
  await page.evaluate(async() => {
    const { application } = await import('/src/main.js');
    application.getChildApp('records').prepareStop = () => Promise.reject(new Error('Stop blocked'));
    application.getView().triggerMethod('retry:records');
  });
  await expect.poll(() => reports.some(value => value.includes('Could not recover records.'))).toBe(true);
  await expect(page.getByRole('status')).toHaveText('2 records');
  expect(unhandled).toEqual([]);
});
