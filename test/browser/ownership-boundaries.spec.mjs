import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('replacement Regions release detached children without disturbing a later owner', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Region, View } = await import('marionette');
    const host = document.createElement('main');
    const firstSlot = document.createElement('section');
    const secondSlot = document.createElement('section');
    host.append(firstSlot, secondSlot);
    document.body.append(host);
    const first = new Region({ el: firstSlot, replaceElement: true });
    const second = new Region({ el: secondSlot, replaceElement: true });
    const child = new View({ template: () => '<input value="draft">' });
    const replacement = new View({ template: () => '<p>Replacement</p>' });
    try {
      first.show(child);
      const detached = first.detachView();
      const restoredAfterDetach = firstSlot.parentNode === host && !child.isDestroyed();
      second.show(detached);
      first.show(replacement);
      second.empty();
      const afterEmpty = child.isDestroyed() && first.currentView === replacement &&
        replacement.el.parentNode === host && secondSlot.parentNode === host;
      first.destroy();
      second.destroy();
      return { restoredAfterDetach, afterEmpty, destroyed: replacement.isDestroyed(),
        restoredAfterDestroy: firstSlot.parentNode === host && secondSlot.parentNode === host };
    } finally {
      first.destroy();
      second.destroy();
      child.destroy();
      replacement.destroy();
      host.remove();
    }
  });
  assert.deepEqual(result, { restoredAfterDetach: true, afterEmpty: true,
    destroyed: true, restoredAfterDestroy: true });
});

test('host and Behavior delegation survives rerender and releases independent ownership', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Behavior, Region, View } = await import('marionette');
    const host = document.createElement('main');
    document.body.append(host);
    const calls = { host: 0, behavior: 0, destroyed: 0 };
    let behavior;
    const ClickBehavior = Behavior.extend({
      initialize() { behavior = this; },
      ui: { button: 'button' },
      events: { 'click @ui.button'() { calls.behavior++; } },
      destroy() { calls.destroyed++; return Behavior.prototype.destroy.call(this); }
    });
    const HostView = View.extend({
      template: () => '<button>Count</button>',
      behaviors: [ClickBehavior],
      events: { 'click button'() { calls.host++; } }
    });
    const region = new Region({ el: host });
    const view = new HostView();
    try {
      region.show(view);
      view.el.querySelector('button').click();
      view.render();
      const button = view.el.querySelector('button');
      button.click();
      const bothAfterRender = { ...calls };
      behavior.destroy();
      button.click();
      const hostAfterBehavior = !view.isDestroyed() && calls.host === 3 && calls.behavior === 2;
      region.empty();
      button.click();
      return { bothAfterRender, hostAfterBehavior, final: calls, destroyed: view.isDestroyed() };
    } finally {
      region.destroy();
      view.destroy();
      host.remove();
    }
  });
  assert.deepEqual(result, { bothAfterRender: { host: 2, behavior: 2, destroyed: 0 },
    hostAfterBehavior: true, final: { host: 3, behavior: 2, destroyed: 1 }, destroyed: true });
});

test('framework errors preserve native identity and usable stacks with the platform fallback', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { MarionetteError } = await import('marionette');
    const inspect = error => ({ native: error instanceof Error, code: error.code,
      message: error.message, stack: typeof error.stack === 'string' && error.stack.length > 0 });
    const make = () => new MarionetteError({ code: 'MN0030', message: 'Ownership conflict' });
    const normal = inspect(make());
    const descriptor = Object.getOwnPropertyDescriptor(Error, 'captureStackTrace');
    try {
      Object.defineProperty(Error, 'captureStackTrace', { configurable: true, value: undefined });
      return { normal, fallback: inspect(make()) };
    } finally {
      if (descriptor) { Object.defineProperty(Error, 'captureStackTrace', descriptor); }
      else { delete Error.captureStackTrace; }
    }
  });
  const expected = { native: true, code: 'MN0030', message: 'Ownership conflict', stack: true };
  assert.deepEqual(result, { normal: expected, fallback: expected });
});
