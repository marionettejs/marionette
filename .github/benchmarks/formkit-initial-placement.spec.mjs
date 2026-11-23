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
      .filter(node => node.nodeType === 1 && node.hasAttribute('data-experiment-field'))
      .map(element => element.getAttribute('data-experiment-field')))
      .filter(names => names.length);
  };
}

afterEach(() => {
  for (const owner of owners.splice(0).reverse()) owner.destroy();
  document.body.replaceChildren();
});

function mountApplication(config) {
  const host = document.createElement('main');
  document.body.append(host);
  let mountedView, drain;
  const App = FormKitApplication.extend({
    createFormView(options) {
      mountedView = new FormKitView({...options, instrument: true});
      drain = fieldPlacements(mountedView);
      return mountedView;
    }
  });
  const app = new App({region: {el: host}, config, form: {fields, formProps: {actions: true}}});
  owners.push(app);
  return {app, host, view: () => mountedView, placements: () => drain()};
}

it('batches package-owned field wrappers in the stock FormKit Application path', async () => {
  const fixture = mountApplication();
  expect(await fixture.app.start()).toBe(true);
  expect(fixture.placements()).toEqual([['first','second']]);
  expect(fixture.host.querySelectorAll('input')).toHaveLength(2);
  const form = fixture.view(), submit = form.el.querySelector('button[type=submit]');
  expect(submit).not.toBeNull();
  for (const input of form.el.querySelectorAll('input')) {
    expect(input.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  }
});

it('leaves the initial placement path unchanged for an Application with a custom config', async () => {
  const fixture = mountApplication({rules: {testOnly: () => true}});
  expect(await fixture.app.start()).toBe(true);
  expect(fixture.placements()).toEqual([['second'],['first']]);
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

it('leaves a committed prefix in place on insertion error; a later render uses the same field nodes', () => {
  const view = new FormKitView({fields, instrument: true, formProps: {actions: false}});
  owners.push(view);
  const insertBefore = view.el.insertBefore;
  const failure = new Error('synthetic platform insertion failure');
  let prefix, suffix, writes = 0;
  view.el.insertBefore = function (node, before) {
    if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE && node.childElementCount === 2) {
      writes++;
      [prefix, suffix] = node.children;
      insertBefore.call(this, prefix, before);
      throw failure;
    }
    return insertBefore.call(this, node, before);
  };
  try {
    expect(() => view.render()).toThrow(failure);
  } finally {
    delete view.el.insertBefore;
  }
  expect(writes).toBe(1);
  expect(prefix.parentNode).toBe(view.el);
  expect(suffix.parentNode).toBeNull();
  const nodes = [...view.node.children];
  const nodeCount = view.metrics.coreNodesCreated;
  view.render();
  expect([...view.el.querySelectorAll('[data-experiment-field]')]).toEqual([prefix, suffix]);
  expect(view.node.children).toHaveLength(nodes.length);
  nodes.forEach((node, index) => expect(view.node.children[index]).toBe(node));
  expect(view.metrics.coreNodesCreated).toBe(nodeCount);
});

it('preserves ordinary placement when the view root is already attached', () => {
  const view = new FormKitView({fields, instrument: true, formProps: {actions: false}});
  owners.push(view);
  document.body.append(view.el);
  const placements = fieldPlacements(view);
  view.render();
  expect(placements()).toEqual([['second'], ['first']]);
});
