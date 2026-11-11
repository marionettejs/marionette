import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expectedBrowserBuilds, verifyProvisionedBrowsers } from '../../scripts/checks/provisioned-browsers.mjs';

const expected = ['chromium', 'firefox', 'webkit'].map((name, index) => ({ name, version: `${index + 1}.0` }));

function fixture(overrides = {}) {
  const opened = [];
  const closed = [];
  const browserTypes = Object.fromEntries(expected.map(({ name, version }) => [name, {
    async launch(options) {
      assert.deepEqual(options, { headless: true, timeout: 30_000 });
      opened.push(name);
      if (overrides[name] instanceof Error) { throw overrides[name]; }
      return {
        version: () => overrides[name] ?? version,
        async close() { closed.push(name); },
      };
    },
  }]));
  return { browserTypes, opened, closed };
}

test('provisioning launches every supported engine and closes each executable', async() => {
  const { browserTypes, opened, closed } = fixture();
  assert.deepEqual(await verifyProvisionedBrowsers(browserTypes, expected), ['chromium 1.0', 'firefox 2.0', 'webkit 3.0']);
  assert.deepEqual(opened, ['chromium', 'firefox', 'webkit']);
  assert.deepEqual(closed, opened);
});

test('an image with the wrong browser version fails and still closes the browser', async() => {
  const { browserTypes, opened, closed } = fixture({ firefox: '99.0' });
  await assert.rejects(verifyProvisionedBrowsers(browserTypes, expected), /firefox executable must match/);
  assert.deepEqual(opened, ['chromium', 'firefox']);
  assert.deepEqual(closed, opened);
});

test('a missing executable or system library cannot be reported as provisioned', async() => {
  const { browserTypes, opened, closed } = fixture({ webkit: new Error('Missing shared library') });
  await assert.rejects(verifyProvisionedBrowsers(browserTypes, expected), /Missing shared library/);
  assert.deepEqual(opened, ['chromium', 'firefox', 'webkit']);
  assert.deepEqual(closed, ['chromium', 'firefox']);
});

test('an incomplete browser inventory fails before any browser is launched', async() => {
  const { browserTypes, opened } = fixture();
  await assert.rejects(verifyProvisionedBrowsers(browserTypes, expected.slice(0, 1)), /all three supported engines/);
  assert.deepEqual(opened, []);
});

test('HTML can verify its own locked Playwright version independently of the root release profile', () => {
  const version = '1.66.0';
  const input = {
    manifest: { devDependencies: { '@playwright/test': version } },
    lock: { packages: {
      'node_modules/@playwright/test': { version },
      'node_modules/playwright-core': { version },
    } },
    installedVersion: version,
    browserDefinitions: expected.map(({ name, version: browserVersion }) => ({ name, browserVersion })),
  };
  assert.deepEqual(expectedBrowserBuilds(input), expected);
  assert.throws(() => expectedBrowserBuilds({ ...input, installedVersion: '1.65.0' }), /package being tested/);
  assert.throws(() => expectedBrowserBuilds({ ...input, profile: { version: '1.65.0', browserBuilds: expected } }), /root release profile/);
  assert.deepEqual(expectedBrowserBuilds({ ...input, profile: { version, browserBuilds: expected } }), expected);
});

test('missing browser-version metadata cannot pass executable verification', async() => {
  const { browserTypes, opened } = fixture();
  await assert.rejects(verifyProvisionedBrowsers(browserTypes, expected.map(entry => ({ name: entry.name }))), /expected browser version/);
  assert.deepEqual(opened, []);
});
