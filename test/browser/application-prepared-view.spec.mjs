import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('Application composes a detached root and preserves focused content across a header update', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Application, View } = await import('marionette');
    const attachments = [];
    let renders = 0;
    const Layout = View.extend({
      template: () => '<header></header><main></main>',
      regions: { header: 'header', content: 'main' },
      onRender() { renders += 1; },
      onAttach() {
        attachments.push({
          root: this.el.isConnected,
          header: this.getChildView('header').el.isConnected,
          content: this.getChildView('content').el.isConnected
        });
      }
    });
    const Header = View.extend({ template: () => 'Header' });
    const Content = View.extend({ template: () => '<input aria-label="Draft" value="Initial">' });
    const Controller = Application.extend({
      region: '#content',
      showHeader() { this.getView().showChildView('header', new Header()); }
    });
    const app = new Controller();
    app.setView(new Layout());
    app.showHeader();
    app.getView().showChildView('content', new Content());
    const root = app.getView();
    const firstHeader = root.getChildView('header');
    const content = root.getChildView('content');
    const before = {
      connected: [root, firstHeader, content].map(view => view.el.isConnected),
      attached: [root, firstHeader, content].map(view => view.isAttached()),
      hostChildren: document.querySelector('#content').childElementCount
    };
    app.showView();
    const input = content.el.querySelector('input');
    input.focus();
    input.value = 'Edited draft';
    app.showHeader();
    app.showView();
    const after = {
      sameRoot: app.getView() === root,
      sameContent: root.getChildView('content') === content,
      sameInput: content.el.querySelector('input') === input,
      focused: document.activeElement === input,
      value: input.value,
      oldHeaderDestroyed: firstHeader.isDestroyed(),
      newHeaderAttached: root.getChildView('header').isAttached(),
      attachments,
      renders
    };
    await app.destroy();
    return {
      before,
      after,
      cleanup: {
        hostChildren: document.querySelector('#content').childElementCount,
        rootDestroyed: root.isDestroyed(),
        contentDestroyed: content.isDestroyed(),
        cleared: app.getView() === undefined
      }
    };
  });
  assert.deepEqual(result.before, {
    connected: [false, false, false], attached: [false, false, false], hostChildren: 0
  });
  assert.deepEqual(result.after, {
    sameRoot: true, sameContent: true, sameInput: true, focused: true,
    value: 'Edited draft', oldHeaderDestroyed: true, newHeaderAttached: true,
    attachments: [{ root: true, header: true, content: true }], renders: 1
  });
  assert.deepEqual(result.cleanup, {
    hostChildren: 0, rootDestroyed: true, contentDestroyed: true, cleared: true
  });
});

test('preparing a replacement preserves the displayed screen until Region adoption', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Application, Region, View } = await import('marionette');
    const region = new Region({ el: '#content' });
    const first = new Application({ region });
    const other = new Application({ region });
    const displayed = new View({ template: () => '<input aria-label="Current draft" value="Draft">' });
    first.showView(displayed);
    const input = displayed.el.querySelector('input');
    input.focus();
    input.value = 'Unsaved edit';
    const prepared = new View({ template: () => '<p>Replacement</p>' });
    first.setView(prepared);
    prepared.render();
    const before = {
      preparedDetached: !prepared.el.isConnected,
      oldConnected: displayed.el.isConnected,
      focusPreserved: document.activeElement === input,
      value: input.value,
      preparingAppReadsPending: first.getView() === prepared,
      otherAppHasNoSelection: other.getView() === undefined,
      hostReadsDisplayed: region.currentView === displayed
    };
    first.showView();
    const after = {
      oldDestroyed: displayed.isDestroyed(),
      replacementConnected: prepared.el.isConnected,
      firstOwnsReplacement: first.getView() === region.currentView,
      otherDoesNotAdoptReplacement: other.getView() === undefined
    };
    region.detachView();
    const detached = {
      bothEmpty: first.getView() === undefined && other.getView() === undefined,
      alive: !prepared.isDestroyed()
    };
    await first.destroy();
    await other.destroy();
    const released = !prepared.isDestroyed();
    prepared.destroy();
    region.destroy();
    return { before, after, detached, released };
  });
  assert.deepEqual(result.before, {
    preparedDetached: true, oldConnected: true, focusPreserved: true, value: 'Unsaved edit',
    preparingAppReadsPending: true, otherAppHasNoSelection: true, hostReadsDisplayed: true
  });
  assert.deepEqual(result.after, {
    oldDestroyed: true, replacementConnected: true,
    firstOwnsReplacement: true, otherDoesNotAdoptReplacement: true
  });
  assert.deepEqual(result.detached, { bothEmpty: true, alive: true });
  assert.equal(result.released, true);
});

test('Applications sharing a borrowed Region stop only their own displayed root', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Application, Region, View } = await import('marionette');
    const region = new Region({ el: '#content' });
    const first = new Application({ region });
    const second = new Application({ region });
    const firstRoot = new View({ template: () => '<p>First</p>' });
    const secondRoot = new View({ template: () => '<input>' });
    await first.start();
    await second.start();
    first.showView(firstRoot);
    second.showView(secondRoot);
    const input = secondRoot.el.querySelector('input');
    input.focus();
    input.value = 'Edited draft';
    const before = {
      firstNoLongerOwnsDisplayed: first.getView() === undefined,
      secondOwnsDisplayed: second.getView() === secondRoot,
      current: region.currentView === secondRoot
    };
    await first.stop();
    const afterFirstStop = {
      firstView: first.getView() === undefined,
      secondAlive: !secondRoot.isDestroyed(),
      current: region.currentView === secondRoot,
      focusPreserved: document.activeElement === input,
      valuePreserved: input.value === 'Edited draft'
    };
    await second.stop();
    const afterSecondStop = {
      secondView: second.getView() === undefined,
      destroyed: secondRoot.isDestroyed(),
      current: region.currentView === undefined
    };
    await first.destroy();
    await second.destroy();
    region.destroy();
    return { before, afterFirstStop, afterSecondStop };
  });
  assert.deepEqual(result, {
    before: { firstNoLongerOwnsDisplayed: true, secondOwnsDisplayed: true, current: true },
    afterFirstStop: {
      firstView: true, secondAlive: true, current: true,
      focusPreserved: true, valuePreserved: true
    },
    afterSecondStop: { secondView: true, destroyed: true, current: true }
  });
});
