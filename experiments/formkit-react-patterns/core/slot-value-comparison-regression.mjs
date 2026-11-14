// Slot retention compares schema structure; opaque prop values keep reference semantics.
import assert from 'node:assert/strict';
import {setupProjectionDom, settle} from './schema-projection-reference.mjs';
const dom = setupProjectionDom(), host = document.querySelector('main'), arm = process.argv[2] ?? 'adapter', mode = process.argv[3] ?? 'all';
const {getNode} = await import('@formkit/core');
const captured = [], destroyed = new Map(), checks = [];
const capture = node => {captured.push(node); node.on('destroyed', () => destroyed.set(node, (destroyed.get(node) ?? 0) + 1));};
const configOptions = {plugins: [capture], config: {delay: 0}, inputs: {
  box: {type: 'group', schema: {$el: 'section', children: ['$slots.default']}},
  payload: {type: 'input', props: ['payload', 'format', 'handler'], schema: {$el: 'button', attrs: {type: 'button', onClick: '$handler'}, children: '$format($payload)'}}
}};
let active;
async function mountValue(initial, format, handler, initialKey = 'kept') {
  const declaration = (value, callback = handler, key = initialKey) => ({type: 'box', name: 'owner', children: [{type: 'payload', name: 'leaf', key, payload: value, format, handler: callback}]});
  let form, update, destroy;
  if (arm === 'adapter') {
    const {mount} = await import('./index.mjs');
    const fields = spec => [{...spec, children: {default: spec.children.map(child => {const {type, ...props} = child; return {$formkit: type, ...props};})}}];
    const api = mount({host, fields: fields(declaration(initial)), ...configOptions, formProps: {actions: false}});
    form = api.node; update = spec => api.setFields(fields(spec)); destroy = () => api.destroy();
  } else if (arm === 'vue') {
    const {createApp, h, shallowRef} = await import('vue'), {FormKit, FormKitProvider, defaultConfig} = await import('@formkit/vue');
    const state = shallowRef(declaration(initial)), config = defaultConfig(configOptions);
    const input = spec => {const {children, ...props} = spec; return h(FormKit, {...props, key: spec.key ?? spec.name}, children ? {default: () => children.map(input)} : undefined);};
    const app = createApp({render: () => h(FormKitProvider, {config}, {default: () => h(FormKit, {type: 'form', actions: false, onNode: node => {form = node;}}, {default: () => input(state.value)})})});
    app.mount(host); update = spec => {state.value = spec;}; destroy = () => app.unmount();
  } else {
    const {createElement: h} = await import('react'), {createRoot} = await import('react-dom/client'), {flushSync} = await import('react-dom'), {FormKit, FormKitProvider, defaultConfig} = await import('@formkit/react');
    const root = createRoot(host), config = defaultConfig(configOptions);
    const input = spec => {const {children, ...props} = spec; return h(FormKit, {...props, key: spec.key ?? spec.name}, ...(children ?? []).map(input));};
    const render = spec => flushSync(() => root.render(h(FormKitProvider, {config}, h(FormKit, {type: 'form', actions: false, onNode: node => {form = node;}}, input(spec)))));
    render(declaration(initial)); update = render; destroy = () => flushSync(() => root.unmount());
  }
  await settle(); assert.ok(form);
  active = {get leaf() {return form.at('owner.leaf');}, async update(value, callback = handler, key = initialKey) {update(declaration(value, callback, key)); await settle();}, async destroy() {destroy(); await settle(); assert.equal(host.childElementCount, 0);}};
  return active;
}
class HiddenValue {
  #value;
  constructor(value) {this.#value = value;}
  getValue() {return this.#value;}
}
const cases = [
  {name: 'Date', before: new Date('2024-01-01T00:00:00Z'), after: new Date('2025-01-01T00:00:00Z'), format: value => String(value.getUTCFullYear()), expected: '2025'},
  {name: 'RegExp', before: /before/i, after: /after/g, format: value => value.toString(), expected: '/after/g'},
  {name: 'Map', before: new Map([['value', 'before']]), after: new Map([['value', 'after']]), format: value => value.get('value'), expected: 'after'},
  {name: 'Set', before: new Set(['before']), after: new Set(['after']), format: value => [...value].join(','), expected: 'after'},
  {name: 'private class state', before: Object.freeze(new HiddenValue('before')), after: Object.freeze(new HiddenValue('after')), format: value => value.getValue(), expected: 'after'}
];
try {
  for (const test of mode.startsWith('date') ? cases.slice(0, 1) : cases) {
    const callback = () => {}, api = await mountValue(test.before, test.format, callback), first = api.leaf, button = host.querySelector('button');
    await api.update(test.before); if (mode !== 'date-value') {assert.equal(api.leaf === first, true, test.name + ' same reference retains Core'); assert.equal(host.querySelector('button') === button, true);}
    await api.update(test.after); assert.equal(host.querySelector('button').textContent, test.expected, test.name + ' replacement must update props');
    let current = test.after;
    if (test.name === 'Date') {current = new Date(test.after.valueOf()); await api.update(current); assert.equal(api.leaf.props.payload === current, true, 'distinct equal-date prop reaches Core');}
    const replaced = api.leaf, replacedButton = host.querySelector('button');
    await api.update(current); if (mode !== 'date-value') {assert.equal(api.leaf === replaced, true); assert.equal(host.querySelector('button') === replacedButton, true);}
    await api.destroy(); active = undefined; checks.push(test.name + (mode === 'date-value' ? ' value replacement' : ' replacement and same-reference retention'));
  }
  if (!mode.startsWith('date')) {
    const format = value => value.nested.join(','), values = {nested: ['plain', 'array']};
    let firstCalls = 0, secondCalls = 0;
    const firstCallback = () => {firstCalls++;}, secondCallback = () => {secondCalls++;};
    const api = await mountValue(values, format, firstCallback), first = api.leaf, button = host.querySelector('button');
    await api.update({nested: ['plain', 'array']}); assert.equal(api.leaf === first, true); assert.equal(host.querySelector('button') === button, true);
    button.click(); assert.equal(firstCalls, 1);
    await api.update({nested: ['plain', 'array']}, secondCallback); host.querySelector('button').click(); assert.equal(firstCalls, 1); assert.equal(secondCalls, 1);
    const beforeKey = api.leaf, beforeKeyButton = host.querySelector('button');
    await api.update({nested: ['plain', 'array']}, secondCallback, 'changed'); assert.equal(api.leaf === beforeKey, false); assert.equal(host.querySelector('button') === beforeKeyButton, false);
    host.querySelector('button').click(); assert.equal(secondCalls, 2);
    await api.destroy(); active = undefined; checks.push('plain arrays/objects, callback replacement and explicit-key remount');
  }
  assert.equal(captured.length, destroyed.size); assert.ok([...destroyed.values()].every(count => count === 1));
  for (const node of captured) {assert.equal(getNode(node.props.id), undefined);}
  console.log(JSON.stringify({arm, mode, passed: true, created: captured.length, destroyed: destroyed.size, checks}));
} finally {await active?.destroy(); dom.window.close();}
