import { afterEach, describe, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FormView, createSchemaRenderer } from '@mnjs/formkit';
import { getNode, createMessage, createNode } from '@formkit/core';
import { createLocalStoragePlugin, createMaxLengthCountdownPlugin, createFloatingLabelsPlugin } from '@formkit/addons';

const regions = [];
function mount(options) {
  const region = new Region({ el: document.body.appendChild(document.createElement('div')) });
  const form = new FormView(options);
  regions.push(region);
  region.show(form);
  return form;
}
async function flush() { for (let index = 0; index < 8; index++) { await Promise.resolve(); } }
afterEach(() => { regions.splice(0).forEach(region => region.destroy()); vi.useRealTimers(); document.body.replaceChildren(); });

describe('@mnjs/formkit independent review regressions', () => {
  it('reports the user origin of edits through official native inputs', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name' }] });
    await flush();
    const changes = vi.fn();
    form.on('form:change', changes);
    const input = form.el.querySelector('input');
    input.value = 'User edit';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await getNode(input.id).settled;
    await flush();
    expect(changes.mock.calls.at(-1)[0]).toEqual({ name: 'User edit' });
    expect(changes.mock.calls.at(-1)[2].source).toBe('user');
  });

  it('announces replacing a same-name file with a different file object', async() => {
    const form = mount({ schema: [{ $formkit: 'file', name: 'attachment' }] });
    await flush();
    const changes = vi.fn();
    form.on('form:change', changes);
    const first = new File(['first'], 'report.txt');
    const second = new File(['second'], 'report.txt');
    form.setValues({ attachment: [{ name: first.name, file: first }] });
    await flush();
    form.setValues({ attachment: [{ name: second.name, file: second }] });
    await flush();
    expect(form.getValues().attachment[0].file).toBe(second);
    expect(changes).toHaveBeenCalledTimes(2);
    expect(changes.mock.calls[1][0].attachment[0].file).toBe(second);
  });

  it('preserves the official class reset directive in schema props', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', outerClass: '$reset custom-outer' }] });
    await flush();
    const outer = form.el.querySelector('.custom-outer');
    expect(outer).not.toBeNull();
    expect(outer.classList.contains('formkit-outer')).toBe(false);
  });

  it('can read nested immutable snapshots assigned to public context', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name' }] });
    await flush();
    const node = getNode(form.el.querySelector('input').id);
    node.context.extra = Object.freeze({ nested: Object.freeze({ value: 'Safe' }) });
    expect(node.context.extra.nested.value).toBe('Safe');
  });

  it('shows dirty validation after a deferred rule finishes', async() => {
    const validations = new Map();
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'before',
      validation: 'remote', validationVisibility: 'dirty' }],
    validationRules: { remote: node => new Promise(resolve => { validations.set(node.value, resolve); }) } });
    const input = form.el.querySelector('input');
    const node = getNode(input.id);
    await vi.waitFor(() => expect(validations.has('before')).toBe(true));
    validations.get('before')(true);
    await node.ledger.settled('validating');
    await flush();
    expect(node.context.state.dirty).toBe(false);
    input.value = 'after';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await vi.waitFor(() => expect(validations.has('after')).toBe(true));
    expect(node.ledger.value('validating')).toBeGreaterThan(0);
    validations.get('after')(false);
    await node.ledger.settled('validating');
    await flush();
    expect(node.context.state.dirty).toBe(true);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('applies framework-neutral submission hooks to the submitted snapshot', async() => {
    const submit = vi.fn();
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'before' }],
      plugins: [node => {
        if (node.props.isForm) {
          node.hook.submit((values, next) => next({ ...values, name: 'normalized' }));
        }
      }], submit });
    await flush();
    expect(await form.submit()).toBe('success');
    expect(submit.mock.calls[0][0]).toEqual({ name: 'normalized' });
    expect(form.getValues()).toEqual({ name: 'before' });
  });
});

describe('@mnjs/formkit schema customization regressions', () => {
  it('retains invalid state and focus when input section attributes are customized', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', validation: 'required' }],
      sectionsSchema: { input: { attrs: { 'data-review': 'present' } } } });
    await flush();
    expect(await form.submit()).toBe('invalid');
    const input = form.el.querySelector('input');
    expect(input.dataset.review).toBe('present');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(input);
  });

  it('reconciles edited schema children while retaining the group and stable input', async() => {
    const form = mount({ schema: [{ $formkit: 'group', name: 'group', children: [
      { $formkit: 'text', name: 'first', label: 'First' }
    ] }] });
    await flush();
    const first = form.el.querySelector('input');
    first.focus();
    form.setSchema([{ $formkit: 'group', name: 'group', children: [
      { $formkit: 'text', name: 'first', label: 'Updated' },
      { $formkit: 'text', name: 'second', label: 'Second' }
    ] }]);
    await flush();
    expect(form.el.querySelectorAll('input')).toHaveLength(2);
    expect(form.el.querySelector('input')).toBe(first);
    expect(document.activeElement).toBe(first);
    expect(form.el.textContent).toContain('Updated');
    expect(form.getValues()).toEqual({ group: { first: undefined, second: undefined } });
  });
});

describe('@mnjs/formkit official plugin and context contracts', () => {
  it('supplies numeric indices to array schema iterations', () => {
    const target = document.body.appendChild(document.createElement('div'));
    const renderer = createSchemaRenderer(target, { data: { rows: ['First', 'Second'] },
      schema: [{ $el: 'span', for: ['item', 'index', '$rows'], children: '$index + 1' }] });
    expect([...target.querySelectorAll('span')].map(span => span.textContent)).toEqual(['1', '2']);
    renderer.destroy();
  });

  it('clears the actual localStorage addon cache through the submit hook', async() => {
    const form = mount({ formProps: { useLocalStorage: true }, schema: [{ $formkit: 'text', name: 'name' }],
      plugins: [createLocalStoragePlugin({ prefix: 'formkit-review', debounce: 0, clearOnSubmit: true })] });
    const storageKey = `formkit-review-${form.node.name}`;
    await flush();
    form.setValues({ name: 'Saved draft' });
    await vi.waitFor(() => expect(localStorage.getItem(storageKey)).not.toBeNull());
    expect(JSON.parse(localStorage.getItem(storageKey)).data.name).toBe('Saved draft');
    expect(await form.submit()).toBe('success');
    expect(localStorage.getItem(storageKey)).toBeNull();
    localStorage.removeItem(storageKey);
  });

  it('renders and updates declarative field errors independently of server validation', async() => {
    const form = mount({ schemaData: { rejections: ['Initial rejection'] }, schema: [
      { $formkit: 'text', name: 'name', errors: '$rejections' }
    ] });
    await flush();
    const input = form.el.querySelector('input');
    expect(form.el.textContent).toContain('Initial rejection');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    form.setSchemaData({ rejections: ['Changed rejection'] });
    await flush();
    expect(form.el.textContent).toContain('Changed rejection');
    expect(form.el.textContent).not.toContain('Initial rejection');
    form.setSchemaData({ rejections: [] });
    await flush();
    expect(input.getAttribute('aria-invalid')).toBeNull();
  });

  it('delivers form error props to the root and named descendant stores', async() => {
    const form = mount({ formProps: { errors: ['Global rejection'], inputErrors: { name: ['Name rejection'] } },
      schema: [{ $formkit: 'text', name: 'name' }] });
    await flush();
    expect(form.el.textContent).toContain('Global rejection');
    expect(form.el.textContent).toContain('Name rejection');
    expect(form.getState().errors).toEqual(['Global rejection']);
  });

  it('keeps a focused partial native date deletion until blur commits it', async() => {
    const form = mount({ schema: [{ $formkit: 'date', name: 'date', value: '2026-10-11' }] });
    await flush();
    const input = form.el.querySelector('input');
    input.focus();
    input.value = '';
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }));
    await flush();
    expect(form.getValues().date).toBe('2026-10-11');
    input.dispatchEvent(new FocusEvent('blur'));
    await getNode(input.id).settled;
    await flush();
    expect(form.getValues().date).toBe('');
  });

  it('updates configured classes and preserves DOM identity and selection', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'Paul' }] });
    await flush();
    const input = form.el.querySelector('input');
    const node = getNode(input.id);
    input.focus();
    input.setSelectionRange(1, 3, 'backward');
    node.config.classes = { outer: { reviewClass: true } };
    await flush();
    expect(form.el.querySelector('.reviewClass')).not.toBeNull();
    node.config.rootClasses = section => ({ [`review-${section}`]: true });
    await flush();
    expect(form.el.querySelector('.review-outer')).not.toBeNull();
    expect(form.el.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(1);
    expect(input.selectionDirection).toBe('backward');
  });

  it('compares dirty values with their initial state and resets blur/submission state', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'Paul', dirtyBehavior: 'compare' }] });
    await flush();
    const input = form.el.querySelector('input');
    const node = getNode(input.id);
    form.setValues({ name: 'Ada' });
    await flush();
    expect(node.context.state.dirty).toBe(true);
    form.setValues({ name: 'Paul' });
    await flush();
    expect(node.context.state.dirty).toBe(false);
    input.dispatchEvent(new FocusEvent('blur'));
    expect(node.context.state.blurred).toBe(true);
    expect(await form.submit()).toBe('success');
    expect(node.context.state.submitted).toBe(true);
    form.resetForm();
    await flush();
    expect(node.context.state.dirty).toBe(false);
    expect(node.context.state.blurred).toBe(false);
    expect(node.context.state.submitted).toBe(false);
  });

  it('clears ordinary server errors on editing while retaining explicitly preserved errors', async() => {
    const form = mount({ schema: [
      { $formkit: 'text', name: 'ordinary' },
      { $formkit: 'text', name: 'preserved', preserveErrors: true }
    ] });
    await flush();
    const [ordinary, preserved] = form.el.querySelectorAll('input');
    getNode(ordinary.id).setErrors(['Ordinary error']);
    getNode(preserved.id).setErrors(['Preserved error']);
    form.setValues({ ordinary: 'Updated', preserved: 'Updated' });
    await flush();
    expect(form.el.textContent).not.toContain('Ordinary error');
    expect(form.el.textContent).toContain('Preserved error');
  });

  it('reacts to added/deleted symbol context properties and retains nonplain object identity', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name' }] });
    await flush();
    const node = getNode(form.el.querySelector('input').id);
    const updates = vi.fn();
    const receipt = node.on('context-update', updates);
    const symbol = Symbol('review');
    const date = new Date('2026-10-11');
    node.context.extra = { [symbol]: 'First', date };
    expect(node.context.extra.date).toBe(date);
    const firstCount = updates.mock.calls.length;
    node.context.extra[symbol] = 'Second';
    expect(updates.mock.calls.length).toBeGreaterThan(firstCount);
    delete node.context.extra[symbol];
    expect(symbol in node.context.extra).toBe(false);
    expect(node.context.classes[Symbol.iterator]).toBeUndefined();
    node.off(receipt);
  });

  it('runs the official maxlength countdown plugin after native edits', async() => {
    const form = mount({ plugins: [createMaxLengthCountdownPlugin({ useAsDefault: true })],
      schema: [{ $formkit: 'textarea', name: 'message', label: 'Message', maxlength: 10 }] });
    await flush();
    const textarea = form.el.querySelector('textarea');
    expect(form.el.textContent).toContain('10 remaining characters');
    textarea.value = 'Hello';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await getNode(textarea.id).settled;
    await flush();
    expect(form.el.textContent).toContain('5 remaining characters');
  });

  it('mounts and destroys official floating labels without late node mutation', async() => {
    const form = mount({ plugins: [createFloatingLabelsPlugin({ useAsDefault: true })],
      schema: [{ $formkit: 'text', name: 'name', label: 'Floating label' }] });
    await flush();
    const input = form.el.querySelector('input');
    expect(form.el.querySelector('[data-floating-label=true]')).not.toBeNull();
    expect(form.el.querySelector(`label[for="${input.id}"]`).textContent).toBe('Floating label');
    const node = getNode(input.id);
    const changes = vi.fn();
    node.on('prop', changes);
    form.destroy();
    const count = changes.mock.calls.length;
    await new Promise(resolve => setTimeout(resolve, 120));
    expect(changes.mock.calls.length).toBe(count);
    expect(getNode(input.id)).toBeUndefined();
  });
});

describe('@mnjs/formkit interrupted async workflows', () => {
  it('validates the latest external values when they change during the first pending rule', async() => {
    let finishInitial;
    const validated = [];
    const submit = vi.fn();
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'first', validation: 'remote' }],
      validationRules: { remote: node => {
        const value = node.value;
        validated.push(value);
        if (value === 'first') { return new Promise(resolve => { finishInitial = resolve; }); }
        return Promise.resolve(false);
      } }, submit });
    await vi.waitFor(() => expect(finishInitial).toBeTypeOf('function'));
    const pending = form.submit();
    form.setValues({ name: 'outdated' });
    form.setValues({ name: 'latest' });
    finishInitial(true);
    expect(await pending).toBe('invalid');
    expect(validated).toContain('latest');
    expect(submit).not.toHaveBeenCalled();
    expect(form.getValues().name).toBe('latest');
  });

  it('releases official nodes, ignored controls and retained DOM listeners across repeated mounts', async() => {
    vi.useFakeTimers();
    let active = 0;
    const plugin = node => {
      active++;
      node.on('destroying', () => { active--; });
    };
    for (let index = 0; index < 3; index++) {
      const form = mount({ plugins: [plugin], config: { delay: 50 }, schema: [{ $formkit: 'text', name: 'name', label: 'Name' }] });
      await flush();
      const input = form.el.querySelector('input');
      const node = getNode(input.id);
      const changes = vi.fn();
      form.on('form:change', changes);
      input.value = 'Scheduled update';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      expect(node.isSettled).toBe(false);
      form.destroy();
      expect(active).toBe(0);
      expect(getNode(input.id)).toBeUndefined();
      expect(node.context).toBeNull();
      input.value = 'Late edit';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new FocusEvent('blur'));
      await vi.advanceTimersByTimeAsync(60);
      await flush();
      expect(changes).not.toHaveBeenCalled();
    }
  });

  it('cancels a schema submission on reset and accepts a new submission before old work returns', async() => {
    const completions = [];
    const signals = [];
    const submit = vi.fn((values, context) => {
      signals.push(context.signal);
      return new Promise(resolve => { completions.push(() => resolve(values.name)); });
    });
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'Original' }], submit });
    const success = vi.fn();
    form.on('submit:success', success);
    const first = form.submit();
    await vi.waitFor(() => expect(completions).toHaveLength(1));
    form.resetForm();
    expect(await first).toBe('cancelled');
    expect(signals[0].aborted).toBe(true);
    form.setValues({ name: 'Current' });
    const second = form.submit();
    await vi.waitFor(() => expect(completions).toHaveLength(2));
    completions[1]();
    expect(await second).toBe('success');
    completions[0]();
    await flush();
    expect(success).toHaveBeenCalledTimes(1);
    expect(success.mock.calls[0][0]).toEqual({ name: 'Current' });
    expect(form.getState().submitting).toBe(false);
    expect(form.el.getAttribute('aria-busy')).toBe('false');
  });
});

describe('@mnjs/formkit async validation guard review', () => {
  it('rechecks a same-input edit made before submit while its initial request is pending', async() => {
    let finish;
    const seen = [];
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'first', validation: 'remote' }],
      validationRules: { remote: node => {
        const value = node.value;
        seen.push(value);
        return value === 'first' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(false);
      } } });
    await flush();
    form.setValues({ name: 'current' });
    const pending = form.submit();
    finish(true);
    expect(await pending).toBe('invalid');
    expect(seen).toEqual(['first', 'current']);
  });

  it('rechecks an existing sibling when it changes during an initial cross-field request', async() => {
    let finish;
    const seen = [];
    const form = mount({ values: { name: 'Name', sibling: 'first' }, schema: [
      { $formkit: 'text', name: 'sibling', value: 'first' },
      { $formkit: 'text', name: 'name', value: 'Name', validation: 'remote' }
    ], validationRules: { remote: node => {
      const value = node.at('sibling').value;
      seen.push(value);
      return value === 'first' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(false);
    } } });
    await flush();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    const pending = form.submit();
    form.setValues({ sibling: 'current' });
    finish(true);
    expect(await pending).toBe('invalid');
    expect(seen).toEqual(['first', 'current']);
  });

  it('fails a rejected request, reports the error and allows an edited value to retry', async() => {
    let fail;
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'first', validation: 'remote' }],
      validationRules: { remote: node => node.value === 'first' ? new Promise((resolve, reject) => { fail = reject; }) : Promise.resolve(true) } });
    const node = getNode(form.el.querySelector('input').id);
    const errors = vi.fn();
    node.on('validation-error', errors);
    const pending = form.submit();
    const error = new Error('Validation request failed');
    fail(error);
    expect(await pending).toBe('invalid');
    expect(errors).toHaveBeenCalledTimes(1);
    expect(errors.mock.calls[0][0].payload).toBe(error);
    form.setValues({ name: 'retry' });
    expect(await form.submit()).toBe('success');
  });

  it('ignores a late rejected validation request after destroy', async() => {
    let fail;
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'pending', validation: 'remote' }],
      validationRules: { remote: () => new Promise((resolve, reject) => { fail = reject; }) } });
    const node = getNode(form.el.querySelector('input').id);
    const errors = vi.fn();
    node.on('validation-error', errors);
    const pending = form.submit();
    form.destroy();
    expect(await pending).toBe('cancelled');
    fail(new Error('Late request failed'));
    await flush();
    expect(errors).not.toHaveBeenCalled();
  });

  it('replaces schema-local rule functions under an existing rule name', async() => {
    const reject = vi.fn(() => false);
    const accept = vi.fn(() => true);
    const form = mount({ schemaData: { currentRules: { remote: reject } }, schema: [
      { $formkit: 'text', name: 'name', value: 'Present', validation: 'remote', validationRules: '$currentRules', validationMessages: { remote: 'Old rule rejected' } }
    ] });
    expect(await form.submit()).toBe('invalid');
    form.setSchemaData({ currentRules: { remote: accept } });
    await flush();
    expect(await form.submit()).toBe('success');
    expect(accept).toHaveBeenCalledTimes(1);
    expect(reject).toHaveBeenCalledTimes(1);
    expect(form.getState().valid).toBe(true);
    expect(form.el.textContent).not.toContain('Old rule rejected');
    expect(form.el.querySelector('input').getAttribute('aria-invalid')).toBeNull();
  });

  it('preserves function hints in schema-local named async rules', async() => {
    const remote = Object.assign(() => Promise.resolve(false), { skipEmpty: false, blocking: false, force: true });
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', validation: 'remote', validationRules: { remote } }] });
    const node = getNode(form.el.querySelector('input').id);
    await node.ledger.settled('validating');
    await flush();
    expect(await form.submit()).toBe('success');
    expect(node.context.state.failing).toBe(true);
    expect(node.context.state.valid).toBe(true);
  });

  it('guards async functions passed directly in validation arrays', async() => {
    let finish;
    const seen = [];
    const remote = node => {
      const value = node.value;
      seen.push(value);
      return value === 'first' ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(false);
    };
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'first', validation: [[remote]] }] });
    const pending = form.submit();
    form.setValues({ name: 'current' });
    finish(true);
    expect(await pending).toBe('invalid');
    expect(seen).toContain('current');
  });

  it('does not start duplicate latest requests when an obsolete core run resolves', async() => {
    const requests = [];
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'initial', validation: 'remote' }],
      validationRules: { remote: node => {
        const value = node.value;
        if (value === 'initial') { return Promise.resolve(true); }
        return new Promise(resolve => { requests.push({ value, resolve }); });
      } } });
    const node = getNode(form.el.querySelector('input').id);
    await node.ledger.settled('validating');
    await flush();
    form.setValues({ name: 'outdated' });
    await vi.waitFor(() => expect(requests.some(request => request.value === 'outdated')).toBe(true));
    form.setValues({ name: 'current' });
    await vi.waitFor(() => expect(requests.some(request => request.value === 'current')).toBe(true));
    requests.find(request => request.value === 'outdated').resolve(true);
    await flush();
    const current = requests.filter(request => request.value === 'current');
    current.forEach(request => request.resolve(true));
    await node.ledger.settled('validating');
    expect(current).toHaveLength(1);
  });

  it('does not restart an obsolete async rule after the validation schema changes', async() => {
    let finish;
    const remote = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'first', validation: 'remote' }],
      validationRules: { remote } });
    const node = getNode(form.el.querySelector('input').id);
    node.props.validation = 'required';
    form.setValues({ name: 'current' });
    finish(true);
    await flush();
    expect(remote).toHaveBeenCalledTimes(1);
    expect(await form.submit()).toBe('success');
  });
});

describe('@mnjs/formkit rule identity and opaque values', () => {
  it('keeps direct rule names and hints for custom error messages', async() => {
    function availabilityRule() { return Promise.resolve(false); }
    availabilityRule.skipEmpty = false;
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', label: 'Name',
      validation: [[availabilityRule]], validationMessages: { availabilityRule: 'Name is unavailable' } }] });
    expect(await form.submit()).toBe('invalid');
    expect(form.el.textContent).toContain('Name is unavailable');
  });

  it('rechecks a same-name file replacement while remote validation is pending', async() => {
    let finish;
    const first = new File(['first'], 'same.txt');
    const second = new File(['second'], 'same.txt');
    const seen = [];
    const form = mount({ schema: [{ $formkit: 'file', name: 'file', value: [{ name: first.name, file: first }], validation: 'remote' }],
      validationRules: { remote: node => {
        const file = node.value[0].file;
        seen.push(file);
        return file === first ? new Promise(resolve => { finish = resolve; }) : Promise.resolve(false);
      } } });
    const pending = form.submit();
    form.setValues({ file: [{ name: second.name, file: second }] });
    finish(true);
    expect(await pending).toBe('invalid');
    expect(seen).toEqual([first, second]);
    expect(form.getValues().file[0].file).toBe(second);
  });
});

describe('@mnjs/formkit validation removal', () => {
  it('releases pending validation when its specification is removed and ignores the late result', async() => {
    let finish;
    const remote = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    const submit = vi.fn();
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'Present', validation: 'remote' }],
      validationRules: { remote }, submit });
    const node = getNode(form.el.querySelector('input').id);
    expect(node.ledger.value('validating')).toBeGreaterThan(0);
    node.props.validation = undefined;
    expect(node.ledger.value('validating')).toBe(0);
    expect(await form.submit()).toBe('success');
    finish(false);
    await flush();
    expect(remote).toHaveBeenCalledTimes(1);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(form.getState().valid).toBe(true);
    expect(form.el.querySelector('input').getAttribute('aria-invalid')).toBeNull();
  });
});

describe('@mnjs/formkit obsolete validation rejection', () => {
  it('checks the latest value after the initial request for an older value rejects', async() => {
    let fail;
    const seen = [];
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'first', validation: 'remote' }],
      validationRules: { remote: node => {
        const value = node.value;
        seen.push(value);
        return value === 'first' ? new Promise((resolve, reject) => { fail = reject; }) : Promise.resolve(true);
      } } });
    form.setValues({ name: 'current' });
    const pending = form.submit();
    fail(new Error('Obsolete request failed'));
    expect(await pending).toBe('success');
    expect(seen).toEqual(['first', 'current']);
    expect(form.getState().valid).toBe(true);
  });
});

describe('@mnjs/formkit public binding state boundaries', () => {
  it('normalizes raw numeric strings on blur after numeric behavior is enabled', async() => {
    const onBlur = vi.fn();
    const form = mount({ schema: [{ $formkit: 'hidden', name: 'amount', attrs: { onBlur } }] });
    await flush();
    const input = form.el.querySelector('input');
    const node = getNode(input.id);
    node.props.number = true;
    await node.input('42.5', false);
    input.dispatchEvent(new FocusEvent('blur'));
    await node.settled;
    expect(form.getValues().amount).toBe(42.5);
    expect(onBlur).toHaveBeenCalledTimes(1);
    await node.input('not numeric', false);
    input.dispatchEvent(new FocusEvent('blur'));
    await node.settled;
    expect(form.getValues().amount).toBeUndefined();
    await node.input('', false);
    input.dispatchEvent(new FocusEvent('blur'));
    expect(form.getValues().amount).toBe('');
    node.props.attrs = undefined;
    input.dispatchEvent(new FocusEvent('blur'));
    expect(onBlur).toHaveBeenCalledTimes(3);
  });

  it('supports sealed reactive records without emitting failed changes', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name' }] });
    await flush();
    const node = getNode(form.el.querySelector('input').id);
    node.context.extra = Object.seal({ fixed: 'Before' });
    const updates = vi.fn();
    const receipt = node.on('context-update', updates);
    expect(Reflect.deleteProperty(node.context.extra, 'fixed')).toBe(false);
    expect(Reflect.defineProperty(node.context.extra, 'added', { value: 'Rejected' })).toBe(false);
    expect(updates).not.toHaveBeenCalled();
    expect(Reflect.set(node.context.extra, 'fixed', 'After')).toBe(true);
    expect(node.context.extra.fixed).toBe('After');
    expect(updates).toHaveBeenCalled();
    node.off(receipt);
  });

  it('does not emit updates from a context retained after terminal destruction', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name' }] });
    await flush();
    const node = getNode(form.el.querySelector('input').id);
    const context = node.context;
    const updates = vi.fn();
    node.on('context-update', updates);
    form.destroy();
    const before = updates.mock.calls.length;
    context.state.retained = { value: 'First' };
    context.state.retained.value = 'Later';
    delete context.state.retained.value;
    await flush();
    expect(updates.mock.calls.length).toBe(before);
    expect(node.context).toBeNull();
  });

  it('supports disabling default root classes and producing empty section classes', async() => {
    const form = mount({ config: { rootClasses: false }, schema: [{ $formkit: 'text', name: 'name' }] });
    await flush();
    const input = form.el.querySelector('input');
    const node = getNode(input.id);
    expect(node.context.classes.input).toBe('');
    expect(input.closest('.formkit-outer')).toBeNull();
    node.props.inputClass = 'explicit-input';
    await flush();
    expect(input.classList.contains('explicit-input')).toBe(true);
  });

  it('routes UI messages, visible messages and hidden state without mixing their destinations', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name' }] });
    await flush();
    const node = getNode(form.el.querySelector('input').id);
    node.store.set(createMessage({ key: 'notice', type: 'ui', value: 'A UI notice', meta: { localize: false } }));
    expect(node.context.ui.notice.value).toBe('A UI notice');
    expect(node.context.messages.notice).toBeUndefined();
    node.store.set(createMessage({ key: 'notice', type: 'ui', value: 'A visible notice', meta: { localize: false, showAsMessage: true } }));
    expect(node.context.ui.notice).toBeUndefined();
    expect(node.context.messages.notice.value).toBe('A visible notice');
    node.store.set(createMessage({ key: 'hidden-error', type: 'error', value: 'Hidden', visible: false }));
    expect(node.context.messages['hidden-error']).toBeUndefined();
    node.store.set(createMessage({ key: 'custom-state', type: 'state', value: true, visible: false }));
    expect(node.context.state['custom-state']).toBe(true);
    node.store.remove('custom-state');
    expect(node.context.state['custom-state']).toBeUndefined();
    node.store.remove('notice');
    await flush();
    expect(form.el.textContent).not.toContain('A visible notice');
  });

  it('applies input errors configured by a plugin before the form created event', async() => {
    const form = mount({ plugins: [node => {
      if (node.props.isForm) { node.props.inputErrors = { name: ['Prepared rejection'] }; }
    }], schema: [{ $formkit: 'text', name: 'name' }] });
    await flush();
    expect(form.el.textContent).toContain('Prepared rejection');
    expect(form.el.querySelector('input').getAttribute('aria-invalid')).toBe('true');
  });

  it('binds plugin-created native core children without requiring attributes or slots', async() => {
    let child;
    const form = mount({ plugins: [node => {
      if (node.props.isForm) {
        node.on('created', () => {
          child = createNode({ parent: node, name: 'metadata', value: 'Prepared', props: { type: 'text', id: 'review-metadata' } });
        });
      }
    }], schema: [] });
    await flush();
    expect(child.context.attrs).toEqual({});
    expect(child.context.slots).toEqual({});
    expect(form.getValues()).toMatchObject({ metadata: 'Prepared' });
    form.destroy();
    expect(getNode('review-metadata')).toBeUndefined();
  });
});

describe('@mnjs/formkit public form state boundaries', () => {
  it('handles native reset events in schema forms without replacing focused controls', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', value: 'Initial' }] });
    await flush();
    const input = form.el.querySelector('input');
    form.setValues({ name: 'Changed' });
    await flush();
    input.focus();
    const reset = new Event('reset', { bubbles: true, cancelable: true });
    form.el.dispatchEvent(reset);
    await flush();
    expect(reset.defaultPrevented).toBe(true);
    expect(form.getValues().name).toBe('Initial');
    expect(form.el.querySelector('input')).toBe(input);
    expect(document.activeElement).toBe(input);
  });

  it('announces object option transitions whose keys differ but whose key counts match', async() => {
    const form = mount({ schema: [{ $formkit: 'checkbox', name: 'consent', label: 'Consent',
      onValue: { accepted: true }, offValue: { declined: true } }] });
    await flush();
    const changes = vi.fn();
    form.on('form:change', changes);
    const input = form.el.querySelector('input');
    input.checked = true;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await getNode(input.id).settled;
    await flush();
    expect(form.getValues().consent).toEqual({ accepted: true });
    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('supports named rule tuples independently of direct function tuples', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name', label: 'Name', validation: [['required']] }] });
    expect(await form.submit()).toBe('invalid');
    form.setValues({ name: 'Present' });
    expect(await form.submit()).toBe('success');
  });

  it('ignores errors delivered after destruction', async() => {
    const form = mount({ schema: [{ $formkit: 'text', name: 'name' }] });
    const changes = vi.fn();
    form.on('form:state', changes);
    form.destroy();
    const count = changes.mock.calls.length;
    expect(form.setErrors(['Late error'], { name: ['Late field error'] })).toBeUndefined();
    await flush();
    expect(changes.mock.calls.length).toBe(count);
  });

  it('clears omitted fields in a retained keyed list item and initializes a newly added item', async() => {
    const form = mount({ values: { rows: [{ id: 'first', name: 'Ada', note: 'Remember' }] }, schema: [
      { $formkit: 'list', name: 'rows', dynamic: true, itemKey: 'id', children: [
        { $formkit: 'group', for: ['item', 'index', '$items'], key: '$item', index: '$index', children: [
          { $formkit: 'hidden', name: 'id' },
          { $formkit: 'text', name: 'name', label: 'Name' },
          { $formkit: 'text', name: 'note', label: 'Note' }
        ] }
      ] }
    ] });
    await flush();
    const [name, note] = form.el.querySelectorAll('input[type=text]');
    name.focus();
    form.setValues({ rows: [{ id: 'first', name: 'Ada' }, { id: 'second', name: 'Paul', note: 'New note' }] });
    await flush();
    expect(form.el.querySelector('input[type=text]')).toBe(name);
    expect(document.activeElement).toBe(name);
    expect(form.getValues().rows).toEqual([
      { id: 'first', name: 'Ada', note: undefined },
      { id: 'second', name: 'Paul', note: 'New note' }
    ]);
    expect(note.value).toBe('');
  });
});

describe('@mnjs/formkit mixed select value shapes', () => {
  it('replaces a structured option with a scalar option through a programmatic update', async() => {
    const form = mount({ schema: [{ $formkit: 'select', name: 'choice', label: 'Choice', value: { mode: 'structured' },
      options: [{ label: 'Structured', value: { mode: 'structured' } }, { label: 'Plain', value: 'plain' }] }] });
    await flush();
    const select = form.el.querySelector('select');
    expect(form.getValues().choice).toEqual({ mode: 'structured' });
    form.setValues({ choice: 'plain' });
    await flush();
    expect(form.getValues().choice).toBe('plain');
    expect(select.options[1].selected).toBe(true);
    expect(form.el.querySelector('select')).toBe(select);
  });
});
