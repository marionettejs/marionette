import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const require = createRequire(`${root}/package.json`);
const { chromium, expect } = require('@playwright/test');
const output = resolve(process.argv[2] ?? `${root}/test/tmp/formkit-pro/release-01304`);
const port = Number(process.argv[3] ?? 5190);
const stack = process.argv[4] ?? 'native';
if (!['native', 'vue', 'react'].includes(stack)) { throw new Error('Choose native, vue or react.'); }
mkdirSync(output, { recursive: true });
const sanitize = value => String(value).replace(/fk-[a-f0-9]+/gi, '[project-key]');
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true });
const report = { stack, node: process.version, playwright: require('@playwright/test/package.json').version,
  browser: browser.version(), coreVersion: '2.1.2', proVersion: '0.130.4', cases: [], pageErrors: [], requestFailures: [] };
let page;
try {
  page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => report.pageErrors.push(sanitize(error.message)));
  // Do not retain request URLs, headers or project configuration.
  page.on('requestfailed', request => report.requestFailures.push(request.failure()?.errorText ?? 'unknown'));
  const response = await page.request.get(`http://localhost:${port}/receipt.json`);
  if (!response.ok()) { throw new Error('Missing prepared consumer receipt.'); }
  report.consumer = await response.json();
  if (report.consumer.stack !== stack || report.consumer.versions['node_modules/@formkit/pro'] !== report.proVersion ||
    report.consumer.versions['node_modules/@formkit/core'] !== report.coreVersion) { throw new Error('Consumer version/stack mismatch.'); }
  await page.goto(`http://localhost:${port}/?mode=pro&scenario=release-01304`, { timeout: 15000 });
  await page.waitForFunction(() => window.proof?.observations?.bootstrap !== undefined && window.proof.observations.bootstrap !== 'pending');
  report.bootstrap = await page.evaluate(() => window.proof.observations.bootstrap);
  if (report.bootstrap === 'ready') {
    await page.waitForFunction(() => !!window.proof.release);
    const check = async(name, operation) => {
      try { const actual = await operation(); report.cases.push({ name, passed: true, actual }); } catch (error) { report.cases.push({ name, passed: false, error: sanitize(error.message) }); }
    };
    const values = () => page.evaluate(() => window.proof.getValues().release);
    const settled = () => page.waitForFunction(() => window.proof.release.isSettled());
    await settled();
    await check('currency none retains USD/JPY/KWD precision and explicit override', async() => {
      for (const [name, text] of [['usd', '12.50'], ['jpy', '125'], ['kwd', '12.500'], ['override', '12.5']]) {
        await expect(page.locator(`#release-${name}`)).toHaveValue(text);
      }
      const current = await values();
      expect([current.usd, current.jpy, current.kwd, current.override].map(Number)).toEqual([12.5, 125, 12.5, 12.5]);
    });
    await check('currency edit/blur, external negative/zero replacement and reset', async() => {
      await page.locator('#release-usd').fill('21.25'); await page.locator('#release-usd').press('Tab');
      await expect.poll(async() => Number((await values()).usd)).toBe(21.25);
      await page.evaluate(() => {
        const current = window.proof.getValues();
        window.proof.setValues({ ...current, release: { ...current.release, usd: -7.25, jpy: 0 } });
      });
      await expect(page.locator('#release-usd')).toHaveValue('-7.25');
      await expect(page.locator('#release-jpy')).toHaveValue('0');
      await page.locator('#reset').click(); await settled();
      await expect(page.locator('#release-usd')).toHaveValue('12.50');
    });
    await check('showMask toggles partial presentation without replaying model commits', async() => {
      const input = page.locator('#release-mask');
      await input.focus(); await input.press('ControlOrMeta+A'); await input.press('Backspace'); await input.pressSequentially('12');
      await expect.poll(async() => (await values()).mask).toBe('12'); await settled();
      const shown = await input.inputValue();
      const before = await page.evaluate(() => window.proof.release.observations.maskCommits);
      await page.evaluate(() => window.proof.release.showMask(false));
      await expect(input).not.toHaveValue(shown);
      expect((await input.inputValue()).replace(/\D/g, '')).toBe('12');
      await page.evaluate(() => window.proof.release.showMask(true));
      await expect(input).toHaveValue(shown); await settled();
      expect((await values()).mask).toBe('12');
      expect(await page.evaluate(() => window.proof.release.observations.maskCommits)).toBe(before);
      await input.focus(); await input.press('ControlOrMeta+A'); await input.press('Backspace'); await input.pressSequentially('1234');
      await expect(input).toHaveValue('12/34');
      await expect.poll(async() => (await values()).mask).toBe('1234');
    });
    await check('late options resolve labels without changing single/multiple values', async() => {
      const before = await values();
      expect([before.dropdown, before.autocomplete, before.taglist]).toEqual(['alpha', 'alpha', ['alpha']]);
      await page.evaluate(() => window.proof.release.loadOptions());
      await expect(page.locator('#release-dropdown')).toBeVisible();
      await expect(page.locator('#release-dropdown')).toContainText('Loaded Alpha');
      await expect(page.locator('#release-autocomplete')).toHaveValue('Loaded Alpha');
      await expect(page.locator('#release-taglist_tag_0')).toBeVisible();
      await expect(page.locator('#release-taglist_tag_0')).toContainText('Loaded Alpha');
      const after = await values();
      expect([after.dropdown, after.autocomplete, after.taglist]).toEqual(['alpha', 'alpha', ['alpha']]);
    });
    const rows = page.locator('#release-rows_items > li');
    const rowValues = () => rows.locator('input').evaluateAll(inputs => inputs.map(input => input.value));
    const dragSecondPastThird = async() => {
      const target = rows.nth(2); await target.scrollIntoViewIfNeeded();
      const box = await target.boundingBox();
      if (!box) { throw new Error('Missing visible repeater drag target.'); }
      await rows.nth(1).locator('[id$="_drag_handle"]').dragTo(target, { targetPosition: { x: 20, y: box.height - 5 } });
    };
    await page.evaluate(() => {
      window.releaseDragEvents = [];
      const list = document.getElementById('release-rows_items');
      for (const type of ['dragstart', 'dragend']) { list.addEventListener(type, () => window.releaseDragEvents.push(type)); }
    });
    await check('real handle drag retains exactly one moved duplicate occurrence', async() => {
      await expect.poll(rowValues).toEqual(['Duplicate', 'Duplicate', 'Tail']);
      await dragSecondPastThird();
      await expect.poll(async() => (await values()).rows.map(row => row.name)).toEqual(['Duplicate', 'Tail', 'Duplicate']);
      await expect.poll(rowValues).toEqual(['Duplicate', 'Tail', 'Duplicate']);
      const events = await page.evaluate(() => window.releaseDragEvents);
      expect(events).toContain('dragstart'); expect(events).toContain('dragend');
      return { events };
    });
    await check('drag after whole-form replacement preserves count and edited model index', async() => {
      await page.locator('#replace').click(); await settled();
      await expect.poll(rowValues).toEqual(['Fresh', 'Fresh', 'Last']);
      await dragSecondPastThird();
      await expect.poll(async() => (await values()).rows.map(row => row.name)).toEqual(['Fresh', 'Last', 'Fresh']);
      await rows.nth(2).getByRole('textbox', { name: 'Row name', exact: true }).fill('Moved Fresh');
      await expect.poll(async() => (await values()).rows.map(row => row.name)).toEqual(['Fresh', 'Last', 'Moved Fresh']);
    });
    await check('target search filters/restores options without serializing wrappers', async() => {
      const target = page.locator('#release-transfer [role="option"]');
      await expect(target).toHaveCount(2);
      const before = await page.evaluate(() => window.proof.release.observations.optionSerializations);
      await page.locator('#release-transfer_target_search_input').fill('Alpha');
      await expect(target).toHaveCount(1); await expect(target).toContainText('Alpha target');
      await page.locator('#release-transfer_target_search_input').fill('');
      await expect(target).toHaveCount(2);
      expect((await values()).transfer).toEqual(['alpha', 'beta']);
      const after = await page.evaluate(() => window.proof.release.observations.optionSerializations);
      expect(after).toBe(before);
      await page.locator('#release-transfer_source_list_items [role="option"]').filter({ hasText: 'Gamma available' }).click();
      await expect.poll(async() => (await values()).transfer).toEqual(['alpha', 'beta', 'gamma']);
      return { before, after };
    });
    await check('release values submit, reset, and destroy through public bridges', async() => {
      await page.getByRole('button', { name: 'Submit', exact: true }).click();
      await expect.poll(() => page.evaluate(() => window.proof.observations.submissions.length)).toBe(1);
      const submitted = await page.evaluate(() => window.proof.observations.submissions[0].values.release);
      expect(submitted.rows.map(row => row.name)).toEqual(['Fresh', 'Last', 'Moved Fresh']);
      expect(submitted.mask).toBe('1234'); expect(Number(submitted.usd)).toBe(-7.25);
      await page.locator('#finish').click();
      await expect.poll(() => page.evaluate(() => window.proof.observations.submissions[0].state)).toBe('resolved');
      await page.locator('#reset').click(); await settled();
      await expect.poll(rowValues).toEqual(['Duplicate', 'Duplicate', 'Tail']);
      await page.locator('form').screenshot({ path: `${output}/${stack}-release-form.png` });
      await page.evaluate(() => window.proof.destroy());
      await expect(page.locator('form')).toHaveCount(0);
      expect(await page.evaluate(() => ['fixture-root', 'release-mask', 'release-rows', 'release-transfer'].some(id => window.proof.hasNode(id)))).toBe(false);
    });
  }
  report.runtimeErrors = await page.evaluate(() => window.proof.observations.errors.map(String));
  report.runtimeErrors = report.runtimeErrors.map(sanitize);
} catch (error) { report.failure = sanitize(error.message); } finally {
  await browser.close();
  report.passed = report.bootstrap === 'ready' && report.cases.length === 8 && report.cases.every(item => item.passed) &&
    !report.pageErrors.length && !report.runtimeErrors?.length && !report.failure;
  writeFileSync(`${output}/${stack}-release-01304.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ stack, bootstrap: report.bootstrap, passed: report.passed,
    casesPassed: report.cases.filter(item => item.passed).length, casesTotal: report.cases.length, failure: report.failure }));
  process.exitCode = report.passed ? 0 : 1;
}
