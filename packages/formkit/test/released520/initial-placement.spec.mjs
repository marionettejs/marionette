import { createConfig } from '@formkit/core';
import { afterEach, expect, it } from 'vitest';
import { FormKitApplication, FormKitView } from '@mnjs/formkit';

const owners = [];
const fields = [{name: 'first', label: 'First'}, {name: 'second', label: 'Second'}];

function fieldPlacements(view) {
  const records = [];
  const observer = new MutationObserver(next => records.push(...next));
  observer.observe(view.el, {childList: true});
  return () => {
    records.push(...observer.takeRecords());
    observer.disconnect();
    return records.map(record => [...record.addedNodes]
      .filter(node => node.nodeType === 1 && node.hasAttribute('data-mnjs-formkit-field'))
      .map(element => element.getAttribute('data-mnjs-formkit-field')))
      .filter(names => names.length);
  };
}

afterEach(() => {
  for (const owner of owners.splice(0).reverse()) {owner.destroy();}
  document.body.replaceChildren();
});

function mountApplication(config) {
  const host = document.createElement('main');
  document.body.append(host);
  let mountedView, drain;
  const mountedFields = [];
  const App = FormKitApplication.extend({
    createFormView(options) {
      mountedView = new FormKitView({...options, instrument: true});
      drain = fieldPlacements(mountedView);
      mountedView.once('before:attach', () => {
        for (const child of mountedView.node.children) {
          child.on('mounted', () => mountedFields.push(child.name));
        }
      });
      return mountedView;
    }
  });
  const app = new App({region: {el: host}, config, form: {fields, formProps: {actions: true}}});
  owners.push(app);
  return {app, host, mountedFields, view: () => mountedView, placements: () => drain()};
}

it('batches package-owned field wrappers in the stock FormKit Application path', async() => {
  const fixture = mountApplication();
  expect(await fixture.app.start()).toBe(true);
  expect(fixture.placements()).toEqual([['first','second']]);
  expect(fixture.host.querySelectorAll('input')).toHaveLength(2);
  const form = fixture.view(), submit = form.el.querySelector('button[type=submit]');
  expect(submit).not.toBeNull();
  for (const input of form.el.querySelectorAll('input')) {
    expect(input.compareDocumentPosition(submit)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  }
  expect(fixture.mountedFields).toEqual(['first', 'second']);
  expect(form.metrics.coreNodesCreated).toBeGreaterThan(2);
  expect(form.metrics.coreNodesDestroyed).toBe(0);
  fixture.app.destroy();
  expect(form.metrics.coreNodesDestroyed).toBe(form.metrics.coreNodesCreated);
  expect(fixture.host.childNodes).toHaveLength(0);
});

it('leaves the initial placement path unchanged for an Application with a custom config', async() => {
  const fixture = mountApplication({rules: {testOnly: () => true}});
  expect(await fixture.app.start()).toBe(true);
  expect(fixture.placements()).toEqual([['second'],['first']]);
  expect(fixture.host.querySelectorAll('input')).toHaveLength(2);
});

it('never marks a supplied root hidden behind a non-enumerable config accessor as stock', async() => {
  const suppliedRoot = createConfig({});
  let rootReads = 0, eligibilityReads = 0;
  Object.defineProperty(suppliedRoot, 'syntheticEligibilityProbe', {
    enumerable: true,
    get() { eligibilityReads++; return true; }
  });
  const config = {};
  Object.defineProperty(config, 'rootConfig', { get() { rootReads++; return suppliedRoot; } });
  const fixture = mountApplication({ config });
  expect(await fixture.app.start()).toBe(true);
  expect(rootReads).toBe(1);
  expect(eligibilityReads).toBe(0);
  expect(fixture.placements()).toEqual([['second'], ['first']]);
  expect(fixture.host.querySelectorAll('input')).toHaveLength(2);
});

it('supports an ordinary FormKitView subclass; caller-owned roots stay on the old path', () => {
  class SampleForm extends FormKitView {}
  for (const supplied of [false,true]) {
    const view = new SampleForm({
      fields, instrument: true, formProps: {actions: false}, ...(supplied ? {el: document.createElement('form')} : {})
    });
    owners.push(view);
    const placements = fieldPlacements(view);
    view.render();
    expect(placements()).toEqual(supplied ? [['second'],['first']] : [['first','second']]);
  }
});

it('rethrows the original insertion error and releases the partially placed fields on destroy', () => {
  const view = new FormKitView({fields, instrument: true, formProps: {actions: false}});
  const host = document.createElement('main');
  owners.push(view);
  const insertBefore = view.el.insertBefore;
  const failure = new Error('synthetic platform insertion failure');
  let prefix, suffix, writes = 0;
  view.el.insertBefore = function(node, before) {
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && node.childElementCount === 2) {
      writes++;
      [prefix, suffix] = node.children;
      insertBefore.call(this, prefix, before);
      throw failure;
    }
    return insertBefore.call(this, node, before);
  };
  try {
    try {
      view.render();
      expect.unreachable('Expected fragment insertion to throw');
    } catch (error) {
      expect(error).toBe(failure);
    }
  } finally {
    delete view.el.insertBefore;
  }
  expect(writes).toBe(1);
  expect(prefix.parentNode).toBe(view.el);
  expect(suffix.parentNode).toBeNull();
  expect(view.metrics.coreNodesCreated).toBe(3);
  expect(view.metrics.coreNodesDestroyed).toBe(0);
  host.append(view.el);
  view.destroy();
  expect(view.metrics.coreNodesDestroyed).toBe(view.metrics.coreNodesCreated);
  expect(prefix.parentNode).toBeNull();
  expect(suffix.parentNode).toBeNull();
  expect(view.el.childNodes).toHaveLength(0);
  expect(host.childNodes).toHaveLength(0);
});

it('preserves ordinary placement when the view root is already attached', () => {
  const view = new FormKitView({fields, instrument: true, formProps: {actions: false}});
  owners.push(view);
  document.body.append(view.el);
  const placements = fieldPlacements(view);
  view.render();
  expect(placements()).toEqual([['second'], ['first']]);
});
