import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
const diagnostics = Symbol.for('@mnjs/formkit/internal-diagnostics');
const metricsOf = owner => owner[diagnostics] ?? owner.form[diagnostics];
const dom = new JSDOM('<body></body>', { url: 'https://consumer.example.test/' });
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLFormElement', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle']) {globalThis[key] = dom.window[key];}
const require = createRequire(import.meta.url);
const imported = await import('@mnjs/formkit');
const required = require('@mnjs/formkit');
const components = await import('@mnjs/formkit/components');
const cjsComponents = require('@mnjs/formkit/components');
const names = ['FormKitApplication', 'FormKitView', 'bindings', 'defaultConfig', 'mount'];
assert.deepEqual(Object.keys(imported).sort(), names);
assert.deepEqual(Object.keys(required).sort(), names);
assert.deepEqual(Object.keys(components).sort(), Object.keys(cjsComponents).sort());
for (const api of [imported, required]) {
  const host = document.createElement('main'); document.body.append(host);
  const form = api.mount({ host, fields: [{ name: 'title', label: 'Title' }], values: { title: 'Packed' }, formProps: { actions: false } });
  assert.deepEqual(Object.keys(form).sort(), [
    'clearErrors', 'createValueProjection', 'destroy', 'form', 'getFormState', 'getValues',
    'node', 'observeFieldCommits', 'reset', 'setErrors', 'setFields', 'setSchema', 'setSectionsSchema',
    'setSlots', 'setValues', 'submit', 'updateData', 'whenPendingEditsSettled',
  ]);
  assert.equal('metrics' in form.form, false);
  assert.equal(form.getValues().title, 'Packed');
  assert.equal(host.querySelector('input').value, 'Packed');
  form.setValues({ title: 'Updated' });
  assert.equal(form.getValues().title, 'Updated');
  form.destroy(); assert.equal(host.children.length, 0);
}
const manifest = require('@mnjs/formkit/package.json'); assert.equal(manifest.name, '@mnjs/formkit');
assert.throws(() => require('@mnjs/formkit/src/index.mjs'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });

const dependencyVersions = Object.fromEntries(await Promise.all(
  ['marionette', '@formkit/core'].map(async name => [
    name, JSON.parse(await readFile(new URL(`./node_modules/${name}/package.json`, import.meta.url), 'utf8')).version
  ])
));
assert.equal(dependencyVersions.marionette, '5.2.0');
assert.equal(dependencyVersions['@formkit/core'], '2.9.0');
const wrapperConditions = [];
async function waitForValidity(form, valid) {
  await form.node.ledger.settled('validating');
  for (let attempt = 0; attempt < 100; attempt++) {
    if (form.getFormState().valid === valid) { return; }
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(form.getFormState().valid, valid, 'public validation readiness');
}
for (const [format, api] of [['esm', imported], ['cjs', required]]) {
  for (const kind of ['element', 'component']) {
    for (const condition of [false, true, 'omitted']) {
      const host = document.createElement('main'); document.body.append(host);
      const wrapper = kind === 'element' ? { $el: 'section' } : { $cmp: 'Card' };
      if (condition !== 'omitted') { wrapper.if = condition; }
      wrapper.children = [{ $formkit: 'text', name: 'requiredField', label: 'Required field', validation: 'required' }];
      const submitted = []; let invalid = 0;
      const form = api.mount({
        host, schema: [wrapper], [diagnostics]: true, formProps: { actions: false },
        onSubmit: values => { submitted.push(structuredClone(values)); },
        onSubmitInvalid: () => { invalid++; },
        components: { Card({ host: target, renderChildren }) {
          const section = document.createElement('section'); target.append(section);
          const dispose = renderChildren(section);
          return { destroy(remove = true) { dispose(remove); if (remove) { section.remove(); } } };
        } }
      });
      try {
        await form.whenPendingEditsSettled();
        if (condition === false) {
          assert.equal(host.querySelector('section'), null);
          assert.equal(host.querySelector('input'), null);
          assert.equal(form.node.at('requiredField'), undefined);
          assert.deepEqual(form.getValues(), {});
          await waitForValidity(form, true);
          await form.submit();
          assert.deepEqual(submitted, [{}]);
          assert.equal(invalid, 0);
        } else {
          const node = form.node.at('requiredField'), input = host.querySelector('section input');
          assert.ok(node); assert.ok(input);
          await waitForValidity(form, false);
          await form.submit();
          assert.equal(invalid, 1); assert.deepEqual(submitted, []);
          input.value = 'Packed synthetic complete';
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await form.whenPendingEditsSettled();
          await waitForValidity(form, true);
          assert.equal(form.node.at('requiredField'), node);
          assert.equal(host.querySelector('section input'), input);
          await form.submit();
          assert.deepEqual(submitted, [{ requiredField: 'Packed synthetic complete' }]);
          assert.equal(invalid, 1);
        }
      } finally {
        form.destroy(); host.remove();
      }
      assert.equal(metricsOf(form).coreNodesCreated, metricsOf(form).coreNodesDestroyed);
      wrapperConditions.push({ format, kind, condition, passed: true });
    }
  }
}


async function checkFixedKeyLifecycle(api, anonymous) {
  const host = document.createElement('main'); document.body.append(host);
  let current;
  const facts = [], submitted = [];
  const form = api.mount({
    host, [diagnostics]: true, formProps: {actions: false}, data: {candidate: 'answer'},
    schema: [
      {$formkit: 'text', name: '$candidate', key: 'fixed-business-key', id: 'fixed-key-answer', config: {delay: 20}, onNode: node => {current = node;}},
      {$formkit: 'text', name: 'sibling', id: 'fixed-key-sibling'}
    ],
    onSubmit: values => {submitted.push(structuredClone(values));}
  });
  const wait = async promise => {
    let timer;
    try { return await Promise.race([promise, new Promise((_, reject) => {timer = setTimeout(() => reject(new Error('Public fence deadline exceeded')), 1000);})]); } finally {clearTimeout(timer);}
  };
  const type = (input, value) => {input.value = value; input.dispatchEvent(new Event('input', {bubbles: true}));};
  try {
    form.observeFieldCommits(fact => facts.push(fact));
    await wait(form.whenPendingEditsSettled());
    const before = current, beforeInput = host.querySelector('#fixed-key-answer');
    const sibling = form.node.at('sibling'), siblingInput = host.querySelector('#fixed-key-sibling');
    type(beforeInput, 'Before committed');
    await wait(form.whenPendingEditsSettled());
    const beforeGeneration = facts.find(f => f.node === before && f.value === 'Before committed').generation;
    type(beforeInput, 'Retired named pending');
    assert.equal(before.isSettled, false);
    const first = form.whenPendingEditsSettled().then(() => true, error => error);
    form.updateData({candidate: anonymous});
    assert.equal(await wait(first), true);
    const middle = current, middleInput = host.querySelector('#fixed-key-answer');
    assert.notEqual(middle, before); assert.notEqual(middleInput, beforeInput);
    assert.equal(form.node.at('answer'), undefined);
    assert.equal(Object.hasOwn(form.getValues(), 'answer'), false);
    type(middleInput, 'Anonymous committed');
    await wait(form.whenPendingEditsSettled());
    const middleGeneration = facts.find(f => f.node === middle && f.value === 'Anonymous committed').generation;
    assert.notEqual(middleGeneration, beforeGeneration);
    type(middleInput, 'Retired anonymous pending');
    assert.equal(middle.isSettled, false);
    const second = form.whenPendingEditsSettled().then(() => true, error => error);
    form.updateData({candidate: 'answer'});
    assert.equal(await wait(second), true);
    const after = current, afterInput = host.querySelector('#fixed-key-answer');
    assert.notEqual(after, before); assert.notEqual(after, middle);
    assert.notEqual(afterInput, beforeInput); assert.notEqual(afterInput, middleInput);
    assert.equal(Object.hasOwn(form.getValues(), String(middle.name)), false);
    const freshValues = structuredClone(form.getValues());
    assert.equal(Object.values(freshValues).some(value => ['Retired named pending', 'Retired anonymous pending'].includes(value)), false);
    await new Promise(resolve => setTimeout(resolve, 50));
    assert.deepEqual(form.getValues(), freshValues);
    assert.equal(facts.some(f => ['Retired named pending', 'Retired anonymous pending'].includes(f.value)), false);
    type(afterInput, 'Current answer'); type(siblingInput, 'Sibling current');
    await wait(form.whenPendingEditsSettled());
    assert.equal(form.node.at('sibling'), sibling);
    assert.equal(host.querySelector('#fixed-key-sibling'), siblingInput);
    const latest = facts.find(f => f.node === after && f.value === 'Current answer');
    assert.notEqual(latest.generation, beforeGeneration); assert.notEqual(latest.generation, middleGeneration);
    await wait(form.submit());
    assert.deepEqual(submitted, [{answer: 'Current answer', sibling: 'Sibling current'}]);
    assert.deepEqual(form.getValues(), submitted[0]);
    return {coreRecreated: true, domRecreated: true, generationsDistinct: true, staleFacts: 0, retainedSibling: true, submit: submitted[0]};
  } finally {
    form.destroy(); host.remove();
    assert.equal(metricsOf(form).coreNodesCreated, metricsOf(form).coreNodesDestroyed);
  }
}
const fixedKeyNames = [];
for (const [format, api] of [['esm', imported], ['cjs', required]]) {
  for (const anonymous of [undefined, null, '']) {
    fixedKeyNames.push({format, anonymous: anonymous === undefined ? 'undefined' : anonymous === null ? 'null' : 'empty', ...await checkFixedKeyLifecycle(api, anonymous)});
  }
}

async function checkAnonymousEquivalence(api, component) {
  const host = document.createElement('main');
  document.body.append(host);
  const props = {name: '$candidate', key: 'anonymous-business-key', id: 'anonymous-answer', config: {delay: 0}};
  const submitted = [];
  const form = api.mount({
    host, [diagnostics]: true, formProps: {actions: false}, data: {candidate: 'answer'},
    schema: [component ? {$cmp: 'FormKit', props: {type: 'text', ...props}} : {$formkit: 'text', ...props}],
    onSubmit: values => {submitted.push(structuredClone(values));},
  });
  const input = () => host.querySelector('#anonymous-answer');
  try {
    const named = form.node.at('answer'), namedInput = input();
    assert.ok(named && namedInput);
    form.updateData({candidate: null});
    const anonymous = form.node.children.find(node => node.props.id === 'anonymous-answer'), element = input();
    assert.ok(anonymous && element);
    assert.notEqual(anonymous, named);
    assert.notEqual(element, namedInput);
    assert.equal(form.node.at('answer'), undefined);
    const key = String(anonymous.name);
    assert.ok(!['', 'null', 'undefined', 'answer'].includes(key));
    element.value = 'Anonymous edit';
    element.dispatchEvent(new Event('input', {bubbles: true}));
    await form.whenPendingEditsSettled();
    for (const candidate of ['', undefined]) {
      form.updateData({candidate});
      await form.whenPendingEditsSettled();
      assert.equal(form.node.at(key), anonymous);
      assert.equal(input(), element);
      assert.equal(String(anonymous.name), key);
      assert.equal(element.value, 'Anonymous edit');
    }
    const expected = {[key]: 'Anonymous edit'};
    assert.deepEqual(form.getValues(), expected);
    await form.submit();
    assert.deepEqual(submitted, [expected]);
  } finally {
    form.destroy();
    host.remove();
    assert.equal(metricsOf(form).coreNodesCreated, metricsOf(form).coreNodesDestroyed);
  }
}
const anonymousEquivalence = [];
for (const [format, api] of [['esm', imported], ['cjs', required]]) {
  for (const component of [false, true]) {
    await checkAnonymousEquivalence(api, component);
    anonymousEquivalence.push({format, syntax: component ? '$cmp' : '$formkit', passed: true});
  }
}

function checkRetainedAttrs(api) {
  const host = document.createElement('main');
  document.body.append(host);
  const form = api.mount({
    host, formProps: {actions: false}, data: {attrs: {'data-authored': 'drop-me'}},
    schema: [{$formkit: 'text', name: 'answer', bind: '$attrs'}],
    plugins: [node => {
      if (node.props.type === 'text') {
        node.on('created', () => {
          node.props.attrs = {...node.props.attrs, 'data-plugin': 'keep-me'};
        });
      }
    }],
  });
  try {
    const node = form.node.at('answer'), input = host.querySelector('input');
    assert.ok(node && input);
    assert.equal(input.getAttribute('data-authored'), 'drop-me');
    assert.equal(input.getAttribute('data-plugin'), 'keep-me');
    form.updateData({attrs: {}});
    assert.equal(form.node.at('answer'), node);
    assert.equal(host.querySelector('input'), input);
    assert.equal(input.hasAttribute('data-authored'), false);
    assert.equal(input.getAttribute('data-plugin'), 'keep-me');
    return true;
  } finally {
    form.destroy();
    host.remove();
  }
}
const retainedAttrs = Object.fromEntries(
  [['esm', imported], ['cjs', required]].map(([format, api]) => [format, checkRetainedAttrs(api)]),
);

dom.window.close();
console.log(JSON.stringify({ esm: 'passed', commonjs: 'passed', components: 'passed', encapsulatedExports: 'passed', mountUpdateDestroy: 'passed', dependencyVersions, wrapperConditions, fixedKeyNames, anonymousEquivalence, retainedAttrs }));
