// Experimental slice. React 2.5.0 store/class-cache patterns adapted under MIT;
// see LICENSE.formkit. DOM renderer and Marionette ownership are new code.
import { View, Region } from 'marionette';
import { createNode, compile, reset } from '@formkit/core';
import { createLibraryPlugin, inputs } from '@formkit/inputs';
import { createObserver } from '@formkit/observer';
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

function validateSlot(schema) {
  if(Array.isArray(schema)){schema.forEach(validateSlot);return;}
  if(typeof schema==='string'&&schema.startsWith('$')){compile(schema);return;}
  if(schema==null||typeof schema!=='object')return;
  for(const key of Object.keys(schema))if(!['$el','attrs','children','if','then','else','bind','meta'].includes(key))throw new TypeError(`Unsupported slot schema key: ${key}`);
  if(schema.$el!==undefined&&schema.$el!==null&&(typeof schema.$el!=='string'||schema.$el.startsWith('$')))throw new TypeError('Dynamic slot tags unsupported');
  for(const key of ['if','bind'])if(typeof schema[key]==='string'&&schema[key].startsWith('$'))compile(schema[key]);
  for(const value of Object.values(schema.attrs??{})){if(typeof value==='string'&&value.startsWith('$'))compile(value);else if(value&&typeof value==='object')for(const part of Object.values(value))if(typeof part==='string'&&part.startsWith('$'))compile(part);}
  for(const key of ['children','then','else'])if(key in schema)validateSlot(schema[key]);
}
function validateFields(specs) {
  if(!Array.isArray(specs))throw new TypeError('Fields must be an array');
  const names=new Set();
  for(const spec of specs){const type=spec.type??'text';if(!['text','group'].includes(type))throw new TypeError('Only text/group supported');if(!spec.name||names.has(spec.name))throw new TypeError('Unique sibling names required');names.add(spec.name);
    if(type==='group')validateFields(spec.children??[]);
    else if(spec.children){if(Array.isArray(spec.children)||typeof spec.children!=='object')throw new TypeError('Text children must be named schema slots');for(const key of Object.keys(spec.children)){if(!['label','help'].includes(key))throw new TypeError('Only label/help schema slots supported');validateSlot(spec.children[key]);}}
  }
}
function createField(node,spec,view,initial) {
  const el=document.createElement('div');el.dataset.experimentField=String(node.name);
  const children=new Map(),slots={},slotControllers=new Map();let anchor,dead=false,renderer,currentSlots=spec.children??{};
  if(node.type==='group')slots.default=({parent,before})=>{anchor=document.createComment('group fields');parent.insertBefore(anchor,before);return(remove=true)=>{if(remove)anchor.remove();};};
  else for(const name of ['label','help'])slots[name]=({parent,before,context})=>{
    let host,active,observer,closed=false;
    const update=schema=>{
      const nextHost=document.createElement('span');nextHost.dataset.experimentSlot=name;
      const nextObserver=createObserver(view.node),data={get values(){return nextObserver.value;}};let nextRenderer;
      try{nextRenderer=renderSections({host:nextHost,schema,context,metrics:view.metrics,data});nextObserver.watch(()=>nextRenderer.refresh());}
      catch(error){nextObserver.kill();nextRenderer?.destroy();throw error;}
      if(host){observer.kill();active.destroy();host.replaceWith(nextHost);}else parent.insertBefore(nextHost,before);
      host=nextHost;active=nextRenderer;observer=nextObserver;
    };
    const controller={update,refresh(){if(!closed)active.refresh();},destroy(remove=true){if(closed)return;closed=true;observer.kill();active.destroy(remove);if(remove)host.remove();slotControllers.delete(name);}};
    update(currentSlots[name]);slotControllers.set(name,controller);return(remove=true)=>controller.destroy(remove);
  };
  const field={el,node,spec,children,refresh(){if(dead)return;node.context.refreshClasses();renderer.refresh();for(const slot of slotControllers.values())slot.refresh();for(const child of children.values())child.refresh();},update(next){
    if(node.type==='group'){node.props.disabled=next.disabled;reconcile(view,node,children,next.children??[],anchor,initial??{});}
    else {
      if(next.children!==field.spec.children){
      const nextSlots=next.children??{};
      for(const[name,slot]of slotControllers)if(name in nextSlots&&nextSlots[name]!==currentSlots[name])slot.update(nextSlots[name]);
      currentSlots=nextSlots;node.context.slots=Object.fromEntries(Object.keys(currentSlots).map(name=>[name,true]));renderer.refresh();
      }
      for(const key of ['label','help','disabled','validation','validationVisibility'])node.props[key]=next[key]??(key==='validation'?'required':key==='validationVisibility'?'live':undefined);
    }
    field.spec=next;
  },disposeView(remove=true){if(dead)return;dead=true;renderer?.destroy(remove);for(const slot of slotControllers.values())slot.destroy(remove);for(const child of children.values())child.disposeView(remove);if(remove)el.remove();},disposeNodes(){for(const child of children.values())child.disposeNodes();children.clear();node.destroy();},destroy(){if(dead)return;field.disposeView();field.disposeNodes();}};
  try{renderer=renderSections({host:el,schema:node.props.definition.schema({}),context:node.context,metrics:view.metrics,slots});field.update(spec);return field;}
  catch(error){field.destroy();throw error;}
}

function reconcile(view,parent,map,specs,anchor,initial) {
  for(const spec of specs)if(map.has(spec.name)&&map.get(spec.name).node.props.type!==(spec.type??'text'))throw new TypeError('Changing an existing field type is unsupported');
  const staged=new Map();
  try{for(const spec of specs){if(view._ending)break;if(map.has(spec.name))continue;const type=spec.type??'text',value=initial?.[spec.name]??(type==='group'?{}:'');const {children,...props}=spec;
    const node=createNode({parent,name:spec.name,value,props:{...props,type,attrs:spec.attrs??{},id:`experiment-${view.cid}-${++view._fieldId}`,__slots:type==='group'?{default:true}:Object.fromEntries(Object.keys(children??{}).map(name=>[name,true])),validation:spec.validation??(type==='text'?'required':undefined),validationVisibility:spec.validationVisibility??'live'}});
    staged.set(spec.name,createField(node,spec,view,value));
  }}catch(error){for(const field of staged.values())field.destroy();throw error;}
  if(view._ending){for(const field of staged.values())field.destroy();return;}
  try{
  for(const[name,field]of map)if(!specs.some(spec=>spec.name===name)){field.destroy();map.delete(name);}
  for(const spec of specs){if(view._ending)break;let field=map.get(spec.name);if(!field){field=staged.get(spec.name);map.set(spec.name,field);staged.delete(spec.name);}else field.update(spec);
    if(view._ending)break;
  }
  if(!view._ending){let cursor=anchor;for(let i=specs.length-1;i>=0;i--){const element=map.get(specs[i].name).el;if(element.nextSibling!==cursor)anchor.parentNode.insertBefore(element,cursor);cursor=element;}}
  }finally{for(const field of staged.values())field.destroy();}
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
    this.node = createNode({ name: 'form', value: this.initialValues, config: this.config,
      props: { ...options.formProps, type: 'form', attrs: options.formProps?.attrs ?? {}, id: `experiment-form-${this.cid}`, __slots: {default:true}, actions: false, onSubmit: options.onSubmit ?? (()=>{}), onSubmitInvalid: options.onSubmitInvalid, onSubmitRaw: options.onSubmitRaw },
      plugins: [countCore, createLibraryPlugin(inputs), bindings, createValidationPlugin(rules), createI18nPlugin({ en })] });
    const submitHandler=this.node.context.handlers.submit;
    this._onSubmit = event => { this.lastSubmission = submitHandler(event); };
    this.node.context.handlers.submit=this._onSubmit;
    this._rootRenderer=renderSections({host:this.el,schema:this.node.props.definition.schema({}),context:this.node.context,metrics:this.metrics,reuseRoot:true,
      slots:{default:({parent,before})=>{this._fieldAnchor=document.createComment('fields');parent.insertBefore(this._fieldAnchor,before);return(remove=true)=>{if(remove)this._fieldAnchor.remove();};}}});
    this.specs = options.fields ?? Array.from({ length: options.count ?? 1 }, (_, i) => ({ name: `field${i}`, label: `Field ${i}`, validation: 'required' }));
    this.on('before:destroy', () => { this._ending = true; this._rootRenderer.destroy(false); for (const field of this.fields.values()) field.disposeView(false); for (const field of this.fields.values()) field.disposeNodes(); this.fields.clear(); this.node.destroy(); this.el.replaceChildren(); });
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
    validateFields(specs);
    reconcile(this,this.node,this.fields,specs,this._fieldAnchor,this.initialValues);
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
