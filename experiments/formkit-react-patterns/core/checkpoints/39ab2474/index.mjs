// Experimental slice. React 2.5.0 store/class-cache patterns adapted under MIT;
// see LICENSE.formkit. DOM renderer and Marionette ownership are new code.
import { View, Region } from 'marionette';
import { createNode, createClasses, generateClassList, reset } from '@formkit/core';
import { createLibraryPlugin, inputs } from '@formkit/inputs';
import { createObserver } from '@formkit/observer';
import { createValidationPlugin } from '@formkit/validation';
import * as rules from '@formkit/rules';
import { createI18nPlugin, en } from '@formkit/i18n';

// Deliberately minimal feature context, not React's complete context plugin.
function featureContext(node) {
  node.ledger.count('blocking', message => message.blocking);
  node.ledger.count('errors', message => message.type === 'error');
  node.context = { node, handlers: {}, fns: {}, state: {} };
  node.on('destroyed', () => { node.context = undefined; });
}

export function createStore() {
  let version = 0, pending = false, dead = false;
  const subscribers = new Set();
  return {
    getSnapshot: () => version,
    subscribe(fn) { if (dead) {return () => {};} subscribers.add(fn); return () => subscribers.delete(fn); },
    notify() {
      if (dead) {return;} version++; if (pending) {return;} pending = true;
      queueMicrotask(() => { pending = false; for (const fn of [...subscribers]) { if (dead) {break;} if (subscribers.has(fn)) {fn();} } });
    },
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
    if (dead) {return;} metrics.paints++;
    el.className = section('outer'); label.className = section('label'); input.className = section('input'); messages.className = section('messages');
    label.textContent = node.props.label ?? String(node.name);
    if (input.value !== String(node._value ?? '')) {input.value = String(node._value ?? '');}
    input.disabled = !!node.props.disabled;
    const visible = node.store.reduce((all, m) => { if (m.visible && (m.type === 'validation' || m.type === 'error')) {all.push(m);} return all; }, []);
    messages.replaceChildren(...visible.map(m => { const li = document.createElement('li'); li.id = `${input.id}-${m.key}`; li.textContent = String(m.value); li.className = section('message'); return li; }));
    if (visible.length) { input.setAttribute('aria-describedby', visible.map(m => `${input.id}-${m.key}`).join(' ')); input.setAttribute('aria-invalid', 'true'); } else { input.removeAttribute('aria-describedby'); input.removeAttribute('aria-invalid'); }
  }
  const onInput = () => node.input(input.value);
  input.addEventListener('input', onInput);
  for (const event of ['input', 'commit', 'message-added', 'message-updated', 'message-removed', 'prop:label', 'prop:disabled']) {receipts.push(node.on(event, () => store.notify()));}
  store.subscribe(paint); paint();
  return { el, node, spec, refresh() { for (const observer of observers) {observer.kill();} observers.length = 0; cache.clear(); paint(); }, destroy() { if (dead) {return;} dead = true; store.destroy(); input.removeEventListener('input', onInput); for (const receipt of receipts) {node.off(receipt);} for (const observer of observers) {observer.kill();} node.destroy(); el.remove(); } };
}

export class ExperimentalFormView extends View {
  get tagName() { return 'form'; }
  get template() { return false; }
  initialize(options = {}) {
    this.metrics = { paints: 0, classEvaluations: 0 };
    this._fieldId = 0; this._ending = false;
    this.config = { delay: 0, locale: 'en', ...options.config, classes: options.classes ?? options.config?.classes };
    this.fields = new Map(); this.initialValues = structuredClone(options.values ?? {});
    const terminalSubmission = Symbol('terminal submission');
    const wrapSubmitCallback = (callback, awaitResult = false) => (...args) => {
      if (this._ending || this.isDestroyed()) {throw terminalSubmission;}
      const result = callback?.(...args);
      if (this._ending || this.isDestroyed()) {
        if (awaitResult && result instanceof Promise) {return result.then(() => { throw terminalSubmission; });}
        throw terminalSubmission;
      }
      return result;
    };
    this.node = createNode({ name: 'form', value: this.initialValues, config: this.config,
      props: { ...options.formProps, type: 'form', actions: false, onSubmit: wrapSubmitCallback(options.onSubmit, true), onSubmitInvalid: wrapSubmitCallback(options.onSubmitInvalid), onSubmitRaw: wrapSubmitCallback(options.onSubmitRaw) },
      plugins: [createLibraryPlugin(inputs), featureContext, createValidationPlugin(rules), createI18nPlugin({ en })] });
    this.formMessages = document.createElement('ul'); this.formMessages.className = 'formkit-messages';
    this._formStore = createStore(); this._formStore.subscribe(() => {
      this.formMessages.replaceChildren(...this.node.store.reduce((all, message) => {
        if (message.visible && (message.type === 'error' || message.meta.showAsMessage)) { const li = document.createElement('li'); li.textContent = String(message.value); all.push(li); } return all;
      }, []));
    });
    this._formReceipts = ['message-added', 'message-updated', 'message-removed'].map(event => this.node.on(event, () => this._formStore.notify()));
    this._onSubmit = event => { this.lastSubmission = this.node.context.handlers.submit(event).catch(error => { if (error !== terminalSubmission) {throw error;} }); };
    this.el.addEventListener('submit', this._onSubmit);
    this.specs = options.fields ?? Array.from({ length: options.count ?? 1 }, (_, i) => ({ name: `field${i}`, label: `Field ${i}`, validation: 'required' }));
    this.on('before:destroy', () => { this._ending = true; this._formStore.destroy(); for (const receipt of this._formReceipts) {this.node.off(receipt);} this.el.removeEventListener('submit', this._onSubmit); for (const field of this.fields.values()) {field.destroy();} this.fields.clear(); this.node.destroy(); });
  }
  render() {
    if (this.isDestroyed()) {return this;}
    this.triggerMethod('before:render', this);
    if (this._ending || this.isDestroyed()) {return this;}
    this.setFields(this.specs); for (const field of this.fields.values()) {field.refresh();}
    this._isRendered = true; this.triggerMethod('render', this); return this;
  }
  setFields(specs) {
    if (this._ending || this.isDestroyed()) {return;}
    const names = new Set();
    for (const spec of specs) { if (spec.type && spec.type !== 'text') {throw new TypeError('Experiment supports text fields only');} if (!spec.name || names.has(spec.name)) {throw new TypeError('Unique field names required');} names.add(spec.name); }
    for (const [name, field] of this.fields) {if (!names.has(name)) { field.destroy(); this.fields.delete(name); }}
    for (const spec of specs) {
      let field = this.fields.get(spec.name);
      if (!field) {
        const node = createNode({ parent: this.node, name: spec.name, type: 'input', value: this.initialValues[spec.name] ?? '', props: { type: 'text', id: `experiment-${this.cid}-${++this._fieldId}`, label: spec.label, validation: spec.validation ?? 'required', validationVisibility: 'live', disabled: spec.disabled } });
        field = createField(node, spec, this.config, this.metrics); this.fields.set(spec.name, field);
      } else { field.node.props.label = spec.label; field.node.props.disabled = spec.disabled; field.node.props.validation = spec.validation ?? 'required'; }
      this.el.append(field.el);
    }
    this.el.append(this.formMessages);
    this.specs = specs;
  }
  resetForm() { if (!this._ending && !this.isDestroyed()) {reset(this.node);} }
  submit() {
    if (this._ending || this.isDestroyed()) {return Promise.resolve();}
    this.el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return this.lastSubmission;
  }
}

export function mount({ host, count = 1, fields, values = {}, classes, config, onSubmit, onSubmitInvalid, onSubmitRaw, formProps } = {}) {
  const region = new Region({ el: host });
  const form = new ExperimentalFormView({ count, fields, values, classes, config, onSubmit, onSubmitInvalid, onSubmitRaw, formProps }); region.show(form);
  return { form, node: form.node, metrics: form.metrics, setFields: specs => form.setFields(specs), reset: () => form.resetForm(), submit: () => form.submit(), destroy: () => region.destroy() };
}
