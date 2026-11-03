// PRIVATE TEST ONLY: this composition entry is provisional and has no package export.
import { afterEach, expect, it, vi } from 'vitest';
import { Region, View } from 'marionette';
import { FieldView } from '@mnjs/formkit';
import { CompositionForm } from '@private-test/formkit-composition-prototype';
import { getNode } from '@formkit/core';

const owners = [];
const drain = async() => { for (let index = 0; index < 30; index++) { await Promise.resolve(); } };
const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const settle = async form => { await form.settledComposition(); await drain(); };
const enabled = { dependencies: { enabled: ['enabled'] }, test: values => values.enabled === true };
function leaf(key, extra = {}) {
  return { key, path: [key], region: key, retention: 'clear', input: { type: 'text', value: key.toUpperCase() }, ...extra };
}
function construct(composition, options = {}) {
  const names = [...new Set(['control', 'ordinary', 'gate', 'group', ...composition.map(item => item.region)])];
  const form = new CompositionForm({
    template: () => names.map(name => `<div data-region="${name}"></div>`).join(''),
    regions: Object.fromEntries(names.map(name => [name, `[data-region="${name}"]`])),
    ...options, composition,
  });
  owners.push(form);
  return form;
}
function mount(composition, options = {}) {
  const form = construct(composition, options);
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(owner);
  owner.show(form);
  return form;
}
function ordinary(form, region, name, input = {}, parent, removal = 'preserve') {
  const field = new FieldView({ form, name, parent, removal, input: { type: 'text', ...input } });
  form.showChildView(region, field);
  return field;
}
function edit(field, value) {
  const input = field.el.querySelector('input');
  if (input.type === 'checkbox') { input.checked = value; } else { input.value = value; }
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input;
}
afterEach(async() => {
  owners.splice(0).reverse().forEach(owner => owner.destroy());
  await drain();
  document.body.replaceChildren();
});

it('settles before first render and keeps an unconditional native field stable on later renders', async() => {
  const form = construct([leaf('detail')]);
  await settle(form);
  const field = form.getRegion('detail').currentView;
  expect(field.getValue()).toBe('DETAIL');
  const input = field.el.querySelector('input');
  form.render(); await settle(form);
  expect(form.getRegion('detail').currentView).toBe(field);
  expect(field.el.querySelector('input')).toBe(input);
  expect('showField' in form).toBe(false);
});

it('clears an initially hidden seeded path in actual FormKit values and submitted snapshots', async() => {
  const submitted = [];
  const form = mount([leaf('detail', { when: enabled })], {
    values: { enabled: false, detail: 'Seed' }, submit: values => submitted.push(values),
  });
  await settle(form);
  expect(form.getRegion('detail').hasView()).toBe(false);
  expect(form.node.value).toEqual({ enabled: false });
  expect(await form.submit()).toBe('success');
  expect(submitted).toEqual([{ enabled: false }]);
});

it('propagates initial nested removal without root input while retaining a new pending sibling edit', async() => {
  let sibling;
  let disturbed = false;
  const premature = [];
  const plugin = node => {
    if (node.name === 'details') {
      node.hook.commit((value, next) => {
        if (sibling && !disturbed && !Object.hasOwn(value, 'detail')) {
          disturbed = true;
          void sibling.node.input('Later sibling', true);
        }
        return next(value);
      });
    }
  };
  const form = mount([leaf('detail', { path: ['details', 'detail'], when: enabled })], {
    values: { enabled: false, details: { detail: 'Seed', sibling: 'Old sibling' } }, plugins: [plugin],
  });
  const group = ordinary(form, 'group', 'details', { type: 'group' }, undefined, 'clear');
  sibling = ordinary(form, 'ordinary', 'sibling', { config: { delay: 15 } }, group.node);
  const rootInputs = [];
  form.node.hook.input((value, next) => { rootInputs.push(value); return next(value); });
  form.node.on('settled', ({ payload }) => { if (payload && !sibling.node.isSettled) { premature.push(form.getValues()); } });
  await settle(form);
  expect(disturbed).toBe(true);
  expect(rootInputs).toEqual([]);
  expect(premature).toEqual([]);
  expect(group.node.isSettled).toBe(true);
  expect(group.getValue()).toEqual({ sibling: 'Later sibling' });
  expect(form.node.value).toEqual({ enabled: false, details: { sibling: 'Later sibling' } });
  form.setValues({ enabled: true }, { notify: false }); await settle(form);
  expect(form.getRegion('detail').currentView.getValue()).toBe('Seed');
  form.resetForm(); await settle(form);
  expect(form.getValues()).toEqual({ enabled: false, details: { sibling: 'Old sibling' } });
});

it('limits staged clear values to their activating operation and restores the reset baseline', async() => {
  const form = mount([leaf('detail', { when: enabled })], { values: { enabled: true, detail: 'Baseline' } });
  await settle(form);
  form.setValues({ enabled: false, detail: 'Discard during clearing' }, { notify: false }); await settle(form);
  form.setValues({ detail: 'Discard while hidden' }, { notify: false }); await settle(form);
  expect(form.getValues()).toEqual({ enabled: false });
  form.setValues({ enabled: true, detail: 'Current activating draft' }, { notify: false }); await settle(form);
  expect(form.getRegion('detail').currentView.getValue()).toBe('Current activating draft');
  form.setValues({ enabled: false }, { notify: false }); await settle(form);
  form.setValues({ enabled: true }, { notify: false }); await settle(form);
  expect(form.getValues()).toEqual({ enabled: true, detail: 'Baseline' });
  form.setValues({ enabled: false }, { notify: false }); await settle(form);
  form.setValues({ detail: 'Discard on reset' }, { notify: false }); await settle(form);
  form.resetForm(); await settle(form);
  expect(form.getValues()).toEqual({ enabled: true, detail: 'Baseline' });
});

it('clears an active nested field while preserving a delayed sibling draft through both ancestors', async() => {
  const form = mount([leaf('detail', { path: ['outer', 'inner', 'detail'], when: enabled })], {
    values: { enabled: true, outer: { inner: { detail: 'Mounted', sibling: 'Original' } } },
  });
  const outer = ordinary(form, 'group', 'outer', { type: 'group' }, undefined, 'clear');
  const inner = ordinary(form, 'ordinary', 'inner', { type: 'group' }, outer.node, 'clear');
  const sibling = ordinary(form, 'control', 'sibling', { config: { delay: 30 } }, inner.node);
  await settle(form);
  const detail = form.getRegion('detail').currentView;
  const input = edit(sibling, 'Pending draft');
  form.setValues({ enabled: false }, { notify: false });
  expect(sibling.node.isSettled).toBe(false);
  await settle(form);
  expect(detail.isDestroyed()).toBe(true);
  expect(sibling.getValue()).toBe('Pending draft');
  expect(input.value).toBe('Pending draft');
  expect(inner.getValue()).toEqual({ sibling: 'Pending draft' });
  expect(outer.getValue()).toEqual({ inner: { sibling: 'Pending draft' } });
  expect(form.getValues()).toEqual({ enabled: false, outer: { inner: { sibling: 'Pending draft' } } });
});

it.each([['a', 'b', 'c'], ['c', 'b', 'a']])('settles a three-stage DAG in declaration order %s %s %s', async(a, b, c) => {
  const definitions = {
    a: leaf('a', { when: enabled }),
    b: leaf('b', { when: { dependencies: { upstream: ['a'] }, test: values => values.upstream === 'A' } }),
    c: leaf('c', { when: { dependencies: { upstream: ['b'] }, test: values => values.upstream === 'B' } }),
  };
  const form = mount([a, b, c].map(key => definitions[key]), { values: { enabled: true } });
  await settle(form);
  expect(form.getValues()).toEqual({ enabled: true, a: 'A', b: 'B', c: 'C' });
  form.setValues({ enabled: false }, { notify: false }); await settle(form);
  expect(form.getValues()).toEqual({ enabled: false });
  for (const key of [a, b, c]) { expect(form.getRegion(key).hasView()).toBe(false); }
});

it('reads committed normalization and preserves the dependent draft, native control, focus and selection', async() => {
  const normalize = node => {
    if (node.name === 'code') { node.hook.commit((value, next) => next(String(value).trim().toUpperCase())); }
  };
  const form = mount([leaf('detail', { when: { dependencies: { code: ['code'] }, test: values => values.code === 'SHOW' } })], {
    values: { code: 'SHOW', detail: 'Committed draft' }, plugins: [normalize],
  });
  const code = ordinary(form, 'control', 'code');
  await settle(form);
  const field = form.getRegion('detail').currentView;
  const input = field.el.querySelector('input');
  input.focus(); input.setSelectionRange(2, 6);
  code.setValue(' show ', { notify: false }); await settle(form);
  expect(code.getValue()).toBe('SHOW');
  expect(form.getRegion('detail').currentView).toBe(field);
  expect(field.el.querySelector('input')).toBe(input);
  expect(document.activeElement).toBe(input);
  expect([input.selectionStart, input.selectionEnd]).toEqual([2, 6]);
  expect(form.getValues().detail).toBe('Committed draft');
});

it('reconciles silent root, group and leaf projections from committed nested values without consumer change callbacks', async() => {
  const condition = { dependencies: { group: ['details'] }, test: values => values.group?.enabled === true };
  const form = mount([leaf('detail', { when: condition })], { values: { details: { enabled: false } } });
  const group = ordinary(form, 'group', 'details', { type: 'group' });
  const controller = ordinary(form, 'control', 'enabled', { type: 'checkbox' }, group.node);
  await settle(form);
  const rootChanges = vi.fn(); const groupChanges = vi.fn(); const leafChanges = vi.fn();
  form.on('form:change', rootChanges); group.on('field:change', groupChanges); controller.on('field:change', leafChanges);
  for (const write of [
    () => form.setValues({ details: { enabled: true } }, { notify: false }),
    () => group.setValue({ enabled: false }, { notify: false }),
    () => controller.setValue(true, { notify: false }),
  ]) { write(); await settle(form); }
  expect(form.getValues()).toEqual({ details: { enabled: true }, detail: 'DETAIL' });
  expect(form.getRegion('detail').hasView()).toBe(true);
  expect(rootChanges).not.toHaveBeenCalled();
  expect(groupChanges).not.toHaveBeenCalled();
  expect(leafChanges).not.toHaveBeenCalled();
});

it('projects a declared optional nested dependency as absent before it exists', async() => {
  const snapshots = [];
  const form = mount([leaf('detail', { retention: 'preserve', when: {
    dependencies: { optional: ['flags', 'feature'] },
    test: values => { snapshots.push(values.optional); return values.optional === true; },
  } })]);
  await settle(form);
  expect(snapshots.length).toBeGreaterThan(0);
  expect(snapshots.every(value => value === undefined)).toBe(true);
  expect(form.getRegion('detail').hasView()).toBe(false);
  form.setValues({ flags: { feature: true } }, { notify: false }); await settle(form);
  expect(form.getRegion('detail').hasView()).toBe(true);
  expect(form.getValues()).toEqual({ flags: { feature: true }, detail: 'DETAIL' });
});

it('retains the user source for topology changes caused by a delayed native controller edit', async() => {
  const form = mount([leaf('detail', { when: enabled })], { values: { enabled: false } });
  const controller = ordinary(form, 'control', 'enabled', { type: 'checkbox', config: { delay: 10 } });
  await settle(form);
  const changes = [];
  form.on('form:change', (values, _state, metadata) => changes.push({ values, source: metadata.source }));
  edit(controller, true); await settle(form);
  expect(form.getValues()).toEqual({ enabled: true, detail: 'DETAIL' });
  expect(changes.at(-1)).toEqual({ values: { enabled: true, detail: 'DETAIL' }, source: 'user' });
});

it('preserves nested hidden drafts in a new field and resets them to the owner baseline', async() => {
  const form = mount([leaf('detail', { path: ['details', 'detail'], retention: 'preserve', when: enabled })], {
    values: { enabled: true, details: { detail: 'Baseline' } },
  });
  ordinary(form, 'group', 'details', { type: 'group' });
  await settle(form);
  const original = form.getRegion('detail').currentView;
  original.setValue('Edited draft', { notify: false });
  form.setValues({ enabled: false }, { notify: false }); await settle(form);
  expect(original.isDestroyed()).toBe(true);
  expect(form.getValues().details.detail).toBe('Edited draft');
  form.setValues({ enabled: true }, { notify: false }); await settle(form);
  const replacement = form.getRegion('detail').currentView;
  expect(replacement).not.toBe(original);
  expect(replacement.el.querySelector('input').value).toBe('Edited draft');
  form.resetForm(); await settle(form);
  expect(replacement.getValue()).toBe('Baseline');
});

it('settles a native three-stage activation during remote validation before submitting', async() => {
  let accept; let entered;
  const ruleEntered = new Promise(resolve => { entered = resolve; });
  const remoteResult = new Promise(resolve => { accept = resolve; });
  const submitted = [];
  const form = mount([
    leaf('c', { input: { type: 'text', value: '', validation: 'required' }, when: {
      dependencies: { upstream: ['b'] }, test: values => values.upstream === 'B',
    } }),
    leaf('b', { when: { dependencies: { upstream: ['a'] }, test: values => values.upstream === 'A' } }),
    leaf('a', { when: enabled }),
  ], { values: { enabled: false, gate: 'Valid' }, formProps: { submitBehavior: 'live' },
    validationRules: { remote: () => { entered(); return remoteResult; } }, submit: values => submitted.push(values),
  });
  const control = ordinary(form, 'control', 'enabled', { type: 'checkbox', config: { delay: 10 } });
  ordinary(form, 'gate', 'gate', { validation: 'remote' });
  await settle(form);
  const pending = form.submit(); await ruleEntered; await drain();
  expect(submitted).toEqual([]);
  edit(control, true);
  expect(control.node.isSettled).toBe(false);
  accept(true);
  expect(await pending).toBe('invalid');
  await settle(form);
  expect(submitted).toEqual([]);
  expect(form.getRegion('c').hasView()).toBe(true);
  expect(form.getValues()).toEqual({ enabled: true, gate: 'Valid', a: 'A', b: 'B', c: '' });
});

it('dispatches native submit and FormKit submission hooks once after activation', async() => {
  let raw = 0; let hooks = 0;
  const submit = vi.fn();
  const form = mount([leaf('detail', { when: enabled })], {
    values: { enabled: false }, formProps: { onSubmitRaw: () => { raw++; } }, submit,
  });
  form.node.hook.submit((value, next) => { hooks++; return next(value); });
  await settle(form);
  form.setValues({ enabled: true, detail: 'Latest' }, { notify: false });
  const event = new Event('submit', { cancelable: true });
  form.el.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  await vi.waitFor(() => expect(submit).toHaveBeenCalledTimes(1));
  expect(submit.mock.calls[0][0]).toEqual({ enabled: true, detail: 'Latest' });
  expect(raw).toBe(1);
  expect(hooks).toBe(1);
});

it('owns submission cancellation while composition awaits a pending native edit', async() => {
  const submitted = [];
  const form = mount([leaf('detail', { when: enabled })], {
    values: { enabled: false, note: 'Initial' }, submit: values => submitted.push(values),
  });
  const note = ordinary(form, 'ordinary', 'note', { config: { delay: 60 } });
  await settle(form);
  edit(note, 'Pending edit');
  expect(note.node.isSettled).toBe(false);
  const pending = form.submit();
  await drain();
  expect(submitted).toEqual([]);
  form.resetForm();
  expect(await pending).toBe('cancelled');
  await pause(75); await settle(form);
  expect(submitted).toEqual([]);
  expect(form.getValues()).toEqual({ enabled: false, note: 'Initial' });
});

it('cancels a pending request on reset and ignores its late result', async() => {
  let finish; let signal;
  const form = mount([leaf('detail')], { submit: (_values, context) => {
    signal = context.signal; return new Promise(resolve => { finish = resolve; });
  } });
  await settle(form);
  const success = vi.fn(); form.on('submit:success', success);
  const pending = form.submit();
  await vi.waitFor(() => expect(signal).toBeDefined());
  form.resetForm();
  expect(await pending).toBe('cancelled');
  expect(signal.aborted).toBe(true);
  finish('late'); await drain();
  expect(success).not.toHaveBeenCalled();
  expect(form.getFormState().submitting).toBe(false);
});

it('cancels delayed native input on terminal destruction without a late submit', async() => {
  const submit = vi.fn();
  const form = mount([leaf('detail', { when: enabled })], { values: { enabled: false }, submit });
  const control = ordinary(form, 'control', 'enabled', { type: 'checkbox', config: { delay: 30 } });
  await settle(form);
  edit(control, true);
  expect(control.node.isSettled).toBe(false);
  const pending = form.submit(); await drain(); form.destroy();
  expect(await pending).toBe('cancelled');
  expect(await form.submit()).toBe('cancelled');
  await pause(40);
  expect(submit).not.toHaveBeenCalled();
  expect(form.el.querySelector('[name="detail"]')).toBeNull();
});

it('cancels composition when queued navigation destroys its owner between DAG placements', async() => {
  const submit = vi.fn();
  const form = construct([
    leaf('a'), leaf('b', { when: { dependencies: { upstream: ['a'] }, test: values => values.upstream === 'A' } }),
  ], { submit });
  const placements = [];
  form.on('render', () => {
    form.getRegion('a').on('show', () => {
      placements.push('a');
      queueMicrotask(() => form.destroy());
    });
    form.getRegion('b').on('show', () => placements.push('b'));
  });
  expect(await form.submit()).toBe('cancelled');
  expect(placements).toEqual(['a']);
  expect(form.isDestroyed()).toBe(true);
  expect(getNode(form.node.props.id)).toBeUndefined();
  expect(submit).not.toHaveBeenCalled();
});

it('cancels after remote validation accepts while composition is awaiting a delayed native activation', async() => {
  let accept; let enter;
  const entered = new Promise(resolve => { enter = resolve; });
  const remote = new Promise(resolve => { accept = resolve; });
  const submit = vi.fn();
  const form = mount([leaf('detail', { when: enabled })], {
    values: { enabled: false, gate: 'Ready' }, formProps: { submitBehavior: 'live' },
    validationRules: { remote: () => { enter(); return remote; } }, submit,
  });
  const control = ordinary(form, 'control', 'enabled', { type: 'checkbox', config: { delay: 40 } });
  ordinary(form, 'gate', 'gate', { validation: 'remote' });
  await settle(form);
  const pending = form.submit(); await entered; await drain();
  edit(control, true); accept(true); await pause(5);
  expect(form.getFormState().submitting).toBe(true);
  expect(control.node.isSettled).toBe(false);
  form.resetForm();
  expect(await pending).toBe('cancelled');
  await pause(45); await settle(form);
  expect(submit).not.toHaveBeenCalled();
  expect(form.getValues()).toEqual({ enabled: false, gate: 'Ready' });
  expect(form.getRegion('detail').hasView()).toBe(false);
});

it('releases manifest and ordinary nodes and makes retained native DOM inert across repeated owners', async() => {
  for (let cycle = 0; cycle < 3; cycle++) {
    const form = mount([leaf('detail', { when: enabled })], { values: { enabled: true } });
    const extra = ordinary(form, 'ordinary', 'extra', { value: 'Ordinary' });
    await settle(form);
    const detail = form.getRegion('detail').currentView;
    const input = detail.el.querySelector('input');
    const ids = [form.node.props.id, detail.node.props.id, extra.node.props.id];
    const changes = vi.fn(); form.on('form:change', changes);
    form.destroy(); form.destroy();
    for (const id of ids) { expect(getNode(id)).toBeUndefined(); }
    expect(detail.isDestroyed()).toBe(true);
    expect(extra.isDestroyed()).toBe(true);
    input.value = 'Late'; input.dispatchEvent(new Event('input', { bubbles: true }));
    form.setValues({ enabled: true }); await settle(form);
    expect(changes).not.toHaveBeenCalled();
  }
});

it.each([
  { fields: [] }, { schema: [] }, { template: undefined },
])('requires an ordinary template with no competing field or schema owner: %j', options => {
  expect(() => construct([], options)).toThrow(/requires an ordinary template/);
});

it.each([
  { definitions: [leaf('a'), leaf('a', { path: ['b'], region: 'b' })] },
  { definitions: [leaf('a'), leaf('b', { path: ['a'] })] },
  { definitions: [leaf('a'), leaf('b', { region: 'a' })] },
  { definitions: [leaf('a', { key: '' })] },
])('rejects ambiguous definitions before mounting: %j', ({ definitions }) => {
  const form = construct(definitions);
  expect(() => form.render()).toThrow(/must be unique/);
  expect(form.node.children).toHaveLength(0);
});

it.each([[], [''], ['details.email'], ['rows', '0'], ['__proto__'], ['constructor'], ['prototype']].map(path => ({ path })))(
  'rejects unsupported or unsafe explicit paths: %j', ({ path }) => {
    const form = construct([leaf('detail', { path })]);
    expect(() => form.render()).toThrow(/explicit nonempty group-name segments/);
    expect(form.node.children).toHaveLength(0);
  },
);

it('validates dependency paths and rejects self-dependency and cycles before mounting', () => {
  const invalid = construct([leaf('a', { when: { dependencies: { source: [''] }, test: () => true } })]);
  expect(() => invalid.render()).toThrow(/explicit nonempty/);
  const self = construct([leaf('a', { when: { dependencies: { same: ['a'] }, test: values => !!values.same } })]);
  expect(() => self.render()).toThrow(/Self-dependent/);
  const cycle = construct([['a', 'b'], ['b', 'c'], ['c', 'a']].map(([key, dependency]) => leaf(key, {
    when: { dependencies: { upstream: [dependency] }, test: values => !!values.upstream },
  })));
  expect(() => cycle.render()).toThrow(/Cyclic/);
  expect(cycle.node.children).toHaveLength(0);
});

it.each([
  { dependencies: { declared: ['enabled'] }, test: values => values.undeclared === true },
  { dependencies: {}, test: () => 'truthy' },
])('reports predicate contract diagnostics through settlement and composition:error: %j', when => {
  const form = construct([leaf('detail', { when })]);
  const errors = []; form.on('composition:error', error => errors.push(error));
  return settle(form).then(() => { throw new Error('Expected a composition diagnostic.'); }, error => {
    expect(error.message).toMatch(/Undeclared composition dependency|must return Boolean/);
    expect(errors).toEqual([error]);
    expect(form.getRegion('detail').hasView()).toBe(false);
  });
});

it('rejects a missing placement Region before mounting', () => {
  const form = construct([leaf('detail')], { regions: {} });
  expect(() => form.render()).toThrow(/empty live owned Region/);
  expect(form.node.children).toHaveLength(0);
});

it.each(['occupied', 'destroyed'])('requires an initially empty live placement Region: %s', state => {
  const form = construct([leaf('detail')]);
  form.on('render', () => {
    if (state === 'occupied') { form.showChildView('detail', new View({ template: () => 'Existing' })); } else { form.getRegion('detail').destroy(); }
  });
  expect(() => form.render()).toThrow(/empty live owned Region/);
  expect(form.node.children).toHaveLength(0);
});

it.each([false, true])('reports an external placement replacement when initial activation is %s', async initial => {
  const form = mount([leaf('detail', { when: enabled })], { values: { enabled: initial } });
  await settle(form);
  const replacement = new View({ template: () => 'Replacement' });
  form.showChildView('detail', replacement);
  form.setValues({ enabled: true }, { notify: false });
  await expect(settle(form)).rejects.toThrow(/placement was changed externally/);
  expect(replacement.isDestroyed()).toBe(false);
});

it('rejects a destroyed dedicated Region after installation', async() => {
  const form = mount([leaf('detail', { when: enabled })], { values: { enabled: false } });
  await settle(form);
  form.getRegion('detail').destroy();
  await expect(settle(form)).rejects.toThrow(/placement was changed externally/);
});

it('requires a live group parent and explicitly defers clear under a preserved group', async() => {
  const absent = mount([leaf('detail', { path: ['missing', 'detail'] })]);
  await expect(settle(absent)).rejects.toThrow(/live owned group parent/);
  const preserved = mount([leaf('detail', { path: ['details', 'detail'] })], { values: { details: {} } });
  ordinary(preserved, 'group', 'details', { type: 'group' });
  await expect(settle(preserved)).rejects.toThrow(/beneath a preserved group is deferred/);
});

it('rejects list parents rather than accepting dynamic list placement', async() => {
  const form = mount([leaf('detail', { path: ['rows', 'detail'] })]);
  ordinary(form, 'group', 'rows', { type: 'list' }, undefined, 'clear');
  await expect(settle(form)).rejects.toThrow(/live owned group parent/);
  expect(form.getRegion('detail').hasView()).toBe(false);
});

it('does not clear an ordinary node occupying an initially hidden manifest path', async() => {
  const form = mount([leaf('detail', { when: enabled })], { values: { enabled: false } });
  const field = ordinary(form, 'ordinary', 'detail', { value: 'Ordinary value' });
  await expect(settle(form)).rejects.toThrow(/while its node is mounted/);
  expect(field.isDestroyed()).toBe(false);
  expect(field.getValue()).toBe('Ordinary value');
});

it('requires a live group parent for initially hidden nested clear paths', async() => {
  const form = mount([leaf('detail', { path: ['missing', 'detail'], when: enabled })], { values: { enabled: false } });
  await expect(settle(form)).rejects.toThrow(/Absent field removal requires a live group parent/);
  expect(form.getRegion('detail').hasView()).toBe(false);
});

it('lets JavaScript subclasses own ordinary helper names without changing composition lifetimes', async() => {
  class ContactForm extends CompositionForm {
    manifest = ['Contact'];
    entries = ['Customer'];
    queued = true;
    reconcile() {
      this.el.querySelector('[data-summary]').textContent = `${this.manifest[0]}: ${this.entries[0]} (${this.queued ? 'draft' : 'ready'})`;
    }
    onFormChange() { if (this.isRendered()) { this.reconcile(); } }
  }
  const saved = [];
  const form = new ContactForm({
    template: () => '<p data-summary></p><div class="control"></div><div class="detail"></div>',
    regions: { control: '.control', detail: '.detail' }, values: { enabled: false },
    composition: [leaf('detail', { input: { type: 'text', label: 'Detail', value: '', validation: 'required' }, when: enabled })],
    submit: values => saved.push(values),
  });
  owners.push(form);
  const owner = new Region({ el: document.body.appendChild(document.createElement('div')) });
  owners.push(owner); owner.show(form);
  const controller = ordinary(form, 'control', 'enabled', { type: 'checkbox' });
  await settle(form);
  form.reconcile();
  expect(form.el.querySelector('[data-summary]').textContent).toBe('Contact: Customer (draft)');
  expect(form.getRegion('detail').hasView()).toBe(false);
  edit(controller, true); await settle(form);
  expect(await form.submit()).toBe('invalid');
  const detail = form.getRegion('detail').currentView;
  const input = edit(detail, 'Acme'); await settle(form);
  expect(await form.submit()).toBe('success');
  expect(saved).toEqual([{ enabled: true, detail: 'Acme' }]);
  expect(form.el.querySelector('[data-summary]').textContent).toBe('Contact: Customer (draft)');
  form.resetForm(); await settle(form);
  expect(form.getValues()).toEqual({ enabled: false });
  expect(getNode(input.id)).toBeUndefined();
  const controllerId = controller.node.props.id;
  owner.destroy(); await drain();
  expect(getNode(controllerId)).toBeUndefined();
  expect(controller.isDestroyed()).toBe(true);
  expect(await form.submit()).toBe('cancelled');
});
