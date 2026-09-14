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
      otherAppReadsDisplayed: other.getView() === displayed,
      hostReadsDisplayed: region.currentView === displayed
    };
    first.showView();
    const after = {
      oldDestroyed: displayed.isDestroyed(),
      replacementConnected: prepared.el.isConnected,
      bothReadHost: first.getView() === region.currentView && other.getView() === region.currentView
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
    preparingAppReadsPending: true, otherAppReadsDisplayed: true, hostReadsDisplayed: true
  });
  assert.deepEqual(result.after, { oldDestroyed: true, replacementConnected: true, bothReadHost: true });
  assert.deepEqual(result.detached, { bothEmpty: true, alive: true });
  assert.equal(result.released, true);
});
