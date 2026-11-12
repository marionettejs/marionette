// Experimental slice. React 2.5.0 store/class-cache patterns adapted under MIT;
// see LICENSE.formkit. DOM renderer and Marionette ownership are new code.
import { View, Region } from 'marionette';
import { createNode, reset } from '@formkit/core';
import { createLibraryPlugin, inputs } from '@formkit/inputs';
import { bindings } from './upstream-bindings.mjs';
import { renderSections } from './section-renderer.mjs';
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
  const el=document.createElement('div'); el.dataset.experimentField=String(node.name);
  const renderer=renderSections({host:el,schema:node.props.definition.schema({}),context:node.context,metrics});
  let dead=false;
  return {el,node,spec,refresh(){node.context.refreshClasses();renderer.refresh();},destroy(){if(dead)return;dead=true;renderer.destroy();node.destroy();el.remove();}};
}

export class ExperimentalFormView extends View {
  get tagName() { return 'form'; }
  get template() { return false; }
  initialize(options = {}) {
    this.metrics = { contextNotifications:0,tokenChecks:0,expressionEvaluations:0,domWrites:0,structuralChanges:0,coreNodesCreated:0,coreNodesDestroyed:0,coreInputEvents:0,coreCommitEvents:0,coreMessageEvents:0,classRootEvaluations:0 };
    this._fieldId = 0; this._ending = false;
    this.config = { delay: 0, locale: 'en', rootClasses: section => ({[`formkit-${section}`]:true}), ...options.config, classes: options.classes ?? options.config?.classes };
    const rootClasses=this.config.rootClasses;
    this.config.rootClasses=(section,node)=>{this.metrics.classRootEvaluations++;return rootClasses(section,node);};
    const countCore=node=>{this.metrics.coreNodesCreated++;for(const[event,key]of [['input','coreInputEvents'],['commit','coreCommitEvents'],['message-added','coreMessageEvents'],['message-updated','coreMessageEvents'],['message-removed','coreMessageEvents'],['destroyed','coreNodesDestroyed']])node.on(event,()=>this.metrics[key]++);};
    this.fields = new Map(); this.initialValues = structuredClone(options.values ?? {});
    const terminalSubmission = Symbol('terminal submission');
    const wrapSubmitCallback = (callback, awaitResult = false) => (...args) => {
      if (this._ending || this.isDestroyed()) throw terminalSubmission;
      const result = callback?.(...args);
      if (this._ending || this.isDestroyed()) {
        if (awaitResult && result instanceof Promise) return result.then(() => { throw terminalSubmission; });
        throw terminalSubmission;
      }
      return result;
    };
    this.node = createNode({ name: 'form', value: this.initialValues, config: this.config,
      props: { ...options.formProps, type: 'form', attrs: options.formProps?.attrs ?? {}, id: `experiment-form-${this.cid}`, __slots: {default:true}, actions: false, onSubmit: wrapSubmitCallback(options.onSubmit, true), onSubmitInvalid: wrapSubmitCallback(options.onSubmitInvalid), onSubmitRaw: wrapSubmitCallback(options.onSubmitRaw) },
      plugins: [countCore, createLibraryPlugin(inputs), bindings, createValidationPlugin(rules), createI18nPlugin({ en })] });
    const submitHandler=this.node.context.handlers.submit;
    this._onSubmit = event => { this.lastSubmission = submitHandler(event).catch(error => { if (error !== terminalSubmission) throw error; }); };
    this.node.context.handlers.submit=this._onSubmit;
    this._rootRenderer=renderSections({host:this.el,schema:this.node.props.definition.schema({}),context:this.node.context,metrics:this.metrics,reuseRoot:true,
      slots:{default:({parent,before})=>{this._fieldAnchor=document.createComment('fields');parent.insertBefore(this._fieldAnchor,before);return()=>this._fieldAnchor.remove();}}});
    this.specs = options.fields ?? Array.from({ length: options.count ?? 1 }, (_, i) => ({ name: `field${i}`, label: `Field ${i}`, validation: 'required' }));
    this.on('before:destroy', () => { this._ending = true; this._rootRenderer.destroy(); for (const field of this.fields.values()) field.destroy(); this.fields.clear(); this.node.destroy(); });
  }
  render() {
    if (this.isDestroyed()) return this;
    this.triggerMethod('before:render', this);
    if (this._ending || this.isDestroyed()) return this;
    this.node.context.refreshClasses();this._rootRenderer.refresh();
    if (this._ending || this.isDestroyed()) return this;
    this.setFields(this.specs); for (const field of this.fields.values()) { field.refresh(); if (this._ending || this.isDestroyed()) return this; }
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
        const node = createNode({ parent: this.node, name: spec.name, type: 'input', value: this.initialValues[spec.name] ?? '', props: { ...spec, type: 'text', attrs: spec.attrs ?? {}, id: `experiment-${this.cid}-${++this._fieldId}`, label: spec.label, validation: spec.validation ?? 'required', validationVisibility: spec.validationVisibility ?? 'live', disabled: spec.disabled } });
        field = createField(node, spec, this.config, this.metrics); this.fields.set(spec.name, field);
      } else { for(const key of ['label','help','disabled']) field.node.props[key] = spec[key]; field.node.props.validation = spec.validation ?? 'required'; field.node.props.validationVisibility = spec.validationVisibility ?? 'live'; }
      this._fieldAnchor.parentNode.insertBefore(field.el,this._fieldAnchor);
    }

    this.specs = specs;
  }
  get formMessages() { return this.el.querySelector(':scope > .formkit-messages'); }
  resetForm() { if (!this._ending && !this.isDestroyed()) reset(this.node); }
  submit() { if (this._ending || this.isDestroyed()) return Promise.resolve();
    this.el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return this.lastSubmission;
  }
}

export function mount({ host, count = 1, fields, values = {}, classes, config, onSubmit, onSubmitInvalid, onSubmitRaw, formProps } = {}) {
  const region = new Region({ el: host });
  const form = new ExperimentalFormView({ count, fields, values, classes, config, onSubmit, onSubmitInvalid, onSubmitRaw, formProps }); region.show(form);
  return { form, node: form.node, metrics: form.metrics, setFields: specs => form.setFields(specs), reset: () => form.resetForm(), submit: () => form.submit(), destroy: () => region.destroy() };
}
