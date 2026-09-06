import { View, Region } from '../../src/index.ts';
import setMorphdomRenderer from '../../packages/adapters/src/render/morphdom.ts';
import setLitHtmlRenderer from '../../packages/adapters/src/render/lit-html.ts';
import JQueryDomApi from '../../packages/adapters/src/dom/jquery.ts';
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
  const Dom = ViewClass.prototype.Dom;
  const install = kind === 'morphdom' ? setMorphdomRenderer : setLitHtmlRenderer;
  check(install(ViewClass) === ViewClass, 'Installer lost class identity');
  check(ViewClass.prototype.Dom === Dom, 'Installer replaced the existing DomApi');
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

export const renderingAdapterContracts = [];

for (const kind of ['morphdom', 'lit-html']) {
  renderingAdapterContracts.push({
    name: `${kind}: composes with a preselected jQuery DomApi`,
    run() {
      const { region, element } = fixture();
      let clicks = 0;
      const ViewClass = View.extend({
        template: template(kind), serializeData: () => ({ value: 'jquery' }),
        ui: { button: 'button' }, events: { 'click @ui.button': () => clicks++ }
      });
      ViewClass.setDomApi(JQueryDomApi);
      const Dom = ViewClass.prototype.Dom;
      const setElement = ViewClass.prototype.setElement;
      const destroy = ViewClass.prototype.destroy;
      const install = kind === 'morphdom' ? setMorphdomRenderer : setLitHtmlRenderer;
      install(ViewClass);
      check(ViewClass.prototype.Dom === Dom, 'Installer replaced the jQuery DomApi');
      if (kind === 'morphdom') {
        check(ViewClass.prototype.setElement === setElement && ViewClass.prototype.destroy === destroy,
          'Morphdom installed unnecessary lifetime wrappers');
      }
      const view = new ViewClass();
      region.show(view);
      check(view.$el[0] === view.el && view.$el.jquery, 'jQuery root wrapper was lost');
      check(view.getUI('button').jquery && view.getUI('button')[0] === view.el.querySelector('button'),
        'UI bindings no longer use the selected DomApi');
      view.getUI('button')[0].click();
      check(clicks === 1, 'Delegated events failed with jQuery UI bindings');
      region.detachView();
      const replacement = document.createElement('article');
      view.setElement(replacement);
      view.render();
      region.show(view);
      check(view.$el[0] === replacement, 'setElement lost the jQuery wrapper');
      check(view.getUI('button').text() === 'jquery', 'Replacement UI lost jQuery behavior');
      region.destroy();
      check(view.isDestroyed() && !replacement.isConnected, 'Combined adapters did not destroy the View');
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
        events: { 'click button': () => clicks++ },
        attachElContent() { throw new Error('Direct renderer returned content'); }
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
    name: `${kind}: moves roots through setElement and destroys after detach/reattach`,
    run() {
      const { region, element } = fixture();
      const RendererView = makeView(kind, {
        template: template(kind), serializeData: () => ({ value: 'content' })
      });
      const view = new RendererView();
      region.show(view);
      check(region.detachView() === view, 'Region detach lost view');
      const replacement = document.createElement('aside');
      check(view.setElement(replacement) === view, 'setElement lost fluent return');
      view.render();
      region.show(view);
      check(view.el === replacement && view.isAttached(), 'Replacement did not attach');
      region.destroy();
      check(view.isDestroyed() && !replacement.isConnected, 'View destroy did not detach');
      element.remove();
    }
  });
}

renderingAdapterContracts.push({
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
  name: 'lit-html: setElement immediately clears old contents and listeners without double release',
  run() {
    const log = [];
    const LitView = makeView('lit-html', { template: trackedTemplate(log) });
    const old = document.createElement('article');
    document.body.append(old);
    const view = new LitView({ el: old });
    view.render();
    const disconnectCount = () => log.filter(value => value === 'disconnected').length;
    view.setElement(old);
    check(disconnectCount() === 0 && old.querySelector('p'), 'Same element was cleared');
    const next = document.createElement('article');
    view.setElement(next);
    check(disconnectCount() === 1, 'Root change did not immediately release resources');
    check(!old.childNodes.length, 'Root change retained Lit contents or markers');
    view.triggerMethod('attach', view);
    check(log.at(-1) === 'disconnected', 'Old attachment listener survived cleanup');
    view.render();
    view.destroy();
    view.setElement(old);
    check(view.el === next, 'Adapter bypassed destroyed-view setElement guard');
    check(!next.childNodes.length, 'Destroy retained Lit contents');
    old.remove();
  }
}, {
  name: 'lit-html: terminal cleanup survives removing event listeners',
  run() {
    const log = [];
    const el = document.createElement('article');
    document.body.append(el);
    const LitView = makeView('lit-html', { template: trackedTemplate(log) });
    const view = new LitView({ el });
    view.render();
    view.off();
    view.destroy();
    check(log.at(-1) === 'disconnected', 'off() disabled terminal resource cleanup');
    check(!el.childNodes.length, 'Terminal cleanup retained Lit contents');
  }
}, {
  name: 'lit-html: failed setElement preserves active root and directives',
  run() {
    const log = [];
    const el = document.createElement('article');
    document.body.append(el);
    const LitView = makeView('lit-html', { template: trackedTemplate(log) });
    const view = new LitView({ el });
    view.render();
    let threw = false;
    try { view.setElement('#invalid'); } catch { threw = true; }
    check(threw && view.el === el, 'Invalid root was accepted');
    check(log.join() === 'render:true', 'Failed setElement disconnected active contents');
    view.destroy();
  }
}, {
  name: 'lit-html: a cancelled destroy retains directives until successful destruction',
  run() {
    const log = [];
    const el = document.createElement('article');
    document.body.append(el);
    const LitView = makeView('lit-html', { template: trackedTemplate(log) });
    const view = new LitView({ el });
    view.render();
    const cancel = () => { throw new Error('cancel'); };
    view.on('before:destroy', cancel);
    try { view.destroy(); } catch (error) { check(error.message === 'cancel', 'Wrong error'); }
    check(!view.isDestroyed() && log.join() === 'render:true', 'Cancelled destroy cleared resources');
    view.off('before:destroy', cancel);
    view.destroy();
    check(log.at(-1) === 'disconnected', 'Successful destroy did not release resources');
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
    check(!el.childNodes.length, 'Throwing terminal handler retained contents');
  }
}, {
  name: 'lit-html: repeated installation and subclass installation retain public method behavior',
  run() {
    const Base = View.extend();
    check(setLitHtmlRenderer(Base) === Base, 'Installer lost class identity');
    const setElement = Base.prototype.setElement;
    const destroy = Base.prototype.destroy;
    setLitHtmlRenderer(Base);
    check(Base.prototype.setElement === setElement && Base.prototype.destroy === destroy,
      'Repeated installation wrapped methods again');
    let roots = 0;
    class Native extends Base {
      setElement(element) {
        roots++;
        return super.setElement(element);
      }
    }
    setLitHtmlRenderer(Native);
    const Child = Base.extend({ template: () => html`<p>child</p>` });
    const child = new Child();
    child.render();
    child.destroy();
    const view = new Native({ template: () => html`<p>child</p>` });
    view.render();
    view.setElement(document.createElement('section'));
    view.render();
    check(roots === 2 && view.el.textContent === 'child', 'Subclass setElement behavior changed');
    check(view.destroy() === view, 'Subclass destroy lost fluent return');
  }
}, {
  name: 'lit-html: disposed elements can be adopted by a new View without stale Lit parts',
  run() {
    const LitView = makeView('lit-html', { template: () => html`<p>fresh</p>` });
    const first = new LitView();
    first.render();
    const el = first.el;
    first.setElement(document.createElement('div'));
    const second = new LitView({ el });
    second.render();
    check(el.textContent === 'fresh' && el.querySelectorAll('p').length === 1, 'Stale Lit root survived reuse');
    first.destroy();
    second.destroy();
  }
});

renderingAdapterContracts.push({
  name: 'lit-html: failed construction releases rendered directives',
  run() {
    const log = [];
    const el = document.createElement('article');
    document.body.append(el);
    const failure = new Error('initialization failed');
    const LitView = makeView('lit-html', {
      template: trackedTemplate(log),
      initialize() { this.render(); throw failure; }
    });
    let caught;
    try { new LitView({ el }); } catch (error) { caught = error; }
    check(caught === failure, 'Rollback replaced the construction error');
    check(log.join() === 'render:true,disconnected', 'Failed construction retained directive resources');
    check(el.childNodes.length === 0, 'Failed construction retained Lit markers');
    el.remove();
  }
});

renderingAdapterContracts.push({
  name: 'lit-html: preserves a destroy error when directive cleanup also throws',
  run() {
    const failure = new Error('destroy failed');
    class Resource extends AsyncDirective {
      render() { return 'resource'; }
      disconnected() { throw new Error('directive cleanup failed'); }
    }
    const resource = directive(Resource);
    const LitView = makeView('lit-html', {
      template: () => html`<p>${resource()}</p>`,
      onDestroy() { throw failure; }
    });
    const el = document.createElement('article');
    document.body.append(el);
    const view = new LitView({ el });
    view.render();
    view.off();
    let caught;
    try { view.destroy(); } catch (error) { caught = error; }
    check(caught === failure, 'Directive cleanup replaced the destroy error');
    check(view.isDestroyed(), 'Destroy did not reach terminal state');
    el.remove();
  }
});

renderingAdapterContracts.push({
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
    check(el.childNodes.length === 0, 'Outer destroy retained Lit contents');
  }
});

renderingAdapterContracts.push({
  name: 'lit-html: clears old contents and preserves the first directive cleanup error on root change',
  run() {
    const failures = { first: new Error('first cleanup'), second: new Error('second cleanup') };
    class Resource extends AsyncDirective {
      render(name) { this.name = name; return name; }
      disconnected() { throw failures[this.name]; }
    }
    const resource = directive(Resource);
    const LitView = makeView('lit-html', {
      template: () => html`<p>${resource('first')}${resource('second')}</p>`
    });
    const el = document.createElement('article');
    document.body.append(el);
    const view = new LitView({ el });
    view.render();
    const next = document.createElement('section');
    let caught;
    try { view.setElement(next); } catch (error) { caught = error; }
    check(caught === failures.first, 'Cleanup did not preserve the first failure');
    check(el.childNodes.length === 0, 'Throwing cleanup retained old DOM or markers');
    check(view.el === next, 'Root change did not commit');
    view.template = () => html`<p>recovered</p>`;
    view.render();
    check(next.textContent === 'recovered', 'New root could not render after cleanup failure');
    view.destroy();
    el.remove();
  }
});
