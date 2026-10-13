import { afterEach, describe, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FormView, SubmissionError, createSchemaRenderer } from '@mnjs/formkit';
import { createNode, getNode, reset as resetNode } from '@formkit/core';
import { inputs } from '@formkit/inputs';

const owners = [];
function mount(options) {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  const form = new FormView(options);
  owners.push(region);
  try { region.show(form); } catch (error) { form.destroy(); throw error; }
  return form;
}
function render(schema, options = {}) {
  const container = document.body.appendChild(document.createElement('div'));
  const renderer = createSchemaRenderer(container, { schema, ...options });
  owners.push(renderer);
  return { container, ...renderer };
}
async function flush() { for (let index = 0; index < 12; index++) { await Promise.resolve(); } }
afterEach(() => { owners.splice(0).forEach(owner => owner.destroy()); document.body.replaceChildren(); });

describe('@mnjs/formkit native schema runtime', () => {
  it('mounts all official native controls with stable labels and editable core values', async() => {
    const types = ['text', 'email', 'password', 'search', 'tel', 'url', 'number', 'range', 'color', 'date',
      'datetime-local', 'month', 'time', 'week', 'hidden', 'textarea'];
    const clicked = vi.fn();
    const form = mount({ schema: [
      ...types.map(type => ({ $formkit: type, name: type, label: type, id: `matrix-${type}` })),
      { $formkit: 'meta', name: 'token', id: 'matrix-meta', value: { revision: 1 } },
      { $formkit: 'button', id: 'matrix-button', name: 'action', label: 'Native action', onClick: clicked }
    ] });
    await flush();
    for (const type of types) {
      const control = form.el.querySelector(`#matrix-${type}`);
      expect(control).not.toBeNull();
      if (type !== 'hidden') { expect(form.el.querySelector(`label[for="matrix-${type}"]`).textContent).toBe(type); }
      expect(getNode(control.id)).toBeDefined();
    }
    form.setValues({ text: 'Edited', textarea: 'Long biography', number: '123' });
    await flush();
    expect(form.el.querySelector('#matrix-text').value).toBe('Edited');
    expect(form.el.querySelector('#matrix-textarea').value).toBe('Long biography');
    expect(form.getValues().number).toBe('123');
    expect(form.getValues().token).toEqual({ revision: 1 });
    const action = form.el.querySelector('#matrix-button'); action.click();
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(form.getValues().action).toBeUndefined();
    form.destroy(); action.click();
    expect(clicked).toHaveBeenCalledTimes(1);
    expect(getNode('matrix-meta')).toBeUndefined();
    expect(getNode('matrix-button')).toBeUndefined();
  });

  it('supports scoped named slots and section extensions with no framework component', async() => {
    const form = mount({ schemaData: { suffix: 'remaining' }, schema: [{ $formkit: 'text', name: 'name', label: 'Name',
      children: { label: { $el: 'strong', attrs: { id: '$id + "-custom"' }, children: '$label' },
        help: { $el: 'p', children: '$value + " " + $suffix' } } }],
    sectionsSchema: { outer: { attrs: { 'data-native': true } } } });
    await flush();
    expect(form.el.querySelector('strong').textContent).toBe('Name');
    expect(form.el.querySelector('[data-native=true]')).not.toBeNull();
    form.setValues({ name: 'Seven' }); await flush();
    expect(form.el.querySelector('p').textContent).toBe('Seven remaining');
    form.setSchemaData({ suffix: 'letters' }); await flush();
    expect(form.el.querySelector('p').textContent).toBe('Seven letters');
  });

  it('owns custom native input definitions and releases them when schema type changes', async() => {
    const disposed = vi.fn();
    const factory = ({ document: doc }) => {
      const element = doc.createElement('output');
      return { element, update(next) { element.textContent = next.context.value; }, destroy: disposed };
    };
    const form = mount({ inputs: { native: { type: 'input', component: 'Output' } }, components: { Output: factory },
      values: { value: 'First' }, schemaData: { inputType: 'native', inputId: 'native-custom' },
      schema: [{ $formkit: '$inputType', name: 'value', id: '$inputId' }] });
    await flush();
    expect(form.el.querySelector('output').textContent).toBe('First');
    form.setValues({ value: 'Second' }); await flush();
    expect(form.el.querySelector('output').textContent).toBe('Second');
    form.setSchemaData({ inputType: 'text', inputId: 'native-custom' }); await flush();
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(form.el.querySelector('output')).toBeNull();
    expect(form.el.querySelector('input').value).toBe('Second');
    form.setSchemaData({ inputType: 'text', inputId: 'native-new-id' }); await flush();
    expect(getNode('native-custom')).toBeUndefined();
    expect(getNode('native-new-id')).toBeDefined();
    form.destroy(); form.setSchemaData({}); form.setSchema([]);
    expect(getNode('native-new-id')).toBeUndefined();
  });

  it('rejects unknown or framework input definitions and still allows explicit owner disposal', () => {
    expect(() => new FormView({})).toThrow(/exactly one of fields, schema, or template/);
    expect(() => new FormView({ fields: [], schema: [] })).toThrow(/exactly one of fields, schema, or template/);
    expect(() => mount({ schema: [{ $formkit: 'unknown', id: 'unknown-input' }] })).toThrow(/Unknown FormKit input/);
    expect(getNode('unknown-input')).toBeUndefined();
    expect(() => mount({ inputs: { invalid: { type: 'input' } }, schema: [{ $formkit: 'invalid' }] })).toThrow(/no schema/);
    expect(() => mount({ inputs: { vue: { type: 'input', component: { render() {} } } },
      schema: [{ $formkit: 'vue' }] })).toThrow(/native SchemaComponent/);
  });

  it('preserves nested list identities through frozen rapid actor snapshots using explicit item keys', async() => {
    const values = { rows: [{ id: 'a', children: [{ id: 'aa', title: 'Alpha' }] }, { id: 'b', children: [{ id: 'bb', title: 'Beta' }] }] };
    const schema = [{ $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
      { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
        { $formkit: 'hidden', name: 'id' }, { $formkit: 'list', name: 'children', dynamic: true, itemKey: item => item.id, children: [
          { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
            { $formkit: 'hidden', name: 'id' }, { $formkit: 'text', name: 'title', label: 'Child' }
          ] }
        ] }
      ] }
    ] }];
    const form = mount({ values, schema }); await flush();
    const [alpha, beta] = form.el.querySelectorAll('input[type=text]');
    beta.focus(); beta.setSelectionRange(1, 2);
    for (let index = 0; index < 5; index++) {
      form.setValues(Object.freeze({ rows: Object.freeze([
        Object.freeze({ id: 'b', children: Object.freeze([{ id: 'bb', title: `Beta ${index}` }]) }),
        Object.freeze({ id: 'a', children: Object.freeze([{ id: 'aa', title: 'Alpha' }]) })
      ]) }), { notify: false });
    }
    await flush();
    expect([...form.el.querySelectorAll('input[type=text]')]).toEqual([beta, alpha]);
    expect(beta.value).toBe('Beta 4');
    expect(beta.selectionStart).toBe(1);
    expect(document.activeElement).toBe(beta);
    form.setValues({ rows: [{ id: 'a', children: [] }] }); await flush();
    expect(getNode(beta.id)).toBeUndefined();
    expect(getNode(alpha.id)).toBeUndefined();
  });

  it('handles async errors, retry, overlapping submit, reset and late completion on official forms', async() => {
    let reject; let resolve;
    const signals = [];
    const submit = vi.fn((_values, { signal }) => { signals.push(signal); return new Promise((yes, no) => { resolve = yes; reject = no; }); });
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', label: 'Name', value: 'Paul' }], submit });
    await flush();
    const input = form.el.querySelector('input');
    const pending = form.submit(); await flush();
    expect(await form.submit()).toBe('busy');
    expect(input.disabled).toBe(true);
    expect(form.el.getAttribute('aria-busy')).toBe('true');
    reject(new SubmissionError('Retry later', { name: ['Name rejected'] }));
    expect(await pending).toBe('error'); await flush();
    expect(form.el.textContent).toContain('Name rejected');
    expect(input.disabled).toBe(false);
    const retry = form.submit(); await flush();
    form.resetForm();
    expect(await retry).toBe('cancelled');
    expect(signals[1].aborted).toBe(true);
    resolve('late'); await flush();
    expect(form.getFormState().submitted).toBe(false);
    expect(form.el.textContent).not.toContain('Name rejected');
    const final = form.submit(); await flush();
    form.destroy();
    expect(await final).toBe('cancelled');
    expect(signals[2].aborted).toBe(true);
    resolve('after destroy'); await flush();
  });

  it('renders trusted icons, class arrays/maps, style objects and supplied DOM slots with owned listeners', () => {
    const callback = vi.fn();
    const supplied = document.createElement('span'); supplied.textContent = 'Native slot';
    const controller = new AbortController();
    const view = render([{ $el: 'div', attrs: { class: ['$reset custom', { active: '$active', hidden: false }],
      style: '$style', innerHTML: '$html' } }, '$slots.native', { $el: 'button', attrs: { onClick: '$click' }, children: 'Click' }],
    { allowHTML: true, slots: { native: () => supplied }, data: { active: true, style: { color: 'red', '--accent': 'blue' }, html: '<b>Trusted</b>', click: callback } });
    const element = view.container.querySelector('div');
    expect(element.classList.contains('active')).toBe(true);
    expect(element.style.color).toBe('red');
    expect(element.style.getPropertyValue('--accent')).toBe('blue');
    expect(element.querySelector('b').textContent).toBe('Trusted');
    expect(view.container.querySelector('span')).toBe(supplied);
    const button = view.container.querySelector('button');
    const imperative = vi.fn();
    button.addEventListener('click', imperative, { signal: controller.signal });
    button.dispatchEvent(new Event('click'));
    expect(callback).toHaveBeenCalledTimes(1); expect(imperative).toHaveBeenCalledTimes(1);
    view.update({ active: false, style: null, html: null, click: callback });
    expect(element.innerHTML).toBe('');
    expect(element.getAttribute('style')).toBeNull();
    view.setSchema({ $el: 'div' });
    button.dispatchEvent(new Event('click'));
    expect(callback).toHaveBeenCalledTimes(1); expect(imperative).toHaveBeenCalledTimes(1);
    expect(controller.signal.aborted).toBe(false);
  });

  it('renders lexical scoped slots, tolerates omitted slots and watches borrowed node replacement until disposal', async() => {
    const view = render(['$slots.missing', '$slots.raw', '$slots.scoped', '$get("late-node").label'], {
      data: { label: 'Outer' }, slots: {
        raw: () => [{ $el: 'p', children: 'Raw schema slot' }],
        scoped: () => ({ schema: { $el: 'p', children: '$label' }, data: { label: 'Inner' } })
      }
    });
    expect(view.container.textContent).toBe('Raw schema slotInnernull');
    const node = createNode({ props: { id: 'late-node' } });
    owners.push(node); node.context = { label: 'Registered later' }; node.emit('context-update'); await flush();
    expect(view.container.textContent).toContain('Registered later');
    node.destroy(); await flush();
    expect(view.container.textContent).not.toContain('Registered later');
    const replacement = createNode({ props: { id: 'late-node' } }); owners.push(replacement);
    replacement.context = { label: 'Replacement' }; replacement.emit('context-update'); await flush();
    expect(view.container.textContent).toContain('Replacement');
    view.destroy(); replacement.context.label = 'After'; replacement.emit('context-update'); await flush();
    expect(view.container.textContent).toBe('');
  });
});

describe('@mnjs/formkit official form feature contracts', () => {
  it('recreates a declarative control after its public core node is destroyed', async() => {
    const form = mount({ schemaData: { current: 'Initial' },
      schema: [{ $formkit: 'text', id: 'recreated-control', name: 'name', value: '$current', label: 'Name' }] });
    await flush();
    const previous = getNode('recreated-control');
    previous.destroy();
    form.setSchemaData({ current: 'Recovered' }); await flush();
    const replacement = getNode('recreated-control');
    expect(replacement).toBeDefined(); expect(replacement).not.toBe(previous);
    expect(form.el.querySelector('#recreated-control').value).toBe('Recovered');
    expect(form.getValues().name).toBe('Recovered');
    form.destroy(); expect(getNode('recreated-control')).toBeUndefined();
  });

  it('recreates business-keyed components when a batched reset replaces their underlying core list node', async() => {
    const form = mount({ values: { rows: [{ id: 'b', name: 'Initial B' }] }, schema: [
      { $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
        { $formkit: 'group', for: ['item', 'index', '$value'], key: '$item.id', index: '$index', children: [
          { $formkit: 'hidden', name: 'id' }, { $formkit: 'text', name: 'name', label: 'Row' }
        ] }
      ] }
    ] });
    await flush();
    form.setValues({ rows: [{ id: 'a', name: 'Added A' }, { id: 'b', name: 'Initial B' }] }); await flush();
    expect(form.el.querySelectorAll('input[type=text]').length).toBe(2);
    form.resetForm(); await flush();
    expect(form.getValues().rows).toEqual([{ id: 'b', name: 'Initial B' }]);
    const rows = form.el.querySelectorAll('input[type=text]');
    expect(rows.length).toBe(1); expect(rows[0].value).toBe('Initial B');
    form.destroy(); expect(getNode(rows[0].id)).toBeUndefined();
  });

  it.each([
    ['a', 'b', 'c'], ['a', 'c', 'b'], ['b', 'a', 'c'],
    ['b', 'c', 'a'], ['c', 'a', 'b'], ['c', 'b', 'a']
  ])('reconciles surviving business-keyed controls after resetting %s/%s/%s', async(...ids) => {
    const initial = [{ id: 'b', name: 'Initial B' }, { id: 'c', name: 'Initial C' }];
    const form = mount({ values: { rows: initial }, schema: [
      { $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
        { $formkit: 'group', for: ['item', 'index', '$value'], key: '$item.id', index: '$index', children: [
          { $formkit: 'hidden', name: 'id' }, { $formkit: 'text', name: 'name', label: 'Row' }
        ] }
      ] }
    ] });
    await flush();
    form.setValues({ rows: ids.map(id => ({ id, name: id === 'a' ? 'Added A' : `Initial ${id.toUpperCase()}` })) }); await flush();
    form.resetForm(); await flush();
    expect(form.getValues().rows).toEqual(initial);
    const controls = [...form.el.querySelectorAll('input[type=text]')];
    expect(controls.map(control => control.value)).toEqual(['Initial B', 'Initial C']);
    controls[1].value = 'Edited C'; controls[1].dispatchEvent(new Event('input', { bubbles: true }));
    await getNode(controls[1].id).settled; await flush();
    expect(form.getValues().rows).toEqual([initial[0], { id: 'c', name: 'Edited C' }]);
    form.resetForm(); await flush();
    expect(form.getValues().rows).toEqual(initial);
    expect([...form.el.querySelectorAll('input[type=text]')]).toEqual(controls);
    expect(controls.map(control => control.value)).toEqual(['Initial B', 'Initial C']);
    form.destroy(); controls.forEach(control => expect(getNode(control.id)).toBeUndefined());
  });

  it('releases list nodes removed during a batched core reset and repeated native mount/destroy', async() => {
    for (let cycle = 0; cycle < 3; cycle++) {
      const form = mount({ values: { rows: [{ id: 'a', name: 'Initial' }] }, schema: [
        { $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
          { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
            { $formkit: 'hidden', name: 'id' }, { $formkit: 'text', name: 'name', label: 'Row' }
          ] }
        ] }
      ] });
      await flush();
      form.setValues({ rows: [{ id: 'a', name: 'Initial' }, { id: 'b', name: 'Extra' }] }); await flush();
      const input = form.el.querySelectorAll('input[type=text]')[1];
      const node = getNode(input.id); const context = node.context;
      form.resetForm(); await flush();
      expect(getNode(input.id)).toBeUndefined();
      expect(node.context).toBeNull();
      expect(input.isConnected).toBe(false);
      const update = vi.fn(); node.on('context-update', update);
      context.state = { retained: true };
      expect(update).not.toHaveBeenCalled();
      expect(form.getValues().rows).toEqual([{ id: 'a', name: 'Initial' }]);
      const remaining = form.el.querySelector('input[type=text]');
      form.destroy(); await flush();
      expect(getNode(remaining.id)).toBeUndefined();
    }
  });

  it('merges partial grouped values and replaces live descendant error props before native submission', async() => {
    const submit = vi.fn();
    const form = mount({ values: { profile: { name: 'Paul', role: 'Developer' } },
      schema: [{ $formkit: 'group', name: 'profile', children: [
        { $formkit: 'text', name: 'name', label: 'Name' },
        { $formkit: 'text', name: 'role', label: 'Role' }
      ] }], submit });
    form.setValues({ profile: { name: 'Ada' } }); await flush();
    expect(form.getValues().profile).toEqual({ name: 'Ada', role: 'Developer' });
    form.node.props.inputErrors = { 'profile.name': ['A name error'] }; await flush();
    expect(form.el.textContent).toContain('A name error');
    form.node.props.inputErrors = { 'profile.role': ['A role error'] }; await flush();
    expect(form.el.textContent).not.toContain('A name error');
    expect(form.el.textContent).toContain('A role error');
    form.node.props.inputErrors = {}; await flush();
    expect(form.el.textContent).not.toContain('A role error');
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(submit.mock.calls[0][0]).toEqual({ profile: { name: 'Ada', role: 'Developer' } });
  });

  it('supports public schema regeneration with changed native library components and inspected scalar slots', async() => {
    let inspected;
    const output = text => ({ document: doc }) => {
      const element = doc.createElement('output'); element.textContent = text;
      return { element, update() {}, destroy() {} };
    };
    const first = { type: 'input', schema: { $cmp: 'First' }, library: { First: output('First renderer') },
      features: [node => node.on('mounted', () => { inspected = node.context.slots.default(); })] };
    const form = mount({ inputs: { changing: first, form: { ...inputs.form, schema: inputs.form.schema({}) } },
      schema: [{ $formkit: 'changing', id: 'schema-regenerated', name: 'changing', children: { $el: 'span', children: 'Scalar slot' } }] });
    await flush();
    expect(inspected).toMatchObject([{ $el: 'span', children: 'Scalar slot' }]);
    expect(form.el.querySelector('output').textContent).toBe('First renderer');
    const node = getNode('schema-regenerated');
    node.props.definition = { type: 'input', schema: { $cmp: 'Second' }, library: { Second: output('Second renderer') } };
    node.emit('schema'); await flush();
    expect(form.el.querySelector('output').textContent).toBe('Second renderer');
  });

  it('binds primitive expression methods and conditional loops and releases captured imperative listeners', () => {
    const view = render([{ $el: 'p', children: '$text.trim()' },
      { if: '$show', then: { $el: 'span', children: '$entry' }, for: ['entry', '$entries'] },
      { $el: 'input', attrs: { type: 'file', value: 'Do not assign to a native file control' } },
      { $el: 'div', attrs: { class: null, innerHTML: '<b>Constant</b>' } },
      { $el: 'button', children: 'Owned' }],
    { allowHTML: true, data: { text: ' Native ', show: true, entries: [1, 2] } });
    expect(view.container.querySelector('p').textContent).toBe('Native');
    expect([...view.container.querySelectorAll('span')].map(el => el.textContent)).toEqual(['1', '2']);
    expect(view.container.querySelector('input').value).toBe('');
    const button = view.container.querySelector('button');
    const callback = vi.fn(); button.addEventListener('click', callback, true);
    button.click(); expect(callback).toHaveBeenCalledTimes(1);
    view.update({ text: 'Again', show: false, entries: [1, 2] });
    expect(view.container.querySelector('p').textContent).toBe('Again');
    expect(view.container.querySelectorAll('span').length).toBe(0);
    view.destroy(); button.click(); expect(callback).toHaveBeenCalledTimes(1);
    expect(() => render({ $el: 'button', attrs: { onClick: 'unsafe()' } })).toThrow(/function bindings/);
  });

  it('honors form callbacks, incomplete messages and live async submission with default native actions', async() => {
    let finish;
    const raw = vi.fn(); const invalid = vi.fn();
    const submit = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const form = mount({ formProps: { onSubmitRaw: raw, onSubmitInvalid: invalid, onSubmit: submit,
      incompleteMessage: 'Complete required fields.', submitBehavior: 'live', submitAttrs: { 'data-owner': 'application' } },
    schema: [{ $formkit: 'text', name: 'name', label: 'Name', validation: 'required' }] });
    await flush();
    expect(await form.submit()).toBe('invalid');
    expect(invalid).toHaveBeenCalledWith(form.node);
    expect(form.el.textContent).toContain('Complete required fields.');
    expect(form.el.querySelector('button[data-owner=application]')).not.toBeNull();
    form.setValues({ name: 'Ready' }); await flush();
    const pending = form.submit();
    await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
    expect(form.el.querySelector('input').disabled).toBe(false);
    expect(form.node.context.state.loading).toBe(true);
    expect(submit).toHaveBeenCalledWith({ name: 'Ready' }, form.node);
    finish('Saved');
    expect(await pending).toBe('success');
    expect(raw).toHaveBeenCalledTimes(2);
    expect(form.node.context.state.loading).toBeUndefined();
  });

  it('omits incomplete messages when disabled and restores a root disabled prop changed by the owner', async() => {
    const form = mount({ formProps: { incompleteMessage: false }, schema: [{ $formkit: 'text', name: 'name', validation: 'required' }] });
    expect(await form.submit()).toBe('invalid');
    expect(form.node.store.incomplete).toBeUndefined();
    form.node.props.disabled = true; await flush();
    form.setValues({ name: 'Ready' }); await flush();
    expect(form.el.querySelector('input').disabled).toBe(true);
    expect(await form.submit()).toBe('success');
    expect(form.node.props.disabled).toBe(true);
    expect(form.el.querySelector('input').disabled).toBe(true);
  });

  it('renders customized action slots and literal/native custom input definitions', async() => {
    const factory = ({ document: doc }) => {
      const element = doc.createElement('output');
      return { element, update(props) { element.textContent = props.context.value; }, destroy() {} };
    };
    const form = mount({ slots: { actions: () => ({ $el: 'button', attrs: { type: 'submit' }, children: 'Custom action' }) },
      inputs: { output: { type: 'input', component: factory, props: { presentation: { default: 'native' } } },
        literal: { type: 'input', schema: { $el: 'output', children: '$value' } } },
      schema: [{ $formkit: 'output', name: 'output', value: 'Native output', presentation: 'semantic' },
        { $formkit: 'literal', name: 'literal', value: 'Literal output' }] });
    await flush();
    expect([...form.el.querySelectorAll('output')].map(el => el.textContent)).toEqual(['Native output', 'Literal output']);
    expect(form.el.querySelector('button').textContent).toBe('Custom action');
    expect(form.el.querySelector('button[type=reset]')).toBeNull();
  });

  it('updates initialized values, names, ids, slots and native attributes through explicit schema data', async() => {
    const form = mount({ schemaData: { fieldName: 'first', seed: 'One', fieldId: 'changing-field',
      text: 'Original help', classes: { outer: 'outer-custom' }, title: 'Title' },
    schema: [{ $formkit: 'text', name: '$fieldName', id: '$fieldId', value: '$seed', title: '$title', classes: '$classes',
      children: { help: { $el: 'p', children: '$text' } } }] });
    await flush();
    const input = form.el.querySelector('input');
    expect(input.value).toBe('One'); expect(input.title).toBe('Title');
    form.setSchemaData({ fieldName: 'first', seed: 'Two', text: 'Updated help' }); await flush();
    expect(form.el.querySelector('input')).toBe(input);
    expect(input.value).toBe('Two'); expect(input.title).toBe('');
    expect(form.el.querySelector('p').textContent).toBe('Updated help');
    form.setSchemaData({ fieldName: 'second', seed: 'Three', fieldId: 'renamed-field', text: 'Renamed help' }); await flush();
    expect(getNode('changing-field')).toBeUndefined();
    expect(form.el.querySelector('input').value).toBe('Three');
    expect(form.getValues()).toMatchObject({ second: 'Three' });
  });

  it('renders children borrowed from a separate parent while owning only the mounted native nodes', async() => {
    const parent = createNode({ type: 'group', value: {}, props: { id: 'borrowed-parent' } }); owners.push(parent);
    const form = mount({ schemaData: { owner: parent }, schema: [{ $formkit: 'text', parent: '$owner', name: 'name', label: 'Borrowed child' }] });
    await flush();
    const input = form.el.querySelector('input');
    expect(parent.children.length).toBe(1);
    form.destroy(); await flush();
    expect(parent.children.length).toBe(0);
    expect(getNode(input.id)).toBeUndefined();
    expect(getNode('borrowed-parent')).toBe(parent);
  });

  it('uses visible validation modes, numeric blur normalization and public computed context', async() => {
    const form = mount({ config: { rootClasses: undefined }, schema: [
      { $formkit: 'text', name: 'live', validation: 'required', validationVisibility: 'live' },
      { $formkit: 'text', name: 'silent', validation: 'required', validationVisibility: 'submit' },
      { $formkit: 'hidden', name: 'hidden', number: true }
    ] }); await flush();
    const [liveInput, silentInput, hiddenInput] = form.el.querySelectorAll('input');
    const live = getNode(liveInput.id); const silent = getNode(silentInput.id); const hidden = getNode(hiddenInput.id);
    expect(live.context.state.invalid).toBe(true);
    expect(live.context.state.passing).toBe(false);
    expect(silent.context.state.invalid).toBe(false);
    expect(String(live.context.classes)).toBe('[object Object]');
    expect(live.context.classes[Symbol.iterator]).toBeUndefined();
    hidden.input('42.5', false); hiddenInput.dispatchEvent(new FocusEvent('blur')); await flush();
    expect(hidden.value).toBe(42.5);
    hidden.input('invalid', false); hiddenInput.dispatchEvent(new FocusEvent('blur')); await flush();
    expect(hidden.value).toBeUndefined();
    silent.input('Valid', false); await silent.ledger.settled('validating'); await flush();
    expect(silent.context.state.passing).toBe(true);
    form.render(); expect(form.el.querySelector('input')).toBe(liveInput);
    form.destroy(); expect(form.render()).toBe(form);
  });
});

describe('@mnjs/formkit keyed reset identity', () => {
  it('restores item-key list order without exchanging live controls or pending row values', async() => {
    const initial = [{ id: 'b', note: 'Beta' }, { id: 'a', note: 'Alpha' }];
    const form = mount({ values: { entries: initial }, schema: [
      { $formkit: 'list', name: 'entries', dynamic: true, itemKey: 'id', children: [
        { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
          { $el: 'article', children: [
            { $formkit: 'hidden', name: 'id' }, { $formkit: 'textarea', name: 'note', label: 'Note', config: { delay: 40 } }
          ] }
        ] }
      ] }
    ] });
    await flush();
    const row = id => [...form.el.querySelectorAll('article')].find(article => article.querySelector('input').value === id);
    const beta = row('b').querySelector('textarea'); const alpha = row('a').querySelector('textarea');
    form.setValues({ entries: [...initial].reverse() }, { notify: false }); await flush();
    expect([...form.el.querySelectorAll('textarea')]).toEqual([alpha, beta]);
    beta.value = 'Pending beta'; beta.dispatchEvent(new Event('input', { bubbles: true }));
    expect(getNode(beta.id).isSettled).toBe(false);
    form.resetForm(); await new Promise(resolve => setTimeout(resolve, 60)); await flush();
    expect(form.getValues().entries).toEqual(initial);
    expect(row('b').querySelector('textarea')).toBe(beta);
    expect(row('a').querySelector('textarea')).toBe(alpha);
    expect([beta.value, alpha.value]).toEqual(['Beta', 'Alpha']);
    expect([getNode(beta.id).value, getNode(alpha.id).value]).toEqual(['Beta', 'Alpha']);
    beta.value = 'Edited beta'; beta.dispatchEvent(new Event('input', { bubbles: true }));
    await getNode(beta.id).settled; await flush();
    expect(form.getValues().entries).toEqual([{ id: 'b', note: 'Edited beta' }, initial[1]]);
    form.destroy(); expect(getNode(beta.id)).toBeUndefined(); expect(getNode(alpha.id)).toBeUndefined();
  });
});

it('resets function-keyed nested rows through one root input and one reset notification', async() => {
  const initial = { sections: [{ id: 'main', rows: [{ id: 'a', note: 'Alpha' }, { id: 'b', note: 'Beta' }] }], title: 'Planning' };
  const form = mount({ values: initial, schema: [
    { $formkit: 'text', name: 'title', label: 'Title' },
    { $formkit: 'list', name: 'sections', dynamic: true, itemKey: 'id', children: [
      { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
        { $formkit: 'hidden', name: 'id' },
        { $formkit: 'list', name: 'rows', dynamic: true, itemKey: item => item.id, children: [
          { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
            { $formkit: 'hidden', name: 'id' }, { $formkit: 'textarea', name: 'note', label: 'Note' }
          ] }
        ] }
      ] }
    ] }
  ] });
  await flush();
  const [alpha, beta] = form.el.querySelectorAll('textarea');
  form.setValues({ sections: [{ id: 'main', rows: [...initial.sections[0].rows].reverse() }] }, { notify: false }); await flush();
  expect(form.el.querySelectorAll('textarea')[0]).toBe(beta);
  expect(form.el.querySelectorAll('textarea')[1]).toBe(alpha);
  const rootInputs = [];
  const notifications = [];
  form.node.on('input', ({ payload }) => rootInputs.push(structuredClone(payload)));
  form.on('form:change', (values, _state, metadata) => notifications.push({ values, source: metadata.source }));
  form.resetForm(); await flush();
  expect(form.getValues()).toEqual(initial);
  expect(form.el.querySelectorAll('textarea')[0]).toBe(alpha);
  expect(form.el.querySelectorAll('textarea')[1]).toBe(beta);
  expect([alpha.value, beta.value]).toEqual(['Alpha', 'Beta']);
  expect(rootInputs).toEqual([initial]);
  expect(notifications).toEqual([{ values: initial, source: 'reset' }]);
});

it('restores absent initial keyed values and releases their controls on destruction', async() => {
  const initial = [{ id: 'a', note: 'Alpha' }];
  const form = mount({ values: { rows: initial }, schema: [
    { $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
      { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
        { $formkit: 'hidden', name: 'id' }, { $formkit: 'textarea', name: 'note', label: 'Note' }
      ] }
    ] }
  ] });
  await flush();
  const alpha = form.el.querySelector('textarea');
  form.setValues({ rows: [{ id: 'x', note: 'Added' }] }); await flush();
  const added = form.el.querySelector('textarea');
  form.resetForm(); await flush();
  expect(form.getValues().rows).toEqual(initial);
  expect(form.el.querySelector('input[type=hidden]').value).toBe('a');
  expect(form.el.querySelector('textarea').value).toBe('Alpha');
  form.destroy();
  expect(getNode(alpha.id)).toBeUndefined(); expect(getNode(added.id)).toBeUndefined();
});

it('keeps ordinary unkeyed scalar list reset positional', async() => {
  const form = mount({ values: { labels: ['First', 'Second'] }, schema: [
    { $formkit: 'list', name: 'labels', dynamic: true, children: [
      { $formkit: 'text', for: ['item', 'index', '$items'], key: '$item', index: '$index', label: 'Label' }
    ] }
  ] });
  await flush();
  form.setValues({ labels: ['Changed', 'Other'] }); await flush();
  form.resetForm(); await flush();
  expect(form.getValues()).toEqual({ labels: ['First', 'Second'] });
  expect([...form.el.querySelectorAll('input[type=text]')].map(control => control.value)).toEqual(['First', 'Second']);
});


it.each([false, true])('retains nested keyed controls beside a keyless row on reset (keyless first: %s)', async keylessFirst => {
  const keyed = { key: 'a', label: 'A', rows: [{ id: 'p', note: 'A P' }, { id: 'q', note: 'A Q' }] };
  const keyless = { label: 'U', rows: [{ id: 'q', note: 'U Q' }, { id: 'p', note: 'U P' }] };
  const initial = keylessFirst ? [keyless, keyed] : [keyed, keyless];
  const form = mount({ values: { sections: initial }, schema: [
    { $formkit: 'list', name: 'sections', dynamic: true, itemKey: 'key', children: [
      { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
        { $el: 'section', attrs: { 'data-owner': '$value.label' }, children: [
          { $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
            { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
              { $el: 'article', children: [
                { $formkit: 'hidden', name: 'id' }, { $formkit: 'textarea', name: 'note', label: 'Note' }
              ] }
            ] }
          ] }
        ] }
      ] }
    ] }
  ] });
  await flush();
  const control = id => [...form.el.querySelectorAll('section[data-owner="A"] article')]
    .find(row => row.querySelector('input').value === id).querySelector('textarea');
  const p = control('p'); const q = control('q');
  form.setValues({ sections: [...initial].reverse() }, { notify: false }); await flush();
  expect(control('p')).toBe(p); expect(control('q')).toBe(q);
  form.resetForm(); await flush();
  expect(form.getValues()).toEqual({ sections: initial });
  expect(control('p')).toBe(p); expect(control('q')).toBe(q);
  expect([p.value, q.value]).toEqual(['A P', 'A Q']);
});


it.each([
  { ids: ['a', 'b', 'c'], explicit: false },
  { ids: ['a', 'c', 'b'], explicit: true },
  { ids: ['b', 'a', 'c'], explicit: false },
  { ids: ['c', 'a', 'b'], explicit: true }
])('reconciles business-keyed schema after public Core reset ($ids, explicit value: $explicit)', async({ ids, explicit }) => {
  const initial = [{ id: 'b', name: 'Initial B' }, { id: 'c', name: 'Initial C' }];
  const form = mount({ values: { rows: initial }, schema: [
    { $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
      { $formkit: 'group', for: ['item', 'index', '$value'], key: '$item.id', index: '$index',
        ...(explicit ? { value: '$item' } : {}), children: [
          { $formkit: 'hidden', name: 'id' }, { $formkit: 'text', name: 'name', label: 'Row' }
        ] }
    ] }
  ] });
  await flush();
  form.setValues({ rows: ids.map(id => ({ id, name: id === 'a' ? 'Added A' : `Initial ${id.toUpperCase()}` })) });
  await flush();
  const previous = [...form.el.querySelectorAll('input')];
  resetNode(form.node, { rows: initial }); await flush();
  expect(form.getValues()).toEqual({ rows: initial });
  const controls = [...form.el.querySelectorAll('input[type=text]')];
  expect(controls.map(control => control.value)).toEqual(['Initial B', 'Initial C']);
  expect([...form.el.querySelectorAll('input[type=hidden]')].map(control => control.value)).toEqual(['b', 'c']);
  controls[1].value = 'After Core reset'; controls[1].dispatchEvent(new Event('input', { bubbles: true }));
  await getNode(controls[1].id).settled; await flush();
  expect(form.getValues().rows).toEqual([initial[0], { id: 'c', name: 'After Core reset' }]);
  form.destroy();
  [...previous, ...controls].forEach(control => expect(getNode(control.id)).toBeUndefined());
});

it('resets an explicitly added schema field to its authored default alongside construction values', async() => {
  const name = { $formkit: 'text', name: 'name', label: 'Name' };
  const form = mount({ values: { name: 'Construction' }, schema: [name] });
  form.setSchema([name, { $formkit: 'text', name: 'extra', label: 'Extra', value: 'Authored' }]);
  await flush();
  form.setValues({ name: 'Edited', extra: 'Draft' }); await flush();
  form.resetForm(); await flush();
  expect(form.getValues()).toEqual({ name: 'Construction', extra: 'Authored' });
  const controls = [...form.el.querySelectorAll('input[type=text]')];
  expect(controls.map(control => control.value)).toEqual(['Construction', 'Authored']);
  form.destroy(); controls.forEach(control => expect(getNode(control.id)).toBeUndefined());
});


it('restores nested rendered values and releases registries when reset recreates a removed initial row', async() => {
  const initial = [
    { id: 'u', rows: [{ id: 'q', note: 'U Q' }, { id: 'p', note: 'U P' }] },
    { id: 'a', rows: [{ id: 'p', note: 'A P' }, { id: 'q', note: 'A Q' }] }
  ];
  const form = mount({ values: { sections: initial }, schema: [
    { $formkit: 'list', name: 'sections', dynamic: true, itemKey: 'id', children: [
      { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
        { $el: 'section', attrs: { 'data-section': '$value.id' }, children: [
          { $formkit: 'hidden', name: 'id' },
          { $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
            { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
              { $el: 'article', children: [
                { $formkit: 'hidden', name: 'id' }, { $formkit: 'textarea', name: 'note', label: 'Note' }
              ] }
            ] }
          ] }
        ] }
      ] }
    ] }
  ] });
  await flush();
  const original = [...form.el.querySelectorAll('input, textarea')];
  form.setValues({ sections: [initial[1]] }); await flush();
  expect(form.el.querySelectorAll('section').length).toBe(1);
  form.resetForm(); await flush();
  expect(form.getValues()).toEqual({ sections: initial });
  const rendered = [...form.el.querySelectorAll('section')].map(section => ({
    id: section.dataset.section,
    rows: [...section.querySelectorAll('article')].map(row => ({ id: row.querySelector('input').value, note: row.querySelector('textarea').value }))
  }));
  expect(rendered).toEqual(initial);
  // Membership-changing reset does not currently guarantee retained widget identity.
  const restored = [...form.el.querySelectorAll('input, textarea')];
  form.destroy();
  [...original, ...restored].forEach(control => expect(getNode(control.id)).toBeUndefined());
  expect(restored.every(control => !control.isConnected)).toBe(true);
});
