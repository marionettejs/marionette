import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, CollectionView, Region, View } from 'marionette';

const Layout = View.extend({
  template: () => '<header></header><main></main>',
  regions: { header: 'header', content: 'main' }
});

describe('Application prepared root View', () => {
  const apps = [];
  const owners = [];
  const views = [];
  let host;

  function application(options) {
    host = document.createElement('section');
    document.body.append(host);
    const app = new Application({ region: { el: host }, ...options });
    apps.push(app);
    return app;
  }

  function view(options) {
    const root = new Layout(options);
    views.push(root);
    return root;
  }

  afterEach(async() => {
    for (const app of apps.splice(0)) { await app.destroy(); }
    for (const owner of owners.splice(0)) { owner.destroy(); }
    for (const root of views.splice(0)) { root.destroy(); }
    host?.remove();
  });

  it('composes detached children through getView and updates one region after display', () => {
    const app = application();
    const onRender = vi.fn();
    const root = view();
    root.on('render', onRender);
    const header = new View({ template: () => 'Header' });
    const content = new View({ template: () => '<input value="Initial">' });
    const attachments = [];
    root.on('attach', () => attachments.push([root.el.isConnected, header.el.isConnected, content.el.isConnected]));
    const showHeader = child => app.getView().showChildView('header', child);

    expect(app.setView(root)).toBe(root);
    expect(app.getView()).toBe(root);
    expect(root.isRendered()).toBe(false);
    expect(app.getRegion().currentView).toBeUndefined();
    showHeader(header);
    app.getView().showChildView('content', content);
    expect(root.el.isConnected).toBe(false);
    expect(header.isAttached()).toBe(false);
    expect(content.isAttached()).toBe(false);
    expect(host.childElementCount).toBe(0);

    expect(app.showView()).toBe(root);
    expect(app.getRegion().currentView).toBe(root);
    expect(attachments).toEqual([[true, true, true]]);
    expect(header.isAttached()).toBe(true);
    expect(content.isAttached()).toBe(true);
    expect(onRender).toHaveBeenCalledTimes(1);

    const input = content.el.querySelector('input');
    input.value = 'Edited';
    const replacement = new View({ template: () => 'Updated header' });
    showHeader(replacement);
    expect(header.isDestroyed()).toBe(true);
    expect(app.getView()).toBe(root);
    expect(root.getChildView('content')).toBe(content);
    expect(content.el.querySelector('input')).toBe(input);
    expect(input.value).toBe('Edited');
    expect(replacement.el.isConnected).toBe(true);
    expect(app.showView()).toBe(root);
    expect(attachments).toHaveLength(1);
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it('selects the same root idempotently before and after display', () => {
    const app = application();
    const onDestroy = vi.fn();
    const root = view();
    root.on('destroy', onDestroy);
    app.setView(root);
    expect(app.setView(root)).toBe(root);
    app.showView();
    expect(app.setView(root)).toBe(root);
    expect(root.isAttached()).toBe(true);
    expect(onDestroy).not.toHaveBeenCalled();
  });

  it('destroys a superseded prepared root and its children without replacing the displayed root', () => {
    const app = application();
    const displayed = view();
    app.showView(displayed);
    const prepared = view();
    const child = new View({ template: false });
    app.setView(prepared);
    prepared.showChildView('header', child);
    const replacement = view();
    app.setView(replacement);
    expect(prepared.isDestroyed()).toBe(true);
    expect(child.isDestroyed()).toBe(true);
    expect(displayed.isDestroyed()).toBe(false);
    expect(app.getRegion().currentView).toBe(displayed);
    expect(displayed.el.isConnected).toBe(true);
    expect(app.getView()).toBe(replacement);
    expect(replacement.isRendered()).toBe(false);
    app.showView();
    expect(displayed.isDestroyed()).toBe(true);
    expect(app.getRegion().currentView).toBe(replacement);
  });

  it('cancels preparation by selecting the already displayed root', () => {
    const app = application();
    const displayed = view();
    const prepared = view();
    app.showView(displayed);
    app.setView(prepared);
    expect(app.setView(displayed)).toBe(displayed);
    expect(prepared.isDestroyed()).toBe(true);
    expect(displayed.isAttached()).toBe(true);
    expect(app.getView()).toBe(displayed);
  });

  it('reveals the displayed root when a prepared replacement destroys itself', () => {
    const app = application();
    const displayed = view();
    const prepared = view();
    app.showView(displayed);
    app.setView(prepared);
    prepared.destroy();
    expect(app.getView()).toBe(displayed);
    expect(displayed.isDestroyed()).toBe(false);
  });

  it('releases a displayed association when external teardown removes the host first', () => {
    const app = application();
    const root = view();
    app.showView(root);
    root.on('before:destroy', () => app.stop());

    root.destroy();

    expect(root.isDestroyed()).toBe(true);
    expect(app.getView()).toBeUndefined();
    expect(app.getRegion().currentView).toBeUndefined();
  });

  it('can show a prepared replacement from a completed Region empty event', () => {
    const app = application();
    const displayed = view();
    const replacement = view();
    app.showView(displayed);
    app.setView(replacement);
    app.getRegion().on('empty', () => app.showView());

    app.getRegion().empty();

    expect(displayed.isDestroyed()).toBe(true);
    expect(app.getView()).toBe(replacement);
    expect(app.getRegion().currentView).toBe(replacement);
  });

  for (const operation of ['stop', 'restart', 'destroy']) {
    for (const running of [false, true]) {
      it(`${operation} destroys a never-displayed root while ${running ? 'running' : 'stopped'}`, async() => {
        const app = application();
        if (running) { await app.start(); }
        const root = view();
        const child = new View({ template: false });
        app.setView(root);
        root.showChildView('header', child);
        expect(await app[operation]()).toBe(true);
        expect(root.isDestroyed()).toBe(true);
        expect(child.isDestroyed()).toBe(true);
        expect(app.getView()).toBeUndefined();
      });
    }
  }

  for (const operation of ['stop', 'restart', 'destroy']) {
    it(`${operation} destroys both a prepared replacement and the displayed root`, async() => {
      const app = application();
      await app.start();
      const displayed = view();
      const prepared = view();
      app.showView(displayed);
      app.setView(prepared);
      expect(await app[operation]()).toBe(true);
      expect(displayed.isDestroyed()).toBe(true);
      expect(prepared.isDestroyed()).toBe(true);
      expect(app.getView()).toBeUndefined();
    });
  }

  it('clears a prepared root destroyed directly and releases its ownership listeners', () => {
    const app = application();
    const root = view();
    const off = vi.spyOn(root, 'off');
    app.setView(root);
    root.destroy();
    expect(app.getView()).toBeUndefined();
    expect(off).toHaveBeenCalledWith('destroy', expect.any(Function), app);
  });

  it('rejects another owner without destroying the previously selected root', () => {
    const app = application();
    const root = view();
    app.setView(root);
    const otherApp = new Application();
    const otherRegion = new Region({ el: document.createElement('section') });
    const collection = new CollectionView();
    apps.push(otherApp);
    owners.push(otherRegion, collection);
    expect(() => otherApp.setView(root)).toThrow(expect.objectContaining({ code: 'MN0003' }));
    expect(() => otherRegion.show(root)).toThrow(expect.objectContaining({ code: 'MN0003' }));
    expect(() => collection.addChildView(root)).toThrow(expect.objectContaining({ code: 'MN0003' }));
    const foreign = view();
    otherRegion.show(foreign);
    expect(() => app.setView(foreign)).toThrow(expect.objectContaining({ code: 'MN0003' }));
    expect(app.getView()).toBe(root);
    expect(root.isDestroyed()).toBe(false);
  });

  it('rejects a destroyed root without replacing the selected root', () => {
    const app = application();
    const root = view();
    const destroyed = view();
    app.setView(root);
    destroyed.destroy();
    expect(() => app.setView(destroyed)).toThrow(expect.objectContaining({ code: 'MN0007' }));
    expect(app.getView()).toBe(root);
  });

  it('hands ownership to the Region and releases Application subscriptions after display', async() => {
    const app = application();
    const root = view();
    const off = vi.spyOn(root, 'off');
    app.setView(root);
    app.showView();
    expect(off).toHaveBeenCalledWith('destroy', expect.any(Function), app);
    const other = new Application({ region: { el: document.createElement('section') } });
    apps.push(other);
    expect(() => other.setView(root)).toThrow(expect.objectContaining({ code: 'MN0003' }));
    expect(app.getRegion().detachView()).toBe(root);
    expect(app.getView()).toBeUndefined();
    other.showView(root);
    await app.destroy();
    expect(root.isDestroyed()).toBe(false);
    expect(other.getView()).toBe(root);
  });

  it('rejects a displayed root selected by another Application while preserving preparation', () => {
    const app = application();
    const other = new Application({ region: app.getRegion() });
    apps.push(other);
    const root = view();
    app.showView(root);
    expect(other.getView()).toBeUndefined();
    const pending = view();
    other.setView(pending);
    expect(() => other.setView(root)).toThrow(expect.objectContaining({ code: 'MN0003' }));
    expect(other.getView()).toBe(pending);
    expect(app.getView()).toBe(root);
    expect(app.getRegion().detachView()).toBe(root);
    expect(app.getView()).toBeUndefined();
    expect(other.setView(root)).toBe(root);
    expect(other.showView()).toBe(root);
    expect(other.getView()).toBe(root);
  });

  it('allows coordinated Applications to display distinct roots in a borrowed host', async() => {
    const region = new Region({ el: document.createElement('section') });
    owners.push(region);
    const first = application({ region });
    const second = new Application({ region });
    apps.push(second);
    const firstRoot = view();
    const secondRoot = view();
    first.showView(firstRoot);
    second.setView(secondRoot);
    expect(first.getView()).toBe(firstRoot);
    expect(second.getView()).toBe(secondRoot);
    second.showView();
    expect(firstRoot.isDestroyed()).toBe(true);
    expect(first.getView()).toBeUndefined();
    expect(second.getView()).toBe(secondRoot);
    expect(region.currentView).toBe(secondRoot);
    await first.stop();
    expect(secondRoot.isDestroyed()).toBe(false);
    expect(region.currentView).toBe(secondRoot);
    await second.stop();
    expect(secondRoot.isDestroyed()).toBe(true);
    expect(region.isDestroyed()).toBe(false);
  });

  it('rejects a directly displayed root while preserving a prepared replacement', () => {
    const app = application();
    const displayed = view();
    const pending = view();
    app.setView(pending);
    app.getRegion().show(displayed);
    expect(() => app.setView(displayed)).toThrow(expect.objectContaining({ code: 'MN0003' }));
    expect(() => app.showView(displayed)).toThrow(expect.objectContaining({ code: 'MN0003' }));
    expect(app.getView()).toBe(pending);
    expect(app.getRegion().currentView).toBe(displayed);
  });

  it('keeps a displayed root selected when an ancestor View detaches its host element', async() => {
    const outerRegion = new Region({ el: host });
    owners.push(outerRegion);
    const outer = new View({
      template: () => '<div class="application-host"></div>',
      regions: { application: '.application-host' }
    });
    outerRegion.show(outer);
    const app = application({ region: outer.getRegion('application') });
    const root = view();
    app.showView(root);

    expect(outerRegion.detachView()).toBe(outer);
    expect(app.getView()).toBe(root);
    expect(app.getRegion().currentView).toBe(root);

    await app.stop();
    outer.destroy();
  });

  it('does not let external host changes overwrite a prepared root', async() => {
    const app = application();
    const root = view();
    const external = view();
    app.setView(root);
    app.getRegion().show(external);
    app.getRegion().empty();
    expect(app.getView()).toBe(root);
    const replacement = view();
    app.getRegion().show(replacement);
    app.showView();
    expect(replacement.isDestroyed()).toBe(true);
    expect(app.getView()).toBe(root);
    expect(app.getRegion().currentView).toBe(root);
    await app.stop();
    expect(root.isDestroyed()).toBe(true);
  });

  it('keeps a root prepared after an allowed missing mount, then displays it later', () => {
    const app = application({ region: { el: '#prepared-later', allowMissingEl: true } });
    const root = view();
    app.setView(root);
    expect(app.showView()).toBe(root);
    expect(app.getView()).toBe(root);
    expect(app.getRegion().currentView).toBeUndefined();
    const other = new Application();
    apps.push(other);
    expect(() => other.setView(root)).toThrow(expect.objectContaining({ code: 'MN0003' }));
    app.getRegion().el = host;
    expect(app.showView()).toBe(root);
    expect(root.el.isConnected).toBe(true);
  });

  it('allows preparation without a host and showing without a selected root is a no-op', async() => {
    const app = application({ region: undefined });
    expect(app.showView()).toBeUndefined();
    const root = view();
    app.setView(root);
    expect(app.getView()).toBe(root);
    await app.stop();
    expect(root.isDestroyed()).toBe(true);
  });

  it('does not adopt or display a root once terminal teardown begins', async() => {
    const app = application();
    const root = view();
    app.on('before:destroy', () => {
      expect(app.setView(root)).toBe(root);
      expect(app.showView()).toBeUndefined();
      expect(app.getView()).toBeUndefined();
    });
    await app.destroy();
    expect(app.setView(root)).toBe(root);
    expect(app.getView()).toBeUndefined();
    expect(root.isDestroyed()).toBe(false);
  });
});
