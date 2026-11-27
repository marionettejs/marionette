import assert from 'node:assert/strict';
import { deltaMetrics, observedMemory } from './cdp-milestones.mjs';

const depth = 1500;

async function openProbe(browser, origin, arm, front) {
  const context = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  try {
    await context.route('**/*', route => route.request().url().startsWith(`${origin}/`) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    await page.goto(`${origin}/?arm=${arm}&fields=${depth}&shape=flat&position=${front ? 'front' : 'middle'}`);
    await page.waitForFunction(() => window.bench);
    return { context, page, cdp: await context.newCDPSession(page) };
  } catch (error) {
    await context.close();
    throw error;
  }
}

async function mount(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Mount milestone timeout')), 12000);
    window.bench.mount().then(resolve, reject).finally(() => clearTimeout(id));
  }));
}

async function destroy(page) {
  await page.evaluate(() => new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('Destroy milestone timeout')), 12000);
    window.bench.observeDestroy().then(resolve, reject).finally(() => clearTimeout(id));
  }));
  const { destroyedCount, teardownMs, fullDestroyMs, afterDisposeReceiptCount } = await page.evaluate(() => window.bench.report);
  assert.equal(destroyedCount, depth + 1);
  return { destroyedCount, teardownMs, fullDestroyMs, afterDisposeReceiptCount };
}

export async function rendererStages(browser, origin, arm, front) {
  const { context, page, cdp } = await openProbe(browser, origin, arm, front);
  try {
    await cdp.send('Performance.enable', { timeDomain: 'threadTicks' });
    const beforeMount = await cdp.send('Performance.getMetrics');
    await mount(page);
    const afterMount = await cdp.send('Performance.getMetrics');
    const id = front ? 1 : Math.floor(depth / 2);
    const input = page.locator(`#field-${id}`);
    // Positioning is intentionally inside its own measured stage.
    await input.scrollIntoViewIfNeeded();
    await input.focus();
    await input.evaluate(el => { el.setSelectionRange(el.value.length, el.value.length); });
    const value = `original-${id}z`;
    await page.evaluate(expected => window.bench.armEdit(expected), value);
    const positioned = await cdp.send('Performance.getMetrics');
    await page.keyboard.press('z');
    await page.waitForFunction(expected => window.bench.report.events.at(-1)?.value === expected, value);
    const committed = await cdp.send('Performance.getMetrics');
    const edit = await page.evaluate(() => window.bench.report.events.at(-1));
    assert.ok(edit.trusted && edit.key?.trusted && edit.key.code === 'KeyZ');
    const disposal = await destroy(page);
    const afterDestroy = await cdp.send('Performance.getMetrics');
    return { arm, front, edit, disposal, units: 'renderer thread ms', metrics: {
      mountSettled: deltaMetrics(beforeMount, afterMount),
      positionAndArm: deltaMetrics(afterMount, positioned),
      keyThroughCommit: deltaMetrics(positioned, committed),
      fullDestroy: deltaMetrics(committed, afterDestroy),
    } };
  } finally {
    await context.close();
  }
}

export async function idleControl(browser, origin, arm) {
  const { context, cdp } = await openProbe(browser, origin, arm, false);
  try {
    const readings = [];
    for (let i = 0; i < 6; i++) {
      readings.push(await observedMemory(cdp, true));
    }
    return { arm, readings };
  } finally {
    await context.close();
  }
}

export async function retainedAfterCycles(browser, origin, arm) {
  const { context, page, cdp } = await openProbe(browser, origin, arm, false);
  try {
    await mount(page);
    await destroy(page);
    const baseline = await observedMemory(cdp, true);
    const cycles = [];
    for (let i = 0; i < 5; i++) {
      await mount(page);
      const live = await observedMemory(cdp, true);
      const disposal = await destroy(page);
      const retained = await observedMemory(cdp, true);
      cycles.push({ live, retained, disposal });
    }
    return { arm, baseline, cycles };
  } finally {
    await context.close();
  }
}
