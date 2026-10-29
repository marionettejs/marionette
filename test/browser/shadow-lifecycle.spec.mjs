import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

test('light: adopted Lit View in connected host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'light', true, true);
});

test('light: adopted Lit View in detached host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'light', true, false);
});

test('light: Region-mounted Lit View in connected host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'light', false, true);
});

test('light: Region-mounted Lit View in detached host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'light', false, false);
});

test('open: adopted Lit View in connected host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'open', true, true);
});

test('open: adopted Lit View in detached host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'open', true, false);
});

test('open: Region-mounted Lit View in connected host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'open', false, true);
});

test('open: Region-mounted Lit View in detached host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'open', false, false);
});

test('closed: adopted Lit View in connected host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'closed', true, true);
});

test('closed: adopted Lit View in detached host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'closed', true, false);
});

test('closed: Region-mounted Lit View in connected host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'closed', false, true);
});

test('closed: Region-mounted Lit View in detached host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'closed', false, false);
});

test('iframe: adopted Lit View in connected host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'iframe', true, true);
});

test('iframe: Region-mounted Lit View in connected host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'iframe', false, true);
});

test('open: adopted Lit View under configured document host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'open', true, true, true);
});

test('open: Region-mounted Lit View under configured document host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'open', false, true, true);
});

test('closed: adopted Lit View under configured document host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'closed', true, true, true);
});

test('closed: Region-mounted Lit View under configured document host releases subscriptions', async({ page }) => {
  await checkLitLifecycle(page, 'closed', false, true, true);
});

async function checkLitLifecycle(page, treeKind, adopts, hostConnected, configuredDocumentHost = false) {
  const result = await page.evaluate(async({ tree, adopted, connected, documentHost }) => {
    const { Region, View } = await import('marionette');
    const { default: LitDomApi } = await import('@mnjs/adapters/dom/lit-html');
    const { html } = await import('lit-html');
    const { AsyncDirective } = await import('lit-html/async-directive.js');
    const { directive } = await import('lit-html/directive.js');
    const host = document.createElement(tree === 'iframe' ? 'iframe' : 'section');
    if (connected) { document.body.append(host); }
    const container = tree === 'iframe' ? host.contentDocument.body :
      tree === 'light' ? host : host.attachShadow({ mode: tree });
    const slot = container.ownerDocument.createElement('main');
    container.append(slot);
    const el = slot.ownerDocument.createElement('article');
    if (adopted) { slot.append(el); }
    const source = new EventTarget();
    const counts = { active: 0, deliveries: 0, disconnections: 0, attachments: 0, detachments: 0 };
    const watch = directive(class extends AsyncDirective {
      receive = () => { this.setValue(`tick:${++counts.deliveries}`); };
      subscribe() {
        if (this.listening) { return; }
        this.listening = true;
        counts.active++;
        source.addEventListener('tick', this.receive);
      }
      render() {
        if (this.isConnected) { this.subscribe(); }
        return 'watching';
      }
      reconnected() { this.subscribe(); }
      disconnected() {
        counts.disconnections++;
        if (!this.listening) { return; }
        this.listening = false;
        counts.active--;
        source.removeEventListener('tick', this.receive);
      }
    });
    const provider = documentHost ? { getDocumentEl: () => host } : {};
    const Panel = View.extend({
      template: () => html`<p>${watch()}</p>`,
      onAttach() { counts.attachments++; },
      onDetach() { counts.detachments++; }
    }).setDomApi({ ...LitDomApi, ...provider });
    const Container = Region.extend().setDomApi(provider);
    const view = new Panel({ el });
    const region = new Container({ el: slot });
    const snapshot = () => ({ ...counts, attached: view.isAttached(),
      connected: el.isConnected, text: el.textContent });
    const tick = () => source.dispatchEvent(new Event('tick'));
    try {
      view.render();
      const initial = snapshot();
      if (!adopted) { region.show(view); }
      tick();
      const mounted = snapshot();
      let detached;
      let reshown;
      if (!adopted) {
        region.detachView();
        tick();
        detached = snapshot();
        region.show(view);
        tick();
        reshown = snapshot();
      }
      view.destroy();
      tick();
      const destroyed = { ...snapshot(), destroyed: view.isDestroyed() };
      return { initial, mounted, detached, reshown, destroyed };
    } finally {
      view.destroy();
      region.destroy();
      // Release a leaking baseline directive even when the regression fails.
      LitDomApi.notifyDetach(el);
      host.remove();
    }
  }, { tree: treeKind, adopted: adopts, connected: hostConnected, documentHost: configuredDocumentHost });
  const active = hostConnected ? 1 : 0;
  // Assert teardown first so the adopted regression exposes late DOM writes.
  assert.deepEqual(result.destroyed, {
    active: 0, deliveries: hostConnected ? adopts ? 1 : 2 : 0,
    disconnections: hostConnected ? adopts ? 1 : 2 : 0,
    attachments: hostConnected && !adopts ? 2 : 0,
    detachments: hostConnected ? adopts ? 1 : 2 : 0,
    attached: false, connected: false,
    text: hostConnected ? adopts ? 'tick:1' : 'tick:2' : 'watching', destroyed: true
  });
  assert.deepEqual(result.initial, {
    active: adopts ? active : 0, deliveries: 0, disconnections: 0,
    attachments: 0, detachments: 0, attached: adopts && hostConnected,
    connected: adopts && hostConnected, text: 'watching'
  });
  assert.deepEqual(result.mounted, {
    active, deliveries: active, disconnections: 0,
    attachments: adopts ? 0 : active, detachments: 0,
    attached: hostConnected, connected: hostConnected, text: hostConnected ? 'tick:1' : 'watching'
  });
  if (!adopts) {
    assert.deepEqual(result.detached, {
      active: 0, deliveries: active, disconnections: active,
      attachments: active, detachments: active,
      attached: false, connected: false, text: hostConnected ? 'tick:1' : 'watching'
    });
    assert.deepEqual(result.reshown, {
      active, deliveries: active * 2, disconnections: active,
      attachments: active * 2, detachments: active,
      attached: hostConnected, connected: hostConnected, text: hostConnected ? 'tick:2' : 'watching'
    });
  }
}

test('strict containment and selector lookup do not cross shadow roots', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { DomApi, Region, View } = await import('marionette');
    return ['open', 'closed'].map(mode => {
      const host = document.createElement('section');
      document.body.append(host);
      const shadow = host.attachShadow({ mode });
      const slot = document.createElement('main');
      slot.className = 'shadow-slot';
      const child = document.createElement('p');
      slot.append(child);
      shadow.append(slot);
      const region = new Region({ el: '.shadow-slot', parentEl: host, allowMissingEl: true });
      const view = new View({ template: false });
      try {
        region.show(view);
        return {
          descendant: DomApi.hasEl(slot, child), self: DomApi.hasEl(slot, slot),
          nullChild: DomApi.hasEl(slot, null), missingChild: DomApi.hasEl(slot, undefined),
          shadowChild: DomApi.hasEl(shadow, slot), hostChild: DomApi.hasEl(host, slot),
          documentChild: DomApi.hasEl(document.documentElement, slot),
          queryCount: DomApi.findEl(host, '.shadow-slot').length, shown: region.hasView()
        };
      } finally {
        region.destroy();
        view.destroy();
        host.remove();
      }
    });
  });
  assert.deepEqual(result, Array(2).fill({ descendant: true, self: false,
    nullChild: false, missingChild: false, shadowChild: true, hostChild: false,
    documentChild: false, queryCount: 0, shown: false }));
});

test('open: nested detached shadow host follows managed ownership with monitoring enabled', async({ page }) => {
  await checkManagedShadowLifecycle(page, 'open', 'enabled');
});

test('open: nested detached shadow host follows managed ownership with monitoring child-disabled', async({ page }) => {
  await checkManagedShadowLifecycle(page, 'open', 'child-disabled');
});

test('open: nested detached shadow host follows managed ownership with monitoring ancestor-disabled', async({ page }) => {
  await checkManagedShadowLifecycle(page, 'open', 'ancestor-disabled');
});

test('closed: nested detached shadow host follows managed ownership with monitoring enabled', async({ page }) => {
  await checkManagedShadowLifecycle(page, 'closed', 'enabled');
});

test('closed: nested detached shadow host follows managed ownership with monitoring child-disabled', async({ page }) => {
  await checkManagedShadowLifecycle(page, 'closed', 'child-disabled');
});

test('closed: nested detached shadow host follows managed ownership with monitoring ancestor-disabled', async({ page }) => {
  await checkManagedShadowLifecycle(page, 'closed', 'ancestor-disabled');
});

async function checkManagedShadowLifecycle(page, shadowMode, policy) {
  const result = await page.evaluate(async({ mode, monitoring }) => {
    const { Region, View } = await import('marionette');
    const { default: LitDomApi } = await import('@mnjs/adapters/dom/lit-html');
    const { html } = await import('lit-html');
    const { AsyncDirective } = await import('lit-html/async-directive.js');
    const { directive } = await import('lit-html/directive.js');
    const host = document.createElement('section');
    const inner = document.createElement('section');
    host.attachShadow({ mode }).append(inner);
    const slot = document.createElement('main');
    inner.attachShadow({ mode: mode === 'open' ? 'closed' : 'open' }).append(slot);
    const source = new EventTarget();
    let active = 0;
    let deliveries = 0;
    const watch = directive(class extends AsyncDirective {
      receive = () => { this.setValue(`tick:${++deliveries}`); };
      render() { return 'watching'; }
      reconnected() { active++; source.addEventListener('tick', this.receive); }
      disconnected() { active--; source.removeEventListener('tick', this.receive); }
    });
    const Parent = View.extend({
      template: false, regions: { child: { el: slot } },
      monitorViewEvents: monitoring !== 'ancestor-disabled'
    });
    const Child = View.extend({
      template: () => html`<p>${watch()}</p>`,
      monitorViewEvents: monitoring !== 'child-disabled'
    }).setDomApi(LitDomApi);
    const parent = new Parent({ el: host });
    const child = new Child();
    const owner = new Region({ el: document.querySelector('#content') });
    const snapshot = () => ({ active, deliveries, text: child.el.textContent });
    const tick = () => source.dispatchEvent(new Event('tick'));
    try {
      parent.showChildView('child', child);
      const detached = snapshot();
      owner.show(parent);
      tick();
      const mounted = snapshot();
      owner.detachView();
      tick();
      const retained = snapshot();
      owner.show(parent);
      tick();
      const reshown = snapshot();
      // Disabled monitoring leaves the explicit content notifications to the app.
      if (monitoring !== 'enabled') { LitDomApi.notifyAttach(child.el); tick(); }
      owner.destroy();
      const afterDestroy = snapshot();
      if (monitoring !== 'enabled') { LitDomApi.notifyDetach(child.el); }
      tick();
      return { detached, mounted, retained, reshown, afterDestroy,
        cleaned: snapshot(), destroyed: child.isDestroyed() && parent.isDestroyed() };
    } finally {
      LitDomApi.notifyDetach(child.el);
      owner.destroy();
      parent.destroy();
      child.destroy();
      host.remove();
    }
  }, { mode: shadowMode, monitoring: policy });
  const idle = { active: 0, deliveries: 0, text: 'watching' };
  const enabled = policy === 'enabled';
  assert.deepEqual(result, {
    detached: idle,
    mounted: enabled ? { active: 1, deliveries: 1, text: 'tick:1' } : idle,
    retained: enabled ? { active: 0, deliveries: 1, text: 'tick:1' } : idle,
    reshown: enabled ? { active: 1, deliveries: 2, text: 'tick:2' } : idle,
    afterDestroy: enabled ? { active: 0, deliveries: 2, text: 'tick:2' } :
      { active: 1, deliveries: 1, text: 'tick:1' },
    cleaned: { active: 0, deliveries: enabled ? 2 : 1, text: enabled ? 'tick:2' : 'tick:1' },
    destroyed: true
  });
}

test('attachment retains configured document-root and containment boundaries', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { DomApi, Region, View } = await import('marionette');
    const host = document.createElement('section');
    const inside = document.createElement('section');
    host.attachShadow({ mode: 'closed' }).append(inside);
    const slot = document.createElement('main');
    inside.attachShadow({ mode: 'open' }).append(slot);
    document.body.append(host);
    const cases = [
      { getDocumentEl: () => null },
      { getDocumentEl: () => document.createElement('aside') },
      { hasEl: () => false },
      { getDocumentEl: () => host, hasEl: () => false },
      { getDocumentEl: () => host },
      { getDocumentEl: () => inside },
      { getDocumentEl: () => slot },
      { getDocumentEl: () => document.documentElement }
    ];
    try {
      const custom = cases.map(provider => {
        const el = document.createElement('article');
        slot.append(el);
        const Panel = View.extend({ template: false }).setDomApi(provider);
        const Container = Region.extend().setDomApi(provider);
        const view = new Panel({ el });
        const adopted = view.isAttached();
        view.destroy();
        const region = new Container({ el });
        slot.append(el);
        const child = new View({ template: false });
        region.show(child);
        const mounted = child.isAttached();
        region.destroy();
        el.remove();
        return { adopted, mounted };
      });
      // Keep the preexisting strict-self exclusion for the document root.
      const fixtureDocument = document.implementation.createHTMLDocument('attachment boundary');
      const documentRoot = new View({ el: fixtureDocument.documentElement, template: false });
      const rootAttached = documentRoot.isAttached();
      documentRoot.destroy();
      return { custom, rootAttached,
        strictShadow: DomApi.hasEl(document.documentElement, slot) };
    } finally {
      host.remove();
    }
  });
  assert.deepEqual(result, { custom: [
    { adopted: false, mounted: false }, { adopted: false, mounted: false },
    { adopted: false, mounted: false }, { adopted: false, mounted: false },
    { adopted: true, mounted: true }, { adopted: true, mounted: true },
    { adopted: true, mounted: true },
    { adopted: true, mounted: true }
  ], rootAttached: false, strictShadow: false });
});

test('detached URL elements keep their host property separate from shadow attachment', async({ page }) => {
  const result = await page.evaluate(async() => {
    const { Region, View } = await import('marionette');
    return ['a', 'area'].map(tag => {
      const el = document.createElement(tag);
      el.href = 'https://example.com/path';
      const view = new View({ el, template: false });
      const region = new Region({ el });
      const child = new View({ template: false });
      try {
        region.show(child);
        return { host: el.host, adopted: view.isAttached(), mounted: child.isAttached() };
      } finally {
        region.destroy();
        view.destroy();
        child.destroy();
      }
    });
  });
  assert.deepEqual(result, Array(2).fill({ host: 'example.com', adopted: false, mounted: false }));
});
