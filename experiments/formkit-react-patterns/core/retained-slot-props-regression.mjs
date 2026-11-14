// Shared custom-definition contracts reproduced without licensed input code.
import assert from 'node:assert/strict';
import {setupProjectionDom, settle} from './schema-projection-reference.mjs';
const dom = setupProjectionDom(), host = document.querySelector('main'), arm = process.argv[2] ?? 'adapter', mode = process.argv[3] ?? 'all';
const {reset, getNode} = await import('@formkit/core');
const {kebab} = await import('@formkit/utils');
const checks = [], captured = [], destroyed = new Map();
const capture = node => {captured.push(node); node.on('destroyed', () => destroyed.set(node, (destroyed.get(node) ?? 0) + 1));};
const options = {config: {delay: 0, rootClasses: section => ({['formkit-' + kebab(section)]: true})}, plugins: [capture], inputs: {
  declared: {type: 'input', props: ['disabled', 'label', 'help', 'validationVisibility'], features: [node => node.on('created', () => {node.context.handlers.pick = () => node.input('picked', false);})], schema: {$el: 'button', attrs: {type: 'button', disabled: '$disabled', onClick: '$handlers.pick'}, children: '$label'}},
  rows: {type: 'list', props: ['disabled', 'readonly'], schema: {$el: 'section', attrs: {'data-rows': true}, children: [{$formkit: 'group', for: ['row', 'index', '$_value'], index: '$index', sync: true, children: '$slots.default'}]}}
}};
let active;
const schema = item => {const {children, ...props} = item; return {$formkit: props.type ?? 'text', ...props, ...(children ? {children: children.map(schema)} : {})};};
const field = item => {const {children, ...props} = item; return {...props, ...(children ? {children: ['group', 'list', 'form'].includes(props.type) ? children.map(field) : {default: children.map(schema)}} : {})};};
async function mountFields(fields, values = {}) {
  let form, update, destroy, submitted = [];
  if (arm === 'adapter') {
    const {mount} = await import('./index.mjs');
    const api = mount({host, fields: fields.map(field), values, ...options, formProps: {actions: false}, onSubmit: value => submitted.push(JSON.parse(JSON.stringify(value)))});
    form = api.node; update = next => api.setFields(next.map(field)); destroy = () => api.destroy();
  } else if (arm === 'vue') {
    const {createApp, h, shallowRef} = await import('vue'), {FormKit, FormKitProvider, defaultConfig} = await import('@formkit/vue');
    const state = shallowRef(fields), config = defaultConfig(options);
    const input = item => {const {children, ...props} = item; return h(FormKit, {...props, key: item.name}, children ? {default: () => children.map(input)} : undefined);};
    const app = createApp({render: () => h(FormKitProvider, {config}, {default: () => h(FormKit, {type: 'form', value: values, actions: false, onNode: node => {form = node;}, onSubmit: value => submitted.push(JSON.parse(JSON.stringify(value)))}, {default: () => state.value.map(input)})})});
    app.mount(host); update = next => {state.value = next;}; destroy = () => app.unmount();
  } else {
    const {createElement: h} = await import('react'), {createRoot} = await import('react-dom/client'), {flushSync} = await import('react-dom'), {FormKit, FormKitProvider, defaultConfig} = await import('@formkit/react');
    const ui = createRoot(host), config = defaultConfig(options);
    const input = item => {const {children, ...props} = item; return h(FormKit, {...props, key: item.name}, ...(children ?? []).map(input));};
    const render = next => flushSync(() => ui.render(h(FormKitProvider, {config}, h(FormKit, {type: 'form', defaultValue: values, actions: false, onNode: node => {form = node;}, onSubmit: value => submitted.push(JSON.parse(JSON.stringify(value)))}, ...next.map(input)))));
    render(fields); update = render; destroy = () => flushSync(() => ui.unmount());
  }
  await settle(); assert.ok(form);
  active = {form, submitted, async update(next) {update(next); await settle();}, async destroy() {destroy(); await settle(); assert.equal(host.childElementCount, 0);}};
  return active;
}
try {
  if (mode === 'all' || mode === 'props') {
    const spec = {type: 'declared', name: 'field', label: 'Before', help: 'Help before'};
    const api = await mountFields([spec], {field: 'initial'}), node = api.form.at('field'), button = host.querySelector('button');
    for (const disabled of [true, false, true, false]) {
      await api.update([{...spec, label: 'After', help: 'Help after', disabled}]);
      assert.equal(api.form.at('field'), node); assert.equal(host.querySelector('button'), button);
      assert.equal(!!node.props.disabled, disabled, 'definition-declared disabled must survive normalized update');
      assert.equal(!!node.context.disabled, disabled); assert.equal(button.disabled, disabled);
      assert.equal(node.props.label, 'After'); assert.equal(node.props.help, 'Help after');
      await node.input('before click', false); button.click(); await settle(); assert.equal(node.value, disabled ? 'before click' : 'picked');
    }
    if (arm === 'adapter') {await api.update([{...spec, disabled: true}]);}
    await api.update([spec]); assert.equal(!!node.props.disabled, false); assert.equal(button.disabled, false);
    await api.update([{...spec, readonly: true}]); assert.equal(button.disabled, false);
    await node.input('readonly baseline', false); button.click(); await settle(); assert.equal(node.value, 'picked');
    reset(api.form); await settle(); assert.equal(node.value, 'initial');
    await api.destroy(); active = undefined;
    checks.push('definition-declared general props, disabled click suppression, removal, identity and reset');
  }
  if (mode === 'all' || mode === 'slots') {
    const spec = {type: 'rows', name: 'rows', children: [{type: 'text', name: 'leaf', validation: 'required'}]};
    const api = await mountFields([spec], {rows: [{leaf: 'A'}, {leaf: 'B'}]}), rows = api.form.at('rows'), groups = [...rows.children], leaves = groups.map(group => group.at('$self.leaf')), inputs = [...host.querySelectorAll('input')];
    await leaves[0].input('Edited A', false); await settle();
    for (const disabled of [true, false, true]) {
      await api.update([{...spec, disabled, readonly: disabled}]);
      assert.equal(api.form.at('rows'), rows); assert.deepEqual([...rows.children].map((node, index) => node === groups[index]), groups.map(() => true));
      assert.deepEqual(groups.map((group, index) => group.at('$self.leaf') === leaves[index]), leaves.map(() => true), 'equivalent reconstructed slot declarations retain child Core owners');
      assert.deepEqual([...host.querySelectorAll('input')].map((input, index) => input === inputs[index]), inputs.map(() => true));
      assert.deepEqual(rows.value, [{leaf: 'Edited A'}, {leaf: 'B'}]); assert.deepEqual(inputs.map(input => input.value), ['Edited A', 'B']);
    }
    await api.update([spec]);
    host.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})); await settle(); assert.deepEqual(api.submitted.at(-1), {rows: [{leaf: 'Edited A'}, {leaf: 'B'}]});
    await leaves[1].input('', false); await settle(); const count = api.submitted.length;
    host.querySelector('form').dispatchEvent(new Event('submit', {bubbles: true, cancelable: true})); await settle(); assert.equal(api.submitted.length, count);
    reset(api.form); await settle(); assert.deepEqual(rows.value, [{leaf: 'A'}, {leaf: 'B'}]);
    await api.destroy(); active = undefined;
    checks.push('reconstructed row slots retain edits/Core/DOM across flags and still validate, submit, reset and dispose');
  }
  assert.equal(captured.length, destroyed.size); assert.ok([...destroyed.values()].every(count => count === 1));
  for (const node of captured) {assert.equal(getNode(node.props.id), undefined);}
  console.log(JSON.stringify({arm, mode, passed: true, created: captured.length, destroyed: destroyed.size, checks}));
} finally {await active?.destroy(); dom.window.close();}
