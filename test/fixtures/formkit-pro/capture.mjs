import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const root = resolve(import.meta.dirname, '../../..');
const output = process.argv[2] ?? resolve(root, 'test/tmp/formkit-pro/browser');
const basePort = Number(process.argv[3] ?? 5190);
const selectedStack = process.argv[4];
if (selectedStack && !['native', 'vue', 'react'].includes(selectedStack)) { throw new Error('Choose native, vue or react.'); }
const require = createRequire(`${root}/package.json`);
const { chromium } = require('playwright-core');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
const receipts = { node: process.version, playwright: require('playwright-core/package.json').version,
  proVersion: '0.130.3', coreVersion: '2.1.2', browser: browser.version(), stacks: {} };
mkdirSync(output, { recursive: true });
try {
  for (const [stack, port] of [['native', basePort], ['vue', basePort + 1], ['react', basePort + 2]]) {
    if (selectedStack && stack !== selectedStack) { continue; }
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const result = receipts.stacks[stack] = { cases: [], pageErrors: errors };
    const metadata = await page.request.get(`http://localhost:${port}/receipt.json`);
    if (!metadata.ok()) { throw new Error(`Missing consumer source receipt for ${stack}.`); }
    result.consumer = await metadata.json();
    if (result.consumer.stack !== stack || result.consumer.versions?.['node_modules/@formkit/pro'] !== receipts.proVersion ||
      result.consumer.versions?.['node_modules/@formkit/core'] !== receipts.coreVersion) {
      throw new Error(`Consumer stack or FormKit version mismatch for ${stack}. Prepare the pinned consumer before capture.`);
    }
    const check = async(name, operation) => {
      try { const actual = await operation(); result.cases.push({ name, passed: actual === true || actual?.passed === true, actual }); } catch (error) { result.cases.push({ name, passed: false, error: error.message }); }
    };
    for (const mode of ['pro', 'core']) {
      await page.goto(`http://localhost:${port}/?mode=${mode}`);
      await page.waitForFunction(() => window.proof?.observations && window.proof.observations.bootstrap !== 'pending');
      const label = await page.locator('#mode').textContent();
      if (!label.endsWith(`Mode: ${mode}; FormKit core ${receipts.coreVersion}; Pro ${receipts.proVersion}`)) {
        throw new Error(`Consumer version label mismatch for ${stack}.`);
      }
      result[mode] = await page.evaluate(() => window.proof.observations);
      if (mode === 'pro') { await page.screenshot({ path: `${output}/${stack}-pro-bootstrap.png`, fullPage: true }); }
    }
    await page.waitForFunction(() => typeof window.proof.getValues === 'function');
    await page.locator('#contact-name').waitFor();
    result.core = await page.evaluate(() => window.proof.observations);
    await check('explicit root id matches the form and public registry', async() => page.evaluate(() =>
      document.querySelector('form').id === 'fixture-root' && window.proof.hasNode('fixture-root')));
    await check('mounted plugin finds connected text/email controls', async() => {
      const mounts = result.core.mounted.filter(item => ['contact-name', 'contact-email'].includes(item.id));
      return mounts.length === 2 && mounts.every(item => item.found && item.connected);
    });
    await check('required invalid submit has associated errors/help and no callback', async() => {
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.formkit-message'));
      return page.evaluate(() => {
        const input = document.querySelector('#contact-name');
        const refs = (input.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean);
        return refs.length >= 2 && refs.every(id => document.getElementById(id)) &&
          document.querySelector('label[for="contact-name"]')?.textContent === 'Name' && window.proof.observations.submissions.length === 0;
      });
    });
    await check('controlled replacement updates values and existing DOM', async() => {
      await page.evaluate(() => { window.retainedControl = document.querySelector('#contact-name'); });
      await page.getByRole('button', { name: 'Replace values', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#contact-name').value === 'Ada');
      return page.evaluate(() => document.querySelector('#contact-name') === window.retainedControl &&
        window.proof.getValues().contact.email === 'ada@example.test' && document.querySelector('#contact-email').value === 'ada@example.test');
    });
    await check('class update preserves inherited layer and selection', async() => {
      await page.locator('#contact-name').focus();
      await page.evaluate(() => { document.querySelector('#contact-name').setSelectionRange(1, 2); window.proof.classes({ input: 'local-second' }); });
      await page.waitForFunction(() => document.querySelector('#contact-name').classList.contains('local-second'));
      return page.evaluate(() => {
        const input = document.querySelector('#contact-name');
        return input.classList.contains('inherited') && !input.classList.contains('local-first') && document.activeElement === input && input.selectionStart === 1;
      });
    });
    await check('removing local class section clears its previous classes', async() => {
      await page.evaluate(() => window.proof.classes({}));
      await page.waitForTimeout(100);
      return page.evaluate(() => !document.querySelector('#contact-name').classList.contains('local-second') && document.querySelector('#contact-name').classList.contains('inherited'));
    });
    await check('schema config updates the existing control', async() => {
      await page.evaluate(() => window.proof.configuration({ disabled: true }));
      await page.waitForFunction(() => document.querySelector('#contact-name').disabled);
      const retained = await page.evaluate(() => document.querySelector('#contact-name') === window.retainedControl);
      await page.evaluate(() => window.proof.configuration({ disabled: undefined }));
      await page.waitForFunction(() => !document.querySelector('#contact-name').disabled);
      return retained;
    });
    await check('submitAttrs updates component props and raw attributes', async() => {
      await page.evaluate(() => window.proof.submitProps({ inputClass: 'pay-button', help: 'Review before paying', 'data-purpose': 'pay' }));
      await page.waitForFunction(() => document.querySelector('button[type=submit]').classList.contains('pay-button'));
      return page.evaluate(() => document.querySelector('button[type=submit]').dataset.purpose === 'pay' &&
        document.querySelector('form').textContent.includes('Review before paying'));
    });
    await check('disabled state reaches and restores controls', async() => {
      await page.getByRole('button', { name: 'Toggle disabled', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('#contact-name').disabled);
      await page.getByRole('button', { name: 'Toggle disabled', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('#contact-name').disabled);
      return true;
    });
    await check('pending submit disables the action and suppresses an actual repeated requestSubmit', async() => {
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await page.waitForFunction(() => window.proof.observations.submissions.length === 1);
      const disabled = await page.getByRole('button', { name: 'Submit', exact: true }).isDisabled();
      const duplicate = await page.evaluate(async() => {
        const before = window.proof.observations.submissions.length;
        document.querySelector('form').requestSubmit();
        await new Promise(done => setTimeout(done, 100));
        return { method: 'HTMLFormElement.requestSubmit', attempts: 2, before, after: window.proof.observations.submissions.length };
      });
      await page.evaluate(() => window.proof.finish());
      await page.waitForFunction(() => window.proof.observations.submissions[0].state === 'resolved');
      const callbacks = await page.evaluate(() => window.proof.observations.submissions.length);
      return { passed: disabled && duplicate.before === 1 && duplicate.after === 1 && callbacks === 1, disabled, duplicate, callbacks };
    });
    await check('resolved callback sets associated root and field server errors', async() => {
      await page.getByRole('button', { name: 'Toggle server rejection', exact: true }).click();
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await page.waitForFunction(() => window.proof.observations.submissions.at(-1)?.state === 'pending');
      await page.evaluate(() => window.proof.finish());
      await page.waitForFunction(() => window.proof.observations.submissions.at(-1)?.state === 'rejected');
      await page.waitForFunction(() => document.body.textContent.includes('Email is unavailable.'));
      return page.evaluate(() => document.body.textContent.includes('Server rejected this registration.') &&
        (document.querySelector('#contact-email').getAttribute('aria-describedby') ?? '').split(' ').some(id => document.getElementById(id)?.textContent.includes('Email is unavailable.')));
    });
    await page.screenshot({ path: `${output}/${stack}-core-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${output}/${stack}-core-mobile.png`, fullPage: true });
    await check('390px viewport has no horizontal page overflow', async() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await check('reset restores construction values and clears server errors', async() => {
      await page.locator('#reset').click();
      await page.waitForFunction(() => document.querySelector('#contact-name').value === '');
      return page.evaluate(() => window.proof.getValues().contact.email === '' && !document.body.textContent.includes('Email is unavailable.'));
    });
    await check('destroy clears input registry and owned DOM', async() => {
      await page.getByRole('button', { name: 'Destroy', exact: true }).click();
      await page.waitForFunction(() => !document.querySelector('#contact-name'));
      return page.evaluate(() => !window.proof.hasNode('contact-name') && !window.proof.hasNode('contact-email'));
    });
    result.final = await page.evaluate(() => window.proof.observations);
    await page.close();
    writeFileSync(`${output}/parity-baseline.json`, `${JSON.stringify(receipts, null, 2)}\n`);
  }
} finally { await browser.close(); }
console.log(JSON.stringify(receipts, null, 2));
process.exitCode = Object.values(receipts.stacks).some(stack => stack.pro.bootstrap !== 'ready' || stack.cases.some(test => !test.passed) ||
  stack.pageErrors.length || [stack.pro, stack.core, stack.final].some(observation => observation.errors.length)) ? 1 : 0;
