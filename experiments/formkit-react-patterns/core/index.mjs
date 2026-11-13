// Experimental slice. React 2.5.0 store/class-cache patterns adapted under MIT;
// see LICENSE.formkit. DOM renderer and Marionette ownership are new code.
import { installValueFacade } from './value-facade.mjs';
import { View, Region } from 'marionette';
import { createNode, compile, reset } from '@formkit/core';
import { createLibraryPlugin, inputs } from '@formkit/inputs';
import { createObserver } from '@formkit/observer';
import { bindings } from './upstream-bindings.mjs';
import { renderSections } from './section-renderer.mjs';
import { createValidationPlugin } from '@formkit/validation';
import * as rules from '@formkit/rules';
import { createI18nPlugin, en } from '@formkit/i18n';

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
  for(const spec of specs){const type=spec.type??'text';if(!['text','textarea','checkbox','select','group'].includes(type))throw new TypeError('Only text/textarea/single checkbox/single select/group supported');if(!spec.name||names.has(spec.name))throw new TypeError('Unique sibling names required');names.add(spec.name);
    if(type==='select'){
      if(spec.multiple!==undefined||spec.attrs?.multiple!==undefined||spec.optionsLoader!==undefined)throw new TypeError('Multiple/async select unsupported');
      if(!spec.options||typeof spec.options!=='object')throw new TypeError('Select requires synchronous flat options');
      if(Array.isArray(spec.options))for(const option of spec.options){if(option==null||!['string','number','object'].includes(typeof option)||typeof option==='object'&&('group'in option||'options'in option||!('value'in option)||!('label'in option)))throw new TypeError('Only flat select options supported');}
      if(spec.children)throw new TypeError('Custom select slots unsupported');
    }
    if(type==='checkbox'){if(spec.options!==undefined)throw new TypeError('Checkbox options are unsupported');for(const key of ['onValue','offValue'])if(spec[key]!==undefined&&spec[key]!==null&&!['string','number','boolean'].includes(typeof spec[key]))throw new TypeError('Checkbox values must be scalar');}
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
      try{nextRenderer=renderSections({host:nextHost,schema,context,metrics:view.metrics,data});nextObserver.watch(()=>nextRenderer.update());}
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
      if(node.props.type==='textarea'&&next.attrs!==field.spec.attrs)node.props.attrs=next.attrs??{};
      if(node.props.type==='select'&&next.options!==field.spec.options)node.props.options=next.options;
      if(node.props.type==='checkbox'){node.props.onValue=next.onValue===undefined?true:next.onValue;node.props.offValue=next.offValue===undefined?false:next.offValue;}
      for(const key of ['label','help','disabled','validation','validationVisibility'])node.props[key]=next[key]??(key==='validationVisibility'?'live':undefined);
    }
    field.spec=next;
  },disposeView(remove=true){if(dead)return;dead=true;renderer?.destroy(remove);for(const slot of slotControllers.values())slot.destroy(remove);for(const child of children.values())child.disposeView(remove);if(remove)el.remove();},disposeNodes(parentFirst=false){if(parentFirst)node.destroy();for(const child of children.values())child.disposeNodes(parentFirst);children.clear();if(!parentFirst)node.destroy();},destroy(){if(dead)return;field.disposeView();field.disposeNodes();}};
  try{renderer=renderSections({host:el,schema:node.props.definition.schema({}),context:node.context,metrics:view.metrics,slots});field.update(spec);return field;}
  catch(error){field.destroy();throw error;}
}

function createFieldNode(view,parent,spec,initial) {
  const type=spec.type??'text',value=Object.hasOwn(initial??{},spec.name)?initial[spec.name]:spec.value;
  const {children,...props}=spec;
  return createNode({parent,name:spec.name,value,props:{...props,type,attrs:spec.attrs??{},id:`experiment-${view.cid}-${++view._fieldId}`,__slots:type==='group'?{default:true}:Object.fromEntries(Object.keys(children??{}).map(name=>[name,true])),validation:spec.validation,validationVisibility:spec.validationVisibility??'live'}});
}

function reconcile(view,parent,map,specs,anchor,initial) {
  for(const spec of specs)if(map.has(spec.name)&&map.get(spec.name).node.props.type!==(spec.type??'text'))throw new TypeError('Changing an existing field type is unsupported');
  for(const spec of specs)if(map.get(spec.name)?.node.props.type==='select'&&map.get(spec.name).spec.placeholder!==spec.placeholder)throw new TypeError('Live placeholder changes are not yet supported');
  const names=new Set(specs.map(spec=>spec.name));
  for(const[name,field]of map)if(!names.has(name)){field.destroy();map.delete(name);}
  for(const spec of specs){
    let field=map.get(spec.name);
    if(!field){
      const node=view._initialNodes?.get(parent)?.get(spec.name)??createFieldNode(view,parent,spec,initial);
      view._initialNodes?.get(parent)?.delete(spec.name);
      const value=Object.hasOwn(initial??{},spec.name)?initial[spec.name]:spec.value;
      field=createField(node,spec,view,value);map.set(spec.name,field);
    }else field.update(spec);
  }
    const elements=specs.map(spec=>map.get(spec.name).el);
    const active=anchor.ownerDocument.activeElement;
    const pivot=elements.findIndex(element=>element.contains(active));
    const place=(first,last,cursor)=>{for(let i=last;i>=first;i--){const element=elements[i];if(element.nextSibling!==cursor)anchor.parentNode.insertBefore(element,cursor);cursor=element;}};
    // Moving a focused ancestor with insertBefore blurs it in real browsers.
    // Keep that retained subtree attached; move only its siblings around it.
    if(pivot<0)place(0,elements.length-1,anchor);
    else{place(pivot+1,elements.length-1,anchor);place(0,pivot-1,elements[pivot]);}
}


export class ExperimentalFormView extends View {
  get tagName() { return 'form'; }
  get template() { return false; }
  initialize(options = {}) {
    this.metrics = { enabled:options.instrument===true, contextNotifications:0,tokenChecks:0,expressionEvaluations:0,domWrites:0,structuralChanges:0,coreNodesCreated:0,coreNodesDestroyed:0,coreInputEvents:0,coreCommitEvents:0,coreMessageEvents:0,classRootEvaluations:0 };
    this._fieldId = 0; this._ending = false;
    this.config = { delay: 0, locale: 'en', rootClasses: section => ({[`formkit-${section}`]:true}), ...options.config, classes: options.classes ?? options.config?.classes };
    const rootClasses=this.config.rootClasses;
    if(this.metrics.enabled)this.config.rootClasses=(section,node)=>{this.metrics.classRootEvaluations++;return rootClasses(section,node);};
    const countCore=node=>{this.metrics.coreNodesCreated++;for(const[event,key]of [['input','coreInputEvents'],['commit','coreCommitEvents'],['message-added','coreMessageEvents'],['message-updated','coreMessageEvents'],['message-removed','coreMessageEvents'],['destroyed','coreNodesDestroyed']])node.on(event,()=>this.metrics[key]++);};
    this.fields = new Map(); this.initialValues = structuredClone(options.values ?? {});
    this.node = createNode({ name: 'form', value: this.initialValues, config: this.config,
      props: { ...options.formProps, type: 'form', attrs: options.formProps?.attrs ?? {}, id: `experiment-form-${this.cid}`, __slots: {default:true}, actions: false, onSubmit: options.onSubmit ?? (()=>{}), onSubmitInvalid: options.onSubmitInvalid, onSubmitRaw: options.onSubmitRaw },
      plugins: [...(this.metrics.enabled?[countCore]:[]), createLibraryPlugin(inputs), node=>{if(node.props.type==='select')node.props.options=node.props.options;}, bindings, createValidationPlugin(rules), createI18nPlugin({ en })] });
    this._disposeFacade=installValueFacade(this);
    const submitHandler=this.node.context.handlers.submit;
    this._onSubmit = event => { this.lastSubmission = submitHandler(event); };
    this.node.context.handlers.submit=this._onSubmit;
    this._rootRenderer=renderSections({host:this.el,schema:this.node.props.definition.schema({}),context:this.node.context,metrics:this.metrics,reuseRoot:true,
      slots:{default:({parent,before})=>{this._fieldAnchor=document.createComment('fields');parent.insertBefore(this._fieldAnchor,before);return(remove=true)=>{if(remove)this._fieldAnchor.remove();};}}});
    this.specs = options.fields ?? Array.from({ length: options.count ?? 1 }, (_, i) => ({ name: `field${i}`, label: `Field ${i}`, validation: 'required' }));
    this.on('before:destroy', () => { this._ending = true; this._disposeFacade(); this._rootRenderer.destroy(false); for (const field of this.fields.values()) field.disposeView(false); this.node.destroy(); for (const field of this.fields.values()) field.disposeNodes(true); this.fields.clear(); this.el.replaceChildren(); });
  }
  render() {
    if (this.isDestroyed()) return this;
    this.triggerMethod('before:render', this);
    if(!this._isRendered)this.setFields(this.specs);
    else{
      this.node.context.refreshClasses();this._rootRenderer.refresh();
      for (const field of this.fields.values()) field.refresh();
    }
    this._isRendered = true; this.triggerMethod('render', this); return this;
  }
  setFields(specs) {
    if (this._ending || this.isDestroyed()) return;
    validateFields(specs);
    if(!this._isRendered&&this.fields.size===0){
      
      this._initialNodes=new Map();
      const prepare=(parent,specs,initial)=>{
        const nodes=new Map();this._initialNodes.set(parent,nodes);
        for(const spec of specs){const node=createFieldNode(this,parent,spec,initial);nodes.set(spec.name,node);if(node.type==='group')prepare(node,spec.children??[],node.value);}
      };
      try {
        prepare(this.node,specs,this.initialValues);
        this.node.context.refreshClasses();this._rootRenderer.refresh();
        reconcile(this,this.node,this.fields,specs,this._fieldAnchor,this.initialValues);
      } finally {
        // Only unclaimed construction resources; no rollback of rendered fields.
        for(const nodes of this._initialNodes.values())for(const node of nodes.values())node.destroy();
        this._initialNodes=undefined;
      }
    }else reconcile(this,this.node,this.fields,specs,this._fieldAnchor,this.initialValues);
    this.specs = specs;
  }
  get formMessages() { return this.el.querySelector(':scope > .formkit-messages'); }
  resetForm() { if (!this._ending && !this.isDestroyed()) reset(this.node); }
  submit() { if (this._ending || this.isDestroyed()) return Promise.resolve();
    this.el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return this.lastSubmission;
  }
}

export function mount({ instrument=false, host, count = 1, fields, values = {}, classes, config, onSubmit, onSubmitInvalid, onSubmitRaw, formProps } = {}) {
  const region = new Region({ el: host });
  const form = new ExperimentalFormView({ instrument, count, fields, values, classes, config, onSubmit, onSubmitInvalid, onSubmitRaw, formProps }); region.show(form);
  return { form, node: form.node, metrics: form.metrics, setFields: specs => form.setFields(specs), reset: () => form.resetForm(), submit: () => form.submit(), destroy: () => region.destroy() };
}
