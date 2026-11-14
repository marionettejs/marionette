import { providerBoundary, nativeFormKitFactory } from './provider-scope.mjs';
// Bounded DOM-layout composition over the existing sole FormKit node owner.
import { compile } from '@formkit/core';
import { createObserver } from '@formkit/observer';
import { createSchemaController } from './schema.mjs';
import { renderSections } from './section-renderer.mjs';
import { createSchemaRegistry } from './schema-registry.mjs';
export function createLayoutController({form,schema,data:externalData={},components={},slots:externalSlots={}}){
  const layoutData=form._schemaDataOnly?{...externalData}:{...externalData,get values(){return form.node.value;}};
  const reserved=new Set(['get','slots','__ownedKey',...(form._schemaDataOnly?[]:['values'])]);
  const registry=createSchemaRegistry(()=>{if(!dead){renderer?.refresh();form._placeSchemaFields?.();}});
  const fieldIdentities=new Map();layoutData.__ownedKey=(...parts)=>{const key=JSON.stringify(parts);if(!fieldIdentities.has(key))fieldIdentities.set(key,Symbol('layout field'));return fieldIdentities.get(key);};
  layoutData.get=registry.get;layoutData.slots=externalSlots;
  const slots={...externalSlots},outlets=new Map();let next=0;
  function expression(value){if(typeof value==='string'&&value.startsWith('$'))compile(value);else if(value&&typeof value==='object')Object.values(value).forEach(expression);}
  function resolved(value,scope={}){
    if(value&&typeof value==='object'&&Object.hasOwn(value,'if')&&Object.hasOwn(value,'then'))return resolved(resolved(value.if,scope)?value.then:value.else,scope);
    if(typeof value!=='string'||value.length<2||!value.startsWith('$'))return value;
    return compile(value).provide(tokens=>Object.fromEntries(tokens.map(token=>[token,()=>{const parts=token.split('.');let object=parts[0] in scope?scope:layoutData,owner;for(const part of parts){owner=object;object=object?.[part];}return typeof object==='function'?object.bind(owner):object;}])))();
  }
  // A presentation owns DOM only. Child Core nodes remain in the native
  // group's existing field map and return to its default outlet on teardown.
  function childPresentation(field, schema, locals) {
    const host=document.createElement('div');host.dataset.formkitLayout='';if(form._schemaDataOnly)host.style.display='contents';
    let lexical=locals,closed=false;
    const data=Object.create(layoutData);
    for(const key in lexical)Object.defineProperty(data,key,{get:()=>lexical[key],configurable:true});
    const scopedSlots=Object.fromEntries(Object.entries(slots).map(([name,slot])=>[name,args=>{
      const scoped=()=>({...args,fields:field.children,locals:Object.assign(Object.create(lexical),args.locals)});
      const instance=slot(scoped());
      return instance&&typeof instance==='object'?{...instance,update:()=>instance.update?.(scoped())}:instance;
    }]));
    const place=()=>{const anchor=field.childAnchor;if(anchor?.parentNode&&host.parentNode!==anchor.parentNode)anchor.parentNode.insertBefore(host,anchor);};
    place();
    let nested;
    try{nested=renderSections({host,schema,context:form._schemaDataOnly?{}:{node:field.node},data,slots:scopedSlots,components,configScope:form._configScopes.get(field.node),domRoot:field.node.props.__root,parentNode:form._schemaParent?field.node:undefined,metrics:form.metrics});}
    catch(error){host.remove();throw error;}
    // Native section-schema redraws replace the child anchor, retaining owners.
    const receipt=field.node.on('schema',event=>{if(event.origin===field.node)queueMicrotask(()=>{if(!closed&&!dead){place();nested.refresh();form._placeSchemaFields?.();}});});
    return {update(next){lexical=next;place();nested.update();},destroy(remove=true){if(closed)return;closed=true;field.node.off(receipt);
      const anchor=field.childAnchor;if(remove&&anchor?.parentNode)for(const child of field.children.values())anchor.parentNode.insertBefore(child.el,anchor);
      nested.destroy(remove);if(remove)host.remove();
    }};
  }
  const isProvider=entry=>!!(typeof entry?.$cmp==='string'?components[entry.$cmp]:entry?.$cmp)?.[providerBoundary];
  function containsProvider(entry){
    if(Array.isArray(entry))return entry.some(containsProvider);
    if(!entry||typeof entry!=='object')return false;
    if(isProvider(entry))return true;
    if('$formkit'in entry||entry.$cmp==='FormKit')return false;
    return ['children','then','else'].some(key=>containsProvider(entry[key]));
  }
  function parse(entry,loopAliases=[]){
    // Siblings in this Core scope must be allocated in declaration order. An
    // opaque provider therefore makes its sibling array an opaque DOM scope too.
    if(Array.isArray(entry)&&containsProvider(entry))return{fields:[],dom:entry};
    if(Array.isArray(entry)){const entries=entry.map(child=>parse(child,loopAliases));return {fields:entries.flatMap(x=>x.fields),dom:entries.map(x=>x.dom)};}
    if(typeof entry==='string'||typeof entry==='number'){expression(entry);return{fields:[],dom:entry};}
    if(entry==null||entry===false)return{fields:[],dom:null};
    if(typeof entry!=='object')throw new TypeError('Unsupported layout node');
    if(entry.for){const alias=entry.for.length===3?entry.for[1]:`__layoutIndex${next++}`,iterator=entry.for.length===3?entry.for:[entry.for[0],alias,entry.for[1]];const parsed=parse({...entry,for:undefined},[...loopAliases,alias]);return{fields:[{for:iterator,then:parsed.fields}],dom:{$el:null,for:iterator,attrs:{key:entry.key??entry.attrs?.key??entry.props?.key??(entry.$formkit?entry.name:undefined)},children:parsed.dom}};}

    // Explicit built-in FormKit declarations share the native owner map. This
    // preserves edited values/DOM when Schema presentation or memoKey changes.
    // Custom factories and expression-bound props retain the opaque route.
    if(entry.$cmp==='FormKit'&&components.FormKit?.[nativeFormKitFactory]&&!entry.bind&&entry.props&&typeof entry.props==='object'&&!Array.isArray(entry.props)){
      // Non-container children are a default slot, not native field arrays.
      // Keep that factory boundary; ordinary inputs and named slots still use
      // retained native ownership, as do group/list child compositions.
      const children=entry.children;
      const namedSlots=children&&typeof children==='object'&&!Array.isArray(children)&&!['$el','$cmp','$formkit','if','for'].some(key=>key in children);
      if(children!==undefined&&!namedSlots&&!['group','list'].includes(entry.props.type))return{fields:[],dom:entry};
      const props=Object.getOwnPropertyDescriptors(entry.props),source=Object.getOwnPropertyDescriptors(entry);
      for(const key of Object.keys(props))props[key]={...props[key],enumerable:true};
      const type=props.type??{value:'text',enumerable:true,configurable:true};delete props.type;
      for(const key of ['if','for','children'])if(source[key])props[key]=source[key];
      props.$formkit=type;entry=Object.create(Object.getPrototypeOf(entry),props);
    }
    if('$formkit'in entry){
      // A declared name can resolve to undefined; share an identity with projection.
      if(!Object.hasOwn(entry,'key'))entry=Object.defineProperty(Object.create(Object.getPrototypeOf(entry),Object.getOwnPropertyDescriptors(entry)),'key',{value:`$__ownedKey('declaration${next++}'${loopAliases.map(alias=>`, $${alias}`).join('')})`,enumerable:true});
      let slot;do{slot=`__ownedField${next++}`;}while(Object.hasOwn(slots,slot));
      const nativeChildren=Object.hasOwn(entry,'children')&&(['group','list'].includes(entry.$formkit)||(typeof entry.$formkit==='string'&&entry.$formkit.startsWith('$')&&Array.isArray(entry.children)))?parse(entry.children):undefined;
      slots[slot]=({parent,before,locals={},fields=form.fields})=>{
        const anchor=document.createComment('owned field'),outlet=Symbol(slot);parent.insertBefore(anchor,before);
        let current,presentation;
        const update=({locals:scope=locals}={})=>{
          const name=Object.hasOwn(entry,'name')?resolved(entry.name,scope):resolved(entry.bind,scope)?.name;
          const identity=entry.key!==undefined?resolved(entry.key,scope):undefined;const field=name!==undefined?fields.get(String(name)):[...fields.values()].find(field=>field.spec.key===identity);if(!field)throw new Error(`Missing owned layout field: ${name}`);
          if(field.el.nextSibling!==anchor)anchor.parentNode.insertBefore(field.el,anchor);
          if(current!==field){presentation?.destroy();current=field;presentation=nativeChildren&&['group','list'].includes(field.node.props.type)?childPresentation(field,nativeChildren.dom,scope):undefined;}
          presentation?.update(scope);outlets.set(outlet,{fields,name:name===undefined?undefined:String(name),identity,anchor});
        };
        update();return{update,destroy(remove=true){presentation?.destroy(remove);outlets.delete(outlet);if(remove)anchor.remove();}};
      };
      return{fields:[nativeChildren?{...entry,children:nativeChildren.fields}:entry],dom:entry.if?{if:entry.if,then:`$slots.${slot}`} : `$slots.${slot}`};
    }
    // FormKit creates a Core owner and renders its own child scope. Projecting
    // its descendants here would allocate them before that parent exists.
    if(entry.$cmp==='FormKit'||isProvider(entry))return{fields:[],dom:entry};
    if('$el'in entry||'$cmp'in entry){
      if('$el'in entry&&entry.$el!==null&&(typeof entry.$el!=='string'||!entry.$el))throw new TypeError('Layout element must be a tag or expression');
      for(const key of Object.keys(entry))if(!['$el','$cmp','attrs','props','children','bind','if','for','key'].includes(key))throw new TypeError(`Unsupported layout key: ${key}`);
      for(const key of Object.keys(entry.attrs??{}))if(key==='innerHTML')throw new TypeError('Layout raw HTML unsupported');
      expression(entry.attrs);expression(entry.props);expression(entry.bind);expression(entry.if);
      const children=parse(entry.children??[],loopAliases);return{fields:entry.if?[{if:entry.if,then:children.fields}]:children.fields,dom:{...entry,children:children.dom}};
    }
    if('if'in entry&&'then'in entry){
      for(const key of Object.keys(entry))if(!['if','then','else','for'].includes(key))throw new TypeError(`Unsupported layout condition key: ${key}`);
      const yes=parse(entry.then,loopAliases),no=parse(entry.else??[],loopAliases);return{fields:[{if:entry.if,then:yes.fields,else:no.fields}],dom:{if:entry.if,then:yes.dom,else:no.dom}};
    }
    throw new TypeError('Only layout elements, supported FormKit nodes and conditions allowed');
  }
  if(form._placeSchemaFields)throw new TypeError('Only one layout controller per form');
  const parsed=form._opaqueSchema?{fields:[],dom:schema}:parse(schema),host=document.createElement('div');host.dataset.formkitLayout='';if(form._schemaDataOnly)host.style.display='contents';
  let renderer,observer,controller,dead=false,pending=false;
  const destroy=()=>{if(dead)return;dead=true;form.off('before:destroy',destroy);delete form._placeSchemaFields;delete form._layoutController;registry.destroy();controller?.destroy();observer?.kill();
    // Restore owned fields before removing their presentation-only containers.
    if(!form._ending)for(const field of form.fields.values())form._fieldAnchor.parentNode.insertBefore(field.el,form._fieldAnchor);
    renderer?.destroy(!form._ending);if(!form._ending)host.remove();
  };
  try{
    form._placeSchemaFields=()=>{for(const {fields,name,identity,anchor}of outlets.values()){const field=name!==undefined?fields.get(name):[...fields.values()].find(field=>field.spec.key===identity);if(field&&field.el.nextSibling!==anchor)anchor.parentNode.insertBefore(field.el,anchor);}};
    controller=createSchemaController({node:form.node,schema:parsed.fields,data:layoutData,dataOnly:form._schemaDataOnly,onFields:fields=>form.setFields(fields)});
    form._fieldAnchor.parentNode.insertBefore(host,form._fieldAnchor);
    observer=createObserver(form.node);
    renderer=renderSections({host,schema:parsed.dom,context:form._schemaDataOnly?{}:{node:form.node},data:layoutData,slots,components,configScope:form._providerScope,domRoot:form._domRoot,parentNode:form._schemaParent,metrics:form.metrics});
    observer.watch(current=>current.value,()=>{
      if(pending||dead)return;pending=true;queueMicrotask(()=>{pending=false;if(!dead)renderer.update();});
    });
    form.on('before:destroy',destroy);
  }catch(error){destroy();throw error;}
  const api={destroy,detach(){host.remove();},place(){if(dead)return;const anchor=form._fieldAnchor;if(host.nextSibling!==anchor)anchor.parentNode.insertBefore(host,anchor);form._placeSchemaFields();},updateData(next={}){if(dead)return;for(const key of Object.keys(layoutData))if(!reserved.has(key))delete layoutData[key];for(const[key,value]of Object.entries(next))if(!reserved.has(key))layoutData[key]=value;controller.updateData(layoutData);renderer.update();form._placeSchemaFields();},get destroyed(){return dead;}};
  form._layoutController=api;return api;
}
