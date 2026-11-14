import { createFormKitStructuralComponents } from './structural-components.mjs';
import { subscribeReactiveStore } from './upstream-bindings.mjs';
import { createFormKitProviders } from './provider-components.mjs';
import { nativeFormKitFactory, formKitScope } from './provider-scope.mjs';
export { defaultConfig } from './config-scope.mjs';
// Experimental slice. React 2.5.0 store/class-cache patterns adapted under MIT;
// see LICENSE.formkit. DOM renderer and Marionette ownership are new code.
import { createFormKitApplication } from './formkit-application.mjs';
import { nativeTypes } from './native-types.mjs';
import { createFormKitHelpers } from './helper-components.mjs';
import { resolveComponentLibrary } from './component-library.mjs';
import { installValueFacade } from './value-facade.mjs';
import { camel, kebab, slugify, extend, cloneAny, shallowClone, eq } from '@formkit/utils';
import { createThemePlugin } from '@formkit/themes';
import { View, Region, MnObject } from 'marionette';
import { createNode, compile, reset, createMessage } from '@formkit/core';
import { createLibraryPlugin, inputs, runtimeProps } from '@formkit/inputs';
import { createObserver } from '@formkit/observer';
import { bindings } from './upstream-bindings.mjs';
import { renderSections } from './section-renderer.mjs';
import { createRootSlots, renderSchemaSlot } from './root-slots.mjs';
import { createLayoutController } from './schema-layout.mjs';
import { createValidationPlugin } from '@formkit/validation';
import * as rules from '@formkit/rules';
import { createI18nPlugin, en } from '@formkit/i18n';

function validateSlot(schema) {
  if(Array.isArray(schema)){schema.forEach(validateSlot);return;}
  if(typeof schema==='string'&&schema.startsWith('$')){compile(schema);return;}
  if(schema==null||typeof schema!=='object')return;
  if(!Object.hasOwn(schema,'$formkit'))for(const key of Object.keys(schema))if(!['$el','$cmp','props','attrs','children','if','then','else','bind','meta','for'].includes(key))throw new TypeError(`Unsupported slot schema key: ${key}`);
  if(schema.$el!==undefined&&schema.$el!==null&&typeof schema.$el!=='string')throw new TypeError('Slot tags must be strings');
  for(const key of ['if','bind'])if(typeof schema[key]==='string'&&schema[key].startsWith('$'))compile(schema[key]);
  for(const value of Object.values(schema.attrs??{})){if(typeof value==='string'&&value.startsWith('$'))compile(value);else if(value&&typeof value==='object')for(const part of Object.values(value))if(typeof part==='string'&&part.startsWith('$'))compile(part);}
  for(const key of ['children','then','else'])if(key in schema)validateSlot(schema[key]);
}
function validateFields(specs, definitions=inputs) {
  if(!Array.isArray(specs))throw new TypeError('Fields must be an array');
  const names=new Set();
  for(const spec of specs){const type=spec.type??'text';// Core library plugins resolve and validate registered input types.
    if(spec.name!==undefined){if(names.has(spec.name))throw new TypeError('Unique sibling names required');names.add(spec.name);}
    if(Array.isArray(spec.children)||type==='group'||type==='list')validateFields(spec.children??[],definitions);
    else if(spec.children){if(Array.isArray(spec.children)||typeof spec.children!=='object')throw new TypeError('Input children must be named schema slots');for(const value of Object.values(spec.children))validateSlot(value);}
  }
}

function applyErrorProps(node,spec){
  node.store.apply((spec.errors??[]).map(value=>createMessage({key:slugify(value),type:'error',value,meta:{source:'prop'}})),message=>message.type==='error'&&message.meta.source==='prop');
  if(node.type!=='input'){
    const source=`${node.name}-prop`,errors={};
    for(const [key,value]of Object.entries(spec.inputErrors??{}))errors[key]=(Array.isArray(value)?value:[value]).map(value=>createMessage({key:value,type:'error',value,meta:{source}}));
    if(!Object.keys(errors).length)node.clearErrors(true,source);
    node.store.apply(errors,message=>message.type==='error'&&message.meta.source===source);
  }
}
function modelValue(spec){return spec.modelValue!==undefined?spec.modelValue:spec.value;}
function isModeled(spec){return spec.modelValue!==undefined||spec.value!==undefined||typeof spec.onUpdateModelValue==='function';}
function schemaFor(node,sections){const schema=node.props.definition.schema;return typeof schema==='function'?schema({...sections??{}}):schema;}

function createField(node,spec,view,initial,renderDefault,present) {
  const el=document.createElement('div');el.dataset.experimentField=String(node.name);
  const initialVisibility=nativeProps(spec,node.props.definition);
  let declaredVisibility=initialVisibility.props.validationVisibility!==undefined?initialVisibility.props.validationVisibility:initialVisibility.attrs.validationVisibility;
  let ownsVisibility=declaredVisibility!==undefined&&Object.hasOwn(node.props,'validationVisibility')&&eq(node.props.validationVisibility,declaredVisibility);
  const visibilityReceipt=node.on('prop:validationVisibility',event=>{if(event.origin===node)ownsVisibility=false;});
  const children=new Map(),slots={},slotControllers=new Set();const defaultScopes=new Map();let redrawing=false;let anchor,dead=false,renderer,currentSlots=spec.children??{},currentLibrary=spec.library;
  function renderSlot(name){return ({parent,before,context,locals})=>{
    let host,active,observer,closed=false,scopeSpec=field.spec;
    const update=(schema,nextSpec=field.spec)=>{
      scopeSpec=nextSpec;
      const nextHost=document.createElement('span');nextHost.dataset.experimentSlot=name;
      const nextObserver=createObserver(view.node),data=Object.create(view._schemaData);let nextRenderer;
      Object.defineProperty(data,'values',{get:()=>nextObserver.value});
      const keys=new Set();for(const source of [scopeSpec.__schemaData,scopeSpec.__schemaScope,locals])for(const key in source)keys.add(key);
      for(const key of keys)if(key!=='values'&&key!=='slots')Object.defineProperty(data,key,{get:()=>{const source=key in locals?locals:key in (scopeSpec.__schemaScope??{})?scopeSpec.__schemaScope:scopeSpec.__schemaData;return source?.[key];}});
      try{nextRenderer=renderSections({host:nextHost,schema,context,metrics:view.metrics,configScope:view._configScopes.get(node),domRoot:node.props.__root,parentNode:view._schemaParent?node:undefined,components:resolveComponentLibrary(node,view.components,currentLibrary),data});nextObserver.watch(()=>nextRenderer.update());}
      catch(error){nextObserver.kill();nextRenderer?.destroy();throw error;}
      if(host){observer.kill();active.destroy();host.replaceWith(nextHost);}else parent.insertBefore(nextHost,before);
      host=nextHost;active=nextRenderer;observer=nextObserver;
    };
    const controller={name,update,setScope(next){scopeSpec=next;active.refresh();},refresh(){if(!closed)active.refresh();},destroy(remove=true){if(closed)return;closed=true;observer.kill();active.destroy(remove);if(remove)host.remove();slotControllers.delete(controller);}};
    update(currentSlots[name]);slotControllers.add(controller);return(remove=true)=>controller.destroy(remove);
  };}
  if(renderDefault)slots.default=({parent,before,locals})=>{
    const parentNode=locals?.node??node;let content=defaultScopes.get(parentNode);
    if(!content){const host=document.createElement('span');host.style.display='contents';content={host,dispose:renderDefault(host,null,{node:parentNode})};defaultScopes.set(parentNode,content);}
    content.active=true;parent.insertBefore(content.host,before);let closed=false;
    return(remove=true)=>{if(closed)return;closed=true;content.active=false;if(remove)content.host.remove();if(!redrawing){defaultScopes.delete(parentNode);content.dispose?.(remove);}};
  };
  else if((node.type!=='input'&&Array.isArray(spec.children??[])))slots.default=({parent,before})=>{anchor=document.createComment('group fields');parent.insertBefore(anchor,before);return(remove=true)=>{if(remove)anchor.remove();};};
  else for(const name of Object.keys(currentSlots))slots[name]=renderSlot(name);
  const redraw=next=>{
    if(dead)return;
    const nextSchema=schemaFor(node,next.sectionsSchema);
    if(next.library===field.spec.library&&renderer?.setSchema(nextSchema))return;
    for(const child of children.values())child.el.remove();for(const content of defaultScopes.values())content.host.remove();
    redrawing=true;try{renderer?.destroy();}finally{redrawing=false;}anchor=undefined;
    renderer=renderSections({host:el,schema:nextSchema,context:node.context,metrics:view.metrics,configScope:view._configScopes.get(node),domRoot:node.props.__root,parentNode:view._schemaParent?node:undefined,components:resolveComponentLibrary(node,view.components,next.library),slots});
    for(const [parent,content]of defaultScopes)if(!content.active){defaultScopes.delete(parent);content.dispose?.();content.host.remove();}
    if(anchor)reconcile(view,node,children,next.children??[],anchor,initial??{});
    present?.(el);
  };
  let mounted=false,schemaQueued=false;
  const notifyMounted=()=>{if(!dead&&!mounted&&el.isConnected){mounted=true;view.off('attach fields:attached',notifyMounted);node.emit('mounted');}};
  const field={el,node,spec,children,get childAnchor(){return anchor;},refresh(){if(dead)return;node.context.refreshClasses();renderer.refresh();for(const slot of slotControllers)slot.refresh();for(const child of children.values())child.refresh();},update(next){
    currentLibrary=next.library;
    if(next.config!==field.spec.config)for(const [key,value]of Object.entries(next.config??{}))node.config[key]=value;
      if(next!==field.spec){
        const {props,attrs}=nativeProps(next,node.props.definition);
        const definitions=node.props.definition.props??[],keys=Array.isArray(definitions)?definitions:Object.keys(definitions);
        for(const key of Object.keys(attrs))if(keys.includes(key)){if(key!=='validationVisibility')node.props[key]=attrs[key];delete attrs[key];}
        node.props.attrs=attrs;
        for(const [key,value]of Object.entries(props))if(key!=='name'&&key!=='type'&&key!=='definition'&&key!=='validationVisibility')node.props[key]=value;
        for(const key of Object.keys(field.spec.classes??{}))if(!(key in (next.classes??{})))node.props[`_${key}Class`]=undefined;
      }
    if((node.type!=='input'&&Array.isArray(next.children??[]))){if(anchor)reconcile(view,node,children,next.children??[],anchor,initial??{});}
    else {
      if(next.children!==field.spec.children){
      const nextSlots=next.children??{};
      for(const slot of slotControllers)if(slot.name in nextSlots&&nextSlots[slot.name]!==currentSlots[slot.name])slot.update(nextSlots[slot.name],next);
      for(const name of Object.keys(currentSlots))if(!Object.hasOwn(nextSlots,name))delete slots[name];
      for(const name of Object.keys(nextSlots))if(!Object.hasOwn(slots,name))slots[name]=renderSlot(name);
      currentSlots=nextSlots;node.context.slots=Object.fromEntries(Object.keys(currentSlots).map(name=>[name,true]));renderer.refresh();
      }
      if(node.props.type==='checkbox'){const values=nativeProps(next,node.props.definition).attrs;node.props.onValue=values.onValue===undefined?true:values.onValue;node.props.offValue=values.offValue===undefined?false:values.offValue;}
    }
    const normalizedProps=nativeProps(next,node.props.definition),normalized=normalizedProps.props;
    for(const key of ['label','help','disabled','validation'])node.props[key]=normalized[key]??undefined;
    const visibility=normalized.validationVisibility!==undefined?normalized.validationVisibility:normalizedProps.attrs.validationVisibility;
    if(!eq(visibility,declaredVisibility)){
      if(visibility!==undefined){node.props.validationVisibility=visibility;ownsVisibility=Object.hasOwn(node.props,'validationVisibility')&&eq(node.props.validationVisibility,visibility);}
      else if(ownsVisibility&&Object.hasOwn(node.props,'validationVisibility')){
        // Clear only the prior declaration's value; Core deletion does not notify bindings.
        delete node.props.validationVisibility;
        const value=node.props.validationVisibility||(node.props.type==='checkbox'?'dirty':'blur');
        node.emit('prop',{prop:'validationVisibility',value});
        node.emit('prop:validationVisibility',value);
      }
      if(visibility===undefined)ownsVisibility=false;
      declaredVisibility=visibility;
    }
    if(next.sectionsSchema!==field.spec.sectionsSchema||next.library!==field.spec.library){
      redraw(next);
    }
    applyErrorProps(node,next);
    const previous=field.spec;field.spec=next;
    if(next.__schemaScope!==previous.__schemaScope||next.__schemaData!==previous.__schemaData)for(const slot of slotControllers)slot.setScope(next);
    if(next!==previous&&isModeled(next)&&!eq(modelValue(next),modelValue(previous))&&!eq(node.value,modelValue(next)))node.input(cloneAny(modelValue(next)),false);
  },disposeView(remove=true){if(dead)return;dead=true;node.off(inputReceipt);node.off(schemaReceipt);node.off(visibilityReceipt);view.off('attach fields:attached',notifyMounted);renderer?.destroy(remove);for(const content of defaultScopes.values())content.dispose?.(remove);defaultScopes.clear();for(const slot of slotControllers)slot.destroy(remove);for(const child of children.values())child.disposeView(remove);if(remove)el.remove();},disposeNodes(parentFirst=false){if(parentFirst)node.destroy();for(const child of children.values())child.disposeNodes(parentFirst);children.clear();if(!parentFirst)node.destroy();},destroy(){if(dead)return;field.disposeView();field.disposeNodes();}};
  const inputReceipt=node.on('modelUpdated',()=>{field.spec.onInputRaw?.(node.context?.value,node);field.spec.onInput?.(node.context?.value,node);if(isModeled(field.spec)){const value=shallowClone(node.value);field.spec.onUpdateModelValue?.(value);field.spec['onUpdate:modelValue']?.(value);field.spec.onChange?.(value,node);}});
  const schemaReceipt=node.on('schema',event=>{if(event.origin!==node||dead||schemaQueued)return;schemaQueued=true;queueMicrotask(()=>{schemaQueued=false;if(!dead)redraw(field.spec);});});
  view.on('attach fields:attached',notifyMounted);queueMicrotask(notifyMounted);
  spec.onNode?.(node);
  try{renderer=renderSections({host:el,schema:schemaFor(node,spec.sectionsSchema),context:node.context,metrics:view.metrics,configScope:view._configScopes.get(node),domRoot:node.props.__root,parentNode:view._schemaParent?node:undefined,components:resolveComponentLibrary(node,view.components,spec.library),slots});field.update(spec);present?.(el);return field;}
  catch(error){field.destroy();throw error;}
}

const generalProps=new Set([...runtimeProps,'label','help','disabled','validationVisibility','slots','definition','defaultValue','onUpdateModelValue','onChange','sync','dynamic','ignore','preserve']);
const isNodeProp=key=>generalProps.has(camel(key))||/^preserve(-e|E)rrors/.test(key)||/^[a-z]+(?:-visibility|Visibility|-behavior|Behavior)$/.test(key)||/^[a-zA-Z_-]+(?:-class|Class)$/.test(key)||/^[a-zA-Z-]+(?:-icon|Icon)$/.test(key);
function nativeProps(spec, suppliedDefinition) {
  const {children,attrs={},value,__schemaScope,__schemaData,library,...direct}=spec;
  const props={...direct},domAttrs={};
  for(const [section,value]of Object.entries(spec.classes??{}))props[`_${section}Class`]=value;
  const definition=suppliedDefinition??spec.definition??inputs[camel(spec.type??'text')]??{};
  const keys=Array.isArray(definition.props)?definition.props:Object.keys(definition.props??{});
  for(const [key,value]of Object.entries(direct)){if(!isNodeProp(key)){domAttrs[key]=value;delete props[key];}}
  for(const [key,value]of Object.entries(attrs)){
    const name=camel(key);
    if(isNodeProp(name)){if(!Object.hasOwn(props,name))props[name]=value;}
    else {const attr=keys.includes(name)?name:key;if(!Object.hasOwn(domAttrs,attr))domAttrs[attr]=value;}
  }
  // Definition props enter via attrs so the installed official feature hooks
  // normalize them during addProps, exactly once on initial construction.
  for(const key of ['min','max','step','placeholder','autocomplete','maxlength','minlength','pattern','readonly','rows','cols','multiple','accept','capture','size'])if(Object.hasOwn(props,key)&&!keys.includes(key)){domAttrs[key]=props[key];delete props[key];}
  for(const key of keys)if(Object.hasOwn(props,key)){domAttrs[key]=props[key];delete props[key];}
  return {props,attrs:domAttrs};
}

function createFieldNode(view,parent,spec,initial,configScope=view._configScopes.get(parent),domRoot=view._schemaParent===parent?view._domRoot:parent?.props.__root??view._domRoot) {
  const type=spec.type??'text',value=Object.hasOwn(initial??{},spec.name)?initial[spec.name]:(modelValue(spec)!==undefined?cloneAny(modelValue(spec)):cloneAny(spec.defaultValue));
  const {children}=spec;const {props,attrs}=nativeProps(spec,(configScope?.definitions??view.definitions)[camel(type)]);
  const scopedOptions=configScope?.options;
  if(props.validationVisibility===undefined)delete props.validationVisibility;
  if(attrs.validationVisibility===undefined)delete attrs.validationVisibility;
  const node=createNode({parent:props.ignore?null:parent,plugins:[...(scopedOptions?[...(view.metrics.enabled?[view._countCore]:[]),...(scopedOptions.plugins??[])]:view.plugins),...(spec.plugins??[])],index:spec.index,sync:!!(spec.sync??spec.dynamic),config:{...(scopedOptions?scopedOptions.config:{...(view.config.rootConfig?{rootConfig:view.config.rootConfig}:{}),...(props.ignore?view.config:{})}),...spec.config},name:spec.name,value,props:{...props,type,attrs,__root:domRoot,id:props.id??`experiment-${view.cid}-${++view._fieldId}`,__slots:Array.isArray(children)?{default:()=>[]}:Object.fromEntries(Object.keys(children??{}).map(name=>[name,name==='default'?()=>[]:true]))}});
  if(configScope)view._configScopes.set(node,configScope);
  return node;
}

function fieldIdentity(view,parent,spec,index){
  if(spec.name!==undefined)return spec.name;
  let identities=view._anonymousKeys.get(parent);if(!identities){identities={positions:new Map(),keys:new Map()};view._anonymousKeys.set(parent,identities);}
  const keyed=spec.key!==undefined,keys=keyed?identities.keys:identities.positions,key=keyed?spec.key:index;
  if(!keys.has(key))keys.set(key,Symbol('anonymous field'));
  return keys.get(key);
}
function fieldEntries(view,parent,specs){
  const entries=specs.map((spec,index)=>[fieldIdentity(view,parent,spec,index),spec]);
  if(new Set(entries.map(([key])=>key)).size!==entries.length)throw new TypeError('Unique sibling field keys required');
  return entries;
}
function reconcile(view,parent,map,specs,anchor,initial) {
  const entries=fieldEntries(view,parent,specs);
  for(const [key,spec] of entries){const existing=map.get(key);if(existing&&(existing.node.props.type!==(spec.type??'text')||!Object.is(existing.spec.key,spec.key))){existing.destroy();map.delete(key);}}
  const names=new Set(entries.map(([key])=>key));
  for(const[name,field]of map)if(!names.has(name)){field.destroy();map.delete(name);}
  for(const [key,spec] of entries){
    let field=map.get(key);
    if(!field){
      const node=view._initialNodes?.get(parent)?.get(key)??createFieldNode(view,parent,spec,initial);
      view._initialNodes?.get(parent)?.delete(key);
      const value=Object.hasOwn(initial??{},spec.name)?initial[spec.name]:(modelValue(spec)!==undefined?cloneAny(modelValue(spec)):cloneAny(spec.defaultValue));
      field=createField(node,spec,view,value);map.set(key,field);
    }else field.update(spec);
  }
    // Layout outlets own fields already projected into another container.
    // Reconcile only this outlet's children and newly created detached fields.
    const elements=entries.map(([key])=>map.get(key).el).filter(element=>!element.parentNode||element.parentNode===anchor.parentNode);
    const active=anchor.ownerDocument.activeElement;
    const pivot=elements.findIndex(element=>element.contains(active));
    const place=(first,last,cursor)=>{for(let i=last;i>=first;i--){const element=elements[i];if(element.nextSibling!==cursor)anchor.parentNode.insertBefore(element,cursor);cursor=element;}};
    // Moving a focused ancestor with insertBefore blurs it in real browsers.
    // Keep that retained subtree attached; move only its siblings around it.
    if(pivot<0)place(0,elements.length-1,anchor);
    else{place(pivot+1,elements.length-1,anchor);place(0,pivot-1,elements[pivot]);}
}


function createSchemaOwner(view,{host,props,context,parentNode,configScope,domRoot,renderChildren,hasChildren}) {
  const parent=parentNode??context.node??view.node,scope=new MnObject();
  const anchor=document.createComment('schema fields');host.append(anchor);
  Object.assign(scope,{node:parent,fields:new Map(),metrics:view.metrics,_fieldAnchor:anchor,_schemaParent:parent,_schemaDataOnly:true,
    _domRoot:domRoot??parent.props.__root,_providerScope:configScope,_anonymousKeys:new WeakMap(),_fieldId:0,
    definitions:view.definitions,plugins:view.plugins,config:view.config,_countCore:view._countCore,
    _configScopes:{get:node=>node===parent?configScope:view._configScopes.get(node),set:(node,value)=>view._configScopes.set(node,value)},
    setFields(specs){validateFields(specs,this.definitions);reconcile(this,parent,this.fields,specs,anchor,parent.value??{});}
  });
  let current,unsubscribe=()=>{},removeDom=true,dead=false,mounted=false,pending=false;
  const attached=()=>{if(dead||!host.isConnected)return;scope.trigger('attach');if(!mounted){mounted=true;current?.onMounted?.();}};view.on('attach',attached);
  scope.on('before:destroy',()=>{dead=true;scope._ending=true;view.off('attach',attached);unsubscribe();scope._layoutController?.destroy();for(const field of scope.fields.values())field.disposeView(removeDom);for(const field of scope.fields.values())field.disposeNodes();scope.fields.clear();if(removeDom)anchor.remove();});
  const refresh=()=>{if(!dead)scope._layoutController?.updateData(current?.data??{});};
  const changed=()=>{if(dead||pending)return;pending=true;queueMicrotask(()=>{pending=false;refresh();});};
  const update=next=>{
    if(dead)return;
    const rebuild=!current||next.schema!==current.schema||next.memoKey!==current.memoKey||next.library!==current.library||next.slots!==current.slots;
    if(!current||next.data!==current.data){unsubscribe();unsubscribe=subscribeReactiveStore(next.data,changed);}
    current=next;scope._schemaData=next.data??{};
    if(rebuild){
      scope._layoutController?.destroy();scope.components={...view.components,...next.library};
      scope._opaqueSchema=scope.components.FormKit!==view.components.FormKit;
      const slots=Object.fromEntries(Object.entries(next.slots??{}).map(([name,content])=>[name,typeof content==='function'?content:args=>renderSchemaSlot(scope,content,args,slots)]));if(hasChildren&&!slots.default)slots.default=({parent,before})=>renderChildren(parent,before);
      createLayoutController({form:scope,schema:next.schema??[],data:scope._schemaData,components:scope.components,slots});
    }else refresh();
  };
  try{update(props);attached();queueMicrotask(attached);}catch(error){scope.destroy();throw error;}
  return {update,refresh,destroy(remove=true){if(dead)return;removeDom=remove;scope.destroy();}};
}

export class ExperimentalFormView extends View {
  get tagName() { return 'form'; }
  get template() { return false; }
  initialize(options = {}) {
    if(options.schema!==undefined&&options.fields!==undefined)throw new TypeError('Use schema or fields as the declaration source');
    this._schema=options.schema;this._schemaSlots=options.schemaSlots??{};this._rootSlots=options.slots??{};
    const view=this;this._schemaData={...options.data,get values(){return view.node.value;}};
    this.metrics = { enabled:options.instrument===true, contextNotifications:0,tokenChecks:0,expressionEvaluations:0,domWrites:0,structuralChanges:0,coreNodesCreated:0,coreNodesDestroyed:0,coreInputEvents:0,coreCommitEvents:0,coreMessageEvents:0,classRootEvaluations:0 };
    this._anonymousKeys=new WeakMap();this._configScopes=new WeakMap();
    this._fieldId = 0; this._ending = false;
    const hostRoot=options.domRoot??this.el.getRootNode();
    this._domRoot=hostRoot.nodeType===9||hostRoot.host?hostRoot:this.el.ownerDocument;
    this.components={...createFormKitStructuralComponents(this,args=>createSchemaOwner(this,args)),...createFormKitProviders(this),...createFormKitHelpers({getNode:()=>this.node,getComponents:()=>this.components,getPlugins:()=>this.plugins,removeDom:()=>!this._ending}),FormKit:({host,props,context,locals,schemaData,parentNode,configScope,domRoot,hasChildren,schemaChildren,renderChildren})=>{
      const name=props.name;
      const namedSlots=hasChildren&&schemaChildren&&!Array.isArray(schemaChildren)&&typeof schemaChildren==='object'&&!['$el','$cmp','$formkit','if','for'].some(key=>key in schemaChildren);
      const spec={...Object.fromEntries(Object.getOwnPropertyNames(props).map(key=>[key,props[key]])),name,__schemaScope:locals,__schemaData:schemaData,...(hasChildren?{children:namedSlots?schemaChildren:{default:[]}}:{})};
      const parent=parentNode??context.node??this.node;
      const node=createFieldNode(this,parent,spec,{},configScope,domRoot);
      const present=el=>{el.style.display='contents';for(const child of [...el.childNodes])host.parentNode.insertBefore(child,host);};
      const field=createField(node,spec,this,undefined,hasChildren&&!namedSlots?renderChildren:undefined,present);host.append(field.el);

      return {update:next=>{field.update({...next,name,children:spec.children,__schemaScope:locals,__schemaData:schemaData});if(namedSlots)field.refresh();},destroy:(remove=true)=>{if(remove)field.destroy();else{field.disposeView(false);field.disposeNodes(true);}}};
    },...options.components};
    if(!Object.hasOwn(options.components??{},'FormKit'))this.components.FormKit[nativeFormKitFactory]=true;
    this.config = { ...(!options.config?.rootConfig&&options.defaultConfig!==false?{locale:'en',rootClasses:section=>({[`formkit-${kebab(section)}`]:true})}:{}), ...options.config, classes: options.classes ?? options.config?.classes, ...(options.messages?{messages:options.messages}:{}) };
    const rootClasses=this.config.rootClasses;
    if(this.metrics.enabled&&rootClasses)this.config.rootClasses=(section,node)=>{this.metrics.classRootEvaluations++;return rootClasses(section,node);};
    const countCore=node=>{this.metrics.coreNodesCreated++;for(const[event,key]of [['input','coreInputEvents'],['commit','coreCommitEvents'],['message-added','coreMessageEvents'],['message-updated','coreMessageEvents'],['message-removed','coreMessageEvents'],['destroyed','coreNodesDestroyed']])node.on(event,()=>this.metrics[key]++);};
    this._countCore=countCore;
    this.definitions={...(options.defaultConfig===false?{}:inputs),...options.inputs};
    this.fields = new Map(); this.initialValues = structuredClone(options.values ?? {});
    this.plugins=[...(this.metrics.enabled?[countCore]:[]), ...(options.defaultConfig===false?[]:[createLibraryPlugin(this.definitions), createThemePlugin(options.theme,options.icons,options.iconLoaderUrl,options.iconLoader), bindings, createValidationPlugin({...rules,...options.rules}), createI18nPlugin(extend({ en,...options.locales },options.messages??{}))]), ...(options.plugins??[])];
    this._providerScope=options[formKitScope]?{options:{plugins:this.plugins,config:{rootConfig:options.config.rootConfig}},definitions:this.definitions}:undefined;
    this.node = createNode({ name: options.formProps?.name??'form', value: this.initialValues, config: this.config,
      props: { ...options.formProps, __root:this._domRoot, type: 'form', attrs: options.formProps?.attrs ?? {}, id: `experiment-form-${this.cid}`, __slots: {default:true,fields:true,...Object.fromEntries(Object.keys(this._rootSlots).map(name=>[name,true]))}, onSubmit: options.onSubmit ?? (()=>{}), onSubmitInvalid: options.onSubmitInvalid, onSubmitRaw: options.onSubmitRaw },
      plugins:this.plugins });
    if(this._providerScope)this._configScopes.set(this.node,this._providerScope);
    this.config=this.node.config;
    this._sectionsSchema=options.sectionsSchema??options.formProps?.sectionsSchema;
    const schemaReceipt=this.node.on('schema',event=>{if(event.origin===this.node)queueMicrotask(()=>{if(!this._ending)this.setSectionsSchema(this._sectionsSchema);});});
    this.once('attach',()=>{if(!this._ending)this.node.emit('mounted');});
    this._facade=installValueFacade(this);
    const submitHandler=this.node.context.handlers.submit;
    this._onSubmit = event => { return this.lastSubmission = submitHandler(event); };
    this.node.context.handlers.submit=this._onSubmit;
    this.specs = options.fields ?? (options.schema!==undefined?[]:Array.from({ length: options.count ?? 1 }, (_, i) => ({ name: `field${i}`, label: `Field ${i}`, validation: 'required' })));
    this.on('before:destroy', () => { this._ending = true; this.node.off(schemaReceipt); this._facade.destroy(); this.node.destroy(); this._layoutController?.destroy(); this._rootRenderer?.destroy(false); for (const field of this.fields.values()) field.disposeView(false); for (const field of this.fields.values()) field.disposeNodes(true); this.fields.clear(); this.el.replaceChildren(); });
    try{this._renderRoot();}catch(error){this.destroy();throw error;}
  }
  render() {
    if (this.isDestroyed()) return this;
    this.triggerMethod('before:render', this);
    if(!this._isRendered){
      this.setFields(this.specs);
      if(this._schema!==undefined)this.setSchema(this._schema);
    }
    else{
      this.node.context.refreshClasses();this._rootRenderer.refresh();
      for (const field of this.fields.values()) field.refresh();
    }
    this._isRendered = true; this.triggerMethod('render', this); return this;
  }
  _renderRoot() {
    this._fieldAnchor=document.createComment('fields');document.createDocumentFragment().append(this._fieldAnchor);
    this._rootRenderer=renderSections({host:this.el,schema:schemaFor(this.node,this._sectionsSchema),context:this.node.context,data:this._schemaData,metrics:this.metrics,configScope:this._providerScope,domRoot:this._domRoot,components:resolveComponentLibrary(this.node,this.components,this.node.props.library),reuseRoot:true,slots:createRootSlots(this,this._rootSlots)});
  }
  setSectionsSchema(sectionsSchema) {
    if(this._ending||this.isDestroyed())return this;
    this._sectionsSchema=sectionsSchema;this._layoutController?.detach();
    for(const field of this.fields.values())field.el.remove();
    this._rootRenderer.destroy();this._renderRoot();
    reconcile(this,this.node,this.fields,this.specs,this._fieldAnchor,this.initialValues);
    this._layoutController?.place();return this;
  }
  setSlots(slots={}) {
    if(this._ending||this.isDestroyed())return this;
    this._rootSlots=slots;this.node.context.slots={default:true,fields:true,...Object.fromEntries(Object.keys(slots).map(name=>[name,true]))};
    return this.setSectionsSchema(this._sectionsSchema);
  }
  setSchema(schema) {
    if(this._ending||this.isDestroyed())return this;
    this._layoutController?.destroy();this._schema=schema;
    if(schema!==undefined)createLayoutController({form:this,schema,data:this._schemaData,components:this.components,slots:this._schemaSlots});
    return this;
  }
  updateData(next={}) {
    if(this._ending||this.isDestroyed())return this;
    for(const key of Object.keys(this._schemaData))if(key!=='values')delete this._schemaData[key];
    for(const[key,value]of Object.entries(next))if(key!=='values')this._schemaData[key]=value;
    this._layoutController?.updateData(this._schemaData);this._rootRenderer.refresh();for(const field of this.fields.values())field.refresh();return this;
  }
  getValues() { return this._facade.getValues(); }
  getFormState() { return this._facade.getFormState(); }
  setValues(values,options) { return this._facade.setValues(values,options); }
  setErrors(errors,fieldErrors) { return this._facade.setErrors(errors,fieldErrors); }
  setFields(specs) { return this._facade.batch('setFields',()=>this._setFields(specs)); }
  _setFields(specs) {
    if (this._ending || this.isDestroyed()) return;
    validateFields(specs,this.definitions);
    if(!this._isRendered&&this.fields.size===0){

      this._initialNodes=new Map();
      const prepare=(parent,specs,initial)=>{
        const nodes=new Map();this._initialNodes.set(parent,nodes);
        for(const [identity,spec] of fieldEntries(this,parent,specs)){const node=createFieldNode(this,parent,spec,initial);nodes.set(identity,node);if((node.type!=='input'&&Array.isArray(spec.children??[])))prepare(node,spec.children??[],node.value);}
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
  resetForm() { return this._facade.batch('resetForm',()=>{if(!this._ending&&!this.isDestroyed())reset(this.node);}); }
  submit() { if (this._ending || this.isDestroyed()) return Promise.resolve();
    this.el.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return this.lastSubmission;
  }
}

export const FormKitApplication=createFormKitApplication(ExperimentalFormView);

export function mount({ [formKitScope]:providerScope, defaultConfig=true, instrument=false, host, count = 1, fields, values = {}, classes, config, onSubmit, onSubmitInvalid, onSubmitRaw, formProps, inputs, plugins, components, rules, locales, messages, sectionsSchema, theme, icons, iconLoaderUrl, iconLoader, schema, data, slots, schemaSlots } = {}) {
  const region = new Region({ el: host });
  const form = new ExperimentalFormView({ [formKitScope]:providerScope, defaultConfig, instrument, count, fields, values, classes, config, onSubmit, onSubmitInvalid, onSubmitRaw, formProps, inputs, plugins, components, rules, locales, messages, sectionsSchema, theme, icons, iconLoaderUrl, iconLoader, schema, data, slots, schemaSlots, domRoot:(typeof region.el==='string'?region.getEl(region.el):region.el).getRootNode() });
  try{region.show(form);}catch(error){form.destroy();region.destroy();throw error;}
  return { form, node: form.node, metrics: form.metrics, setSchema:schema=>form.setSchema(schema), updateData:data=>form.updateData(data), setSlots:slots=>form.setSlots(slots), setSectionsSchema:sections=>form.setSectionsSchema(sections), getValues:()=>form.getValues(), setValues:(values,options)=>form.setValues(values,options), getFormState:()=>form.getFormState(), setErrors:(errors,fieldErrors)=>form.setErrors(errors,fieldErrors), clearErrors:()=>form.node.clearErrors(), setFields: specs => form.setFields(specs), reset: () => form.resetForm(), submit: () => form.submit(), destroy: () => region.destroy() };
}
