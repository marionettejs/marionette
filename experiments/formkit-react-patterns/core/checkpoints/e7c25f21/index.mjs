// Experimental slice. React 2.5.0 store/class-cache patterns adapted under MIT;
// see LICENSE.formkit. DOM renderer and Marionette ownership are new code.
import { View, Region } from 'marionette';
import { createNode, createClasses, generateClassList, reset } from '@formkit/core';
import { createObserver } from '@formkit/observer';
import { createValidationPlugin } from '@formkit/validation';
import * as rules from '@formkit/rules';
import { createI18nPlugin, en } from '@formkit/i18n';

export function createStore() {
  let version = 0, pending = false, dead = false;
  const subscribers = new Set();
  return {
    getSnapshot: () => version,
    subscribe(fn) { if (dead) return () => {}; subscribers.add(fn); return () => subscribers.delete(fn); },
    notify() { if (dead) return; version++; if (pending) return; pending = true;
      queueMicrotask(() => { pending = false; for (const fn of [...subscribers]) { if (dead) break; if (subscribers.has(fn)) fn(); } }); },
    destroy() { dead = true; subscribers.clear(); }
  };
}

function createField(node, spec, config, metrics) {
  const store = createStore(), observers = [], receipts = [], cache = new Map();
  let dead = false;
  const el = document.createElement('div');
  const label = document.createElement('label'), input = document.createElement('input'), messages = document.createElement('ul');
  input.type = 'text'; input.id = String(node.props.id); input.name = String(node.name);
  label.htmlFor = input.id; el.append(label, input, messages);
  function section(name) {
    if (!cache.has(name)) {
      cache.set(name, '');
      const observed = createObserver(node); observers.push(observed);
      observed.watch(n => {
        metrics.classEvaluations++;
        return generateClassList(n, name,
          { [`formkit-${name}`]: true },
          createClasses(name, n, config.classes?.[name]),
          createClasses(name, n, n.props[`${name}Class`])) ?? '';
      }, value => { cache.set(name, value); store.notify(); });
    }
    return cache.get(name);
  }
  function paint() {
    if (dead) return; metrics.paints++;
    el.className = section('outer'); label.className = section('label'); input.className = section('input'); messages.className = section('messages');
    label.textContent = node.props.label ?? String(node.name);
    if (input.value !== String(node._value ?? '')) input.value = String(node._value ?? '');
    input.disabled = !!node.props.disabled;
    const visible = node.store.reduce((all, m) => { if (m.visible && (m.type === 'validation' || m.type === 'error')) all.push(m); return all; }, []);
    messages.replaceChildren(...visible.map(m => { const li = document.createElement('li'); li.id = `${input.id}-${m.key}`; li.textContent = String(m.value); li.className = section('message'); return li; }));
    if (visible.length) { input.setAttribute('aria-describedby', visible.map(m => `${input.id}-${m.key}`).join(' ')); input.setAttribute('aria-invalid', 'true'); }
    else { input.removeAttribute('aria-describedby'); input.removeAttribute('aria-invalid'); }
  }
  const onInput = () => node.input(input.value);
  input.addEventListener('input', onInput);
  for (const event of ['input', 'commit', 'message-added', 'message-updated', 'message-removed', 'prop:label', 'prop:disabled']) receipts.push(node.on(event, () => store.notify()));
  store.subscribe(paint); paint();
  return { el, node, spec, refresh() { for (const observer of observers) observer.kill(); observers.length = 0; cache.clear(); paint(); }, destroy() { if (dead) return; dead = true; store.destroy(); input.removeEventListener('input', onInput); for (const receipt of receipts) node.off(receipt); for (const observer of observers) observer.kill(); node.destroy(); el.remove(); } };
}

export class ExperimentalFormView extends View {
  get tagName() { return 'form'; }
  get template() { return false; }
  initialize(options = {}) {
    this.metrics = { paints: 0, classEvaluations: 0 };
    this._fieldId = 0; this._ending = false;
    this.config = { delay: 0, locale: 'en', ...options.config, classes: options.classes ?? options.config?.classes };
    this.fields = new Map(); this.initialValues = structuredClone(options.values ?? {});
    this.node = createNode({ type: 'group', name: 'form', value: this.initialValues, config: this.config,
      plugins: [createValidationPlugin(rules), createI18nPlugin({ en })] });
    this.specs = options.fields ?? Array.from({ length: options.count ?? 1 }, (_, i) => ({ name: `field${i}`, label: `Field ${i}`, validation: 'required' }));
    this.on('before:destroy', () => { this._ending = true; for (const field of this.fields.values()) field.destroy(); this.fields.clear(); this.node.destroy(); });
  }
  render() {
    if (this.isDestroyed()) return this;
    this.triggerMethod('before:render', this);
    if (this._ending || this.isDestroyed()) return this;
    this.setFields(this.specs); for (const field of this.fields.values()) field.refresh();
    this._isRendered = true; this.triggerMethod('render', this); return this;
  }
  setFields(specs) {
    if (this._ending || this.isDestroyed()) return;
    const names = new Set();
    for (const spec of specs) { if (spec.type && spec.type !== 'text') throw new TypeError('Experiment supports text fields only'); if (!spec.name || names.has(spec.name)) throw new TypeError('Unique field names required'); names.add(spec.name); }
    for (const [name, field] of this.fields) if (!names.has(name)) { field.destroy(); this.fields.delete(name); }
    for (const spec of specs) {
      let field = this.fields.get(spec.name);
      if (!field) {
        const node = createNode({ parent: this.node, name: spec.name, type: 'input', value: this.initialValues[spec.name] ?? '', props: { id: `experiment-${this.cid}-${++this._fieldId}`, label: spec.label, validation: spec.validation ?? 'required', validationVisibility: 'live', disabled: spec.disabled } });
        field = createField(node, spec, this.config, this.metrics); this.fields.set(spec.name, field);
      } else { field.node.props.label = spec.label; field.node.props.disabled = spec.disabled; field.node.props.validation = spec.validation ?? 'required'; }
      this.el.append(field.el);
    }
    this.specs = specs;
  }
  resetForm() { reset(this.node); }
}

export function mount({ host, count = 1, fields, values = {}, classes, config } = {}) {
  const region = new Region({ el: host });
  const form = new ExperimentalFormView({ count, fields, values, classes, config }); region.show(form);
  return { form, node: form.node, metrics: form.metrics, setFields: specs => form.setFields(specs), reset: () => form.resetForm(), destroy: () => region.destroy() };
}
