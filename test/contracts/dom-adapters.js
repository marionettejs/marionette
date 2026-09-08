import { View, CollectionView, Region, DomApi } from 'marionette';
import MorphdomDomApi from '@marionette/adapters/dom/morphdom';
import LitDomApi from '@marionette/adapters/dom/lit-html';
import $ from 'jquery';
import JQueryDomApi from '@marionette/adapters/dom/jquery';
import { html } from 'lit-html';
import { AsyncDirective } from 'lit-html/async-directive.js';
import { directive } from 'lit-html/directive.js';

function check(value, message) {
  if (!value) { throw new Error(message); }
}

function fixture() {
  const element = document.createElement('main');
  document.body.append(element);
  return { element, region: new Region({ el: element }) };
}

function makeView(kind, properties = {}) {
  const ViewClass = View.extend(properties);
  ViewClass.setDomApi(kind === 'morphdom' ? MorphdomDomApi : LitDomApi);
  return ViewClass;
}

function template(kind) {
  return kind === 'morphdom' ?
    data => `<button id="survivor">${data.value}</button><section class="child"></section>` :
    data => html`<button id="survivor">${data.value}</button><section class="child"></section>`;
}

function trackedTemplate(log) {
  class Resource extends AsyncDirective {
    render() {
      log.push(`render:${this.isConnected}`);
      return 'resource';
    }
    disconnected() { log.push('disconnected'); }
    reconnected() { log.push('reconnected'); }
  }
  const resource = directive(Resource);
  return () => html`<p>${resource()}</p>`;
}

export const domAdapterContracts = [];

for (const kind of ['morphdom', 'lit-html']) {
  domAdapterContracts.push({
    name: `${kind}: composes with a preselected jQuery DomApi`,
    run() {
      const { region, element } = fixture();
      let clicks = 0;
      const ViewClass = View.extend({
        initialize() { this.$el = $(this.el); },
        template: template(kind), serializeData: () => ({ value: 'jquery' }),
        ui: { button: 'button' }, events: { 'click @ui.button': () => clicks++ }
      });
      ViewClass.setDomApi(JQueryDomApi);
      ViewClass.setDomApi(kind === 'morphdom' ? MorphdomDomApi : LitDomApi);
      const view = new ViewClass();
      region.show(view);
      check(view.$el[0] === view.el && view.$el.jquery, 'jQuery root wrapper was lost');
      check(view.getUI('button').jquery && view.getUI('button')[0] === view.el.querySelector('button'),
        'UI bindings no longer use the selected DomApi');
      view.getUI('button')[0].click();
      check(clicks === 1, 'Delegated events failed with jQuery UI bindings');
      region.detachView();
      const root = view.el;
      view.render();
      region.show(view);
      check(view.$el[0] === root, 'Reattachment lost the jQuery wrapper');
      check(view.getUI('button').text() === 'jquery', 'Reattached UI lost jQuery behavior');
      region.destroy();
      check(view.isDestroyed() && !root.isConnected, 'Combined adapters did not destroy the View');
      element.remove();
    }
  }, {
    name: `${kind}: replaces initial contents, preserves root and survivor, and commits synchronously`,
    run() {
      const { region, element } = fixture();
      const el = document.createElement('article');
      el.innerHTML = '<p>orphan</p>';
      const data = { value: 'first' };
      let clicks = 0;
      const ViewClass = makeView(kind, {
        template: template(kind),
        serializeData: () => data,
        events: { 'click button': () => clicks++ }
      });
      const view = new ViewClass({ el });
      view.render();
      region.show(view);
      const button = el.querySelector('button');
      check(!el.textContent.includes('orphan'), 'Initial contents survive');
      data.value = 'second';
      check(view.render() === view, 'render lost fluent return');
      check(view.el === el, 'View root was replaced');
      check(el.querySelector('button') === button, 'Incremental survivor was replaced');
      check(button.textContent === 'second', 'Commit was not synchronous');
      button.click();
      check(clicks === 1, 'Delegated click handler was lost');
      region.destroy();
      element.remove();
    }
  }, {
    name: `${kind}: destroys Region children before parent rendering`,
    run() {
      const { region, element } = fixture();
      const Parent = makeView(kind, {
        regions: { child: '.child' }, template: template(kind),
        serializeData: () => ({ value: 'parent' })
      });
      const view = new Parent();
      region.show(view);
      let destroyed = false;
      const child = new View({ template: () => '<b>owned</b>' });
      child.on('destroy', () => { destroyed = true; });
      view.showChildView('child', child);
      const original = view.template;
      view.template = data => {
        check(destroyed, 'Renderer ran before child teardown');
        return original(data);
      };
      view.render();
      check(child.isDestroyed(), 'Owned child was not destroyed');
      check(!view.el.querySelector('b'), 'Owned child DOM survived parent rerender');
      region.destroy();
      element.remove();
    }
  }, {
    name: `${kind}: preserves its root through detach/reattach and destroy`,
    run() {
      const { region, element } = fixture();
      const RendererView = makeView(kind, {
        template: template(kind), serializeData: () => ({ value: 'content' })
      });
      const view = new RendererView();
      region.show(view);
      check(region.detachView() === view, 'Region detach lost view');
      const root = view.el;
      view.render();
      region.show(view);
      check(view.el === root && view.isAttached(), 'Root identity changed during reattachment');
      region.destroy();
      check(view.isDestroyed() && !root.isConnected, 'View destroy did not detach');
      element.remove();
    }
  });
}

domAdapterContracts.push({
  name: 'lit-html: connects and disconnects directives through Region attachment',
  run() {
    const log = [];
    const LitView = makeView('lit-html', { template: trackedTemplate(log) });
    const view = new LitView();
    const { region, element } = fixture();
    view.render();
    check(log.join() === 'render:false', 'Detached render started connected');
    region.show(view);
    check(log.join() === 'render:false,reconnected', 'Attach did not connect directives');
    region.detachView();
    check(log.at(-1) === 'disconnected', 'Detach did not disconnect directives');
    region.show(view);
    check(log.at(-1) === 'reconnected', 'Reattach did not reconnect directives');
    region.destroy();
    check(log.at(-1) === 'disconnected', 'Destroy left resources connected');
    element.remove();
  }
}, {
  name: 'lit-html: cleanup runs when a terminal destroy handler throws',
  run() {
    const log = [];
    const el = document.createElement('article');
    document.body.append(el);
    const LitView = makeView('lit-html', { template: trackedTemplate(log) });
    const view = new LitView({ el });
    view.render();
    view.on('destroy', () => { throw new Error('terminal'); });
    try { view.destroy(); } catch (error) { check(error.message === 'terminal', 'Wrong error'); }
    check(view.isDestroyed() && log.at(-1) === 'disconnected', 'Throwing terminal handler leaked resources');
    check(el.querySelector('p'), 'Destroy unnecessarily cleared contents');
  }
}, {
  name: 'lit-html: repeated installation and subclass installation retain public method behavior',
  run() {
    const Base = View.extend();
    Base.setDomApi(LitDomApi);
    Base.setDomApi(LitDomApi);
    let initialized = 0;
    class Native extends Base {
      initialize() { initialized++; }
    }
    Native.setDomApi(LitDomApi);
    const Child = Base.extend({ template: () => html`<p>child</p>` });
    const child = new Child();
    child.render();
    child.destroy();
    const view = new Native({ template: () => html`<p>child</p>` });
    view.render();
    check(initialized === 1 && view.el.textContent === 'child', 'Subclass initialization changed');
    check(view.destroy() === view, 'Subclass destroy lost fluent return');
  }
}, {
  name: 'lit-html: disconnected elements can be adopted by a new View without stale Lit parts',
  run() {
    const LitView = makeView('lit-html', { template: () => html`<p>fresh</p>` });
    const first = new LitView();
    first.render();
    const el = first.el;
    first.destroy();
    const second = new LitView({ el });
    second.render();
    check(el.textContent === 'fresh' && el.querySelectorAll('p').length === 1, 'Stale Lit root survived reuse');
    second.destroy();
  }
});

domAdapterContracts.push({
  name: 'lit-html: destroy releases subscriptions after the first content render throws',
  run() {
    const subscribers = new Set();
    const failure = new Error('directive failed');
    class Subscription extends AsyncDirective {
      render() { subscribers.add(this); return 'resource'; }
      disconnected() { subscribers.delete(this); }
    }
    class Failure extends AsyncDirective {
      render() { throw failure; }
    }
    const subscription = directive(Subscription);
    const fail = directive(Failure);
    const el = document.createElement('article');
    document.body.append(el);
    const LitView = makeView('lit-html', {
      template: () => html`<p>${subscription()}</p><p>${fail()}</p>`
    });
    const view = new LitView({ el });
    let caught;
    try { view.render(); } catch (error) { caught = error; }
    check(caught === failure, 'Render replaced the directive error');
    check(subscribers.size === 1, 'The earlier directive did not subscribe');
    view.destroy();
    check(subscribers.size === 0, 'Failed first render retained a subscription');
  }
});

domAdapterContracts.push({
  name: 'lit-html: a reentrant destroy does not release directives before the outer destroy commits',
  run() {
    const log = [];
    const el = document.createElement('article');
    document.body.append(el);
    const LitView = makeView('lit-html', { template: trackedTemplate(log) });
    const view = new LitView({ el });
    view.render();
    view.on('before:destroy', () => {
      check(view.destroy() === view, 'Reentrant destroy lost fluent return');
      check(log.join() === 'render:true' && el.querySelector('p'), 'Reentrant destroy released active contents');
    });
    view.destroy();
    check(log.join() === 'render:true,disconnected', 'Outer destroy did not release directives exactly once');
    check(el.querySelector('p'), 'Destroy unnecessarily cleared contents');
  }
});
for (const [name, api] of [['native', DomApi], ['jquery', JQueryDomApi],
  ['morphdom', MorphdomDomApi], ['lit-html', LitDomApi]]) {
  domAdapterContracts.push({
    name: `${name}: undefined template output renders empty initially and clears previous contents`,
    run() {
      const RenderedView = View.extend({ template: () => 'previous' });
      RenderedView.setDomApi(api);
      const empty = new RenderedView({ template: () => undefined }).render();
      check(empty.isRendered() && empty.el.textContent === '', 'Initial empty render did not complete');
      empty.destroy();
      const view = new RenderedView().render();
      view.template = () => undefined;
      view.render();
      check(view.el.textContent === '', 'Undefined output left stale contents');
      view.destroy();
    }
  });
}

for (const [name, Base] of [['View', View], ['CollectionView', CollectionView]]) {
  domAdapterContracts.push({
    name: `lit-html: ${name} releases subscriptions across detach, reattach, and destruction`,
    run() {
      const subscribers = new Set();
      class Subscription extends AsyncDirective {
        render() { if (this.isConnected) { subscribers.add(this); } return 'subscribed'; }
        reconnected() { subscribers.add(this); }
        disconnected() { subscribers.delete(this); }
      }
      const subscription = directive(Subscription);
      const RenderedView = Base.extend({ template: () => html`<p>${subscription()}</p>` });
      RenderedView.setDomApi(LitDomApi);
      const el = document.createElement('article');
      document.body.append(el);
      const view = new RenderedView({ el }).render();
      const content = el.firstElementChild;
      check(subscribers.size === 1, 'Attached render did not subscribe');
      const { region, element } = fixture();
      region.show(view);
      region.detachView();
      check(subscribers.size === 0 && el.firstElementChild === content,
        'Detach must unsubscribe while preserving contents');
      region.show(view);
      check(subscribers.size === 1 && el.firstElementChild === content,
        'Reattachment must reconnect without replacing contents');
      region.destroy();
      check(subscribers.size === 0, 'Destroy retained the external subscription');
      new RenderedView().render().destroy();
      check(subscribers.size === 0, 'Never-attached destruction retained a subscription');
      element.remove();
    }
  }, {
    name: `lit-html: descendants follow ${name} detach and reattach`,
    run() {
      const log = [];
      const Child = makeView('lit-html', { template: trackedTemplate(log) });
      const Parent = Base.extend({ template: () => '<section class="child"></section>',
        regions: { child: '.child' }, childViewContainer: '.child' });
      const parent = new Parent().render();
      const child = new Child();
      if (Base === View) {
        parent.showChildView('child', child);
      } else {
        parent.addChildView(child);
      }
      const { region, element } = fixture();
      region.show(parent);
      check(log.join() === 'render:false,reconnected', 'Ancestor attachment did not connect child');
      region.detachView();
      check(log.at(-1) === 'disconnected', 'Ancestor removal did not disconnect child');
      region.show(parent);
      check(log.at(-1) === 'reconnected', 'Ancestor reattachment did not reconnect child');
      region.destroy();
      check(log.at(-1) === 'disconnected' && child.isDestroyed(), 'Ancestor destroy retained child resources');
      element.remove();
    }
  });
}

domAdapterContracts.push({
  name: 'lit-html: a View can adopt contents rendered directly by the DOM adapter',
  run() {
    const log = [];
    const adoptedTemplate = trackedTemplate(log);
    const el = document.createElement('article');
    LitDomApi.setContents(el, adoptedTemplate());
    const content = el.firstElementChild;
    const LitView = makeView('lit-html', { template: adoptedTemplate });
    const view = new LitView({ el });
    const { region, element } = fixture();
    region.show(view);
    check(log.join() === 'render:false,reconnected', 'Directly rendered contents missed attachment');
    view.render();
    check(el.firstElementChild === content, 'Adoption lost the existing contents');
    region.destroy();
    check(log.at(-1) === 'disconnected', 'Adopted contents missed disconnection');
    element.remove();
  }
}, {
  name: 'lit-html: monitoring opt-out leaves connection notifications to the application',
  run() {
    const log = [];
    const LitView = makeView('lit-html', { template: trackedTemplate(log), monitorViewEvents: false });
    const view = new LitView().render();
    const { region, element } = fixture();
    region.show(view);
    check(log.join() === 'render:false', 'Monitoring opt-out still notified the adapter');
    LitDomApi.notifyAttach(view.el);
    check(log.at(-1) === 'reconnected', 'Application could not connect contents');
    view.destroy();
    check(log.at(-1) === 'reconnected', 'Destroy bypassed the monitoring opt-out');
    LitDomApi.notifyDetach(view.el);
    check(log.at(-1) === 'disconnected', 'Application could not disconnect contents');
    region.destroy();
    element.remove();
  }
});
