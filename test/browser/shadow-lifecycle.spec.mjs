import assert from 'node:assert/strict';
import { test } from './fixtures.mjs';

for (const tree of ['light', 'open', 'closed', 'iframe']) {
  for (const adopted of [true, false]) {
    for (const connected of [true, false]) {
      if (tree === 'iframe' && !connected) { continue; }
      test(`${tree}: ${adopted ? 'adopted' : 'Region-mounted'} Lit View in ${connected ? 'connected' : 'detached'} host releases subscriptions`, async({ page }) => {
        const result = await page.evaluate(async({ tree, adopted, connected }) => {
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
          const Panel = View.extend({
            template: () => html`<p>${watch()}</p>`,
            onAttach() { counts.attachments++; },
            onDetach() { counts.detachments++; }
          }).setDomApi(LitDomApi);
          const view = new Panel({ el });
          const region = new Region({ el: slot });
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
        }, { tree, adopted, connected });
        const active = connected ? 1 : 0;
        // Assert teardown first so the adopted regression exposes late DOM writes.
        assert.deepEqual(result.destroyed, {
          active: 0, deliveries: connected ? adopted ? 1 : 2 : 0,
          disconnections: connected ? adopted ? 1 : 2 : 0,
          attachments: connected && !adopted ? 2 : 0,
          detachments: connected ? adopted ? 1 : 2 : 0,
          attached: false, connected: false,
          text: connected ? adopted ? 'tick:1' : 'tick:2' : 'watching', destroyed: true
        });
        assert.deepEqual(result.initial, {
          active: adopted ? active : 0, deliveries: 0, disconnections: 0,
          attachments: 0, detachments: 0, attached: adopted && connected,
          connected: adopted && connected, text: 'watching'
        });
        assert.deepEqual(result.mounted, {
          active, deliveries: active, disconnections: 0,
          attachments: adopted ? 0 : active, detachments: 0,
          attached: connected, connected, text: connected ? 'tick:1' : 'watching'
        });
        if (!adopted) {
          assert.deepEqual(result.detached, {
            active: 0, deliveries: active, disconnections: active,
            attachments: active, detachments: active,
            attached: false, connected: false, text: connected ? 'tick:1' : 'watching'
          });
          assert.deepEqual(result.reshown, {
            active, deliveries: active * 2, disconnections: active,
            attachments: active * 2, detachments: active,
            attached: connected, connected, text: connected ? 'tick:2' : 'watching'
          });
        }
      });
    }
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
