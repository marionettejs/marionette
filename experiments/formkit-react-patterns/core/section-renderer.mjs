// Official FormKit section-schema interpreter for the text-definition slice.
// Expression/provider pattern follows FormKit React 2.5 (MIT: LICENSE.formkit).
import { compile } from '@formkit/core';
import { subscribeReactiveStore } from './upstream-bindings.mjs';

export function renderSections({host,schema,context,metrics}) {
  let dead=false;const effects=new Set();
  const metric=key=>metrics[key]=(metrics[key]??0)+1;
  function scope(){const disposers=[];return {add:fn=>disposers.push(fn),destroy(){for(const fn of disposers.splice(0).reverse())fn();}};}
  const root=scope();
  function read(path,locals){let object=locals,parts=path.split('.');if(!(parts[0] in locals))object=context;for(const part of parts){if(object==null)return undefined;object=object[part];}return object;}
  function binding(value,locals,owner,apply){
    if(typeof value!=='string'||!value.startsWith('$')){apply(value);return;}
    let tokens=[],last=[],initialized=false;
    // Context bags mutate in place upstream; compare their enumerable entries,
    // not just bag identity. No cloning of aggregate form values occurs here.
    const snapshot=value=>value&&typeof value==='object'?Object.entries(value):value;
    const equal=(a,b)=>Array.isArray(a)&&Array.isArray(b)?a.length===b.length&&a.every(([k,v],i)=>k===b[i][0]&&Object.is(v,b[i][1])):Object.is(a,b);
    const fn=compile(value).provide(required=>{tokens=required;return Object.fromEntries(required.map(token=>[token,()=>read(token,locals)]));});
    const effect=(force=false)=>{if(dead)return;const next=tokens.map(token=>{metric('tokenChecks');return snapshot(read(token,locals));});
      if(!force&&initialized&&next.every((v,i)=>equal(v,last[i])))return;last=next;initialized=true;metric('expressionEvaluations');apply(fn());};
    effects.add(effect);owner.add(()=>effects.delete(effect));effect(true);
  }
  function range(parent,before,owner){const start=document.createComment('section'),end=document.createComment('/section');parent.insertBefore(start,before);parent.insertBefore(end,before);owner.add(()=>{let n=start;while(n){const next=n.nextSibling;n.remove();if(n===end)break;n=next;}});return {start,end};}
  function draw(entry,parent,before,locals,owner){
    if(entry==null||entry===false)return;
    if(Array.isArray(entry)){for(const child of entry)draw(child,parent,before,locals,owner);return;}
    if(typeof entry!=='object'){const text=document.createTextNode('');parent.insertBefore(text,before);owner.add(()=>text.remove());binding(entry,locals,owner,value=>{const next=value==null?'':String(value);if(text.data!==next){text.data=next;metric('domWrites');}});return;}
    if(entry.for){const [name,source]=entry.for;const bounds=range(parent,before,owner);let children=scope();owner.add(()=>children.destroy());binding(source,locals,owner,values=>{children.destroy();children=scope();metric('structuralChanges');for(const [key,value]of Object.entries(values??{})){const inner=Object.assign(Object.create(locals),{[name]:value});draw({...entry,for:undefined},parent,bounds.end,inner,children);}});return;}
    if(Object.hasOwn(entry,'if')){const bounds=range(parent,before,owner);let child=scope(),previous;owner.add(()=>child.destroy());const yes=Object.hasOwn(entry,'then')?entry.then:Object.fromEntries(Object.entries(entry).filter(([key])=>key!=='if'));binding(entry.if,locals,owner,value=>{const flag=!!value;if(flag===previous)return;previous=flag;child.destroy();child=scope();metric('structuralChanges');draw(flag?yes:entry.else,parent,bounds.end,locals,child);});return;}
    if(!Object.hasOwn(entry,'$el'))throw new TypeError('Unsupported official section node');
    if(entry.$el===null)return;
    if(typeof entry.$el!=='string'||entry.$el.startsWith('$'))throw new TypeError('Dynamic section tag unsupported');
    const element=document.createElement(entry.$el);parent.insertBefore(element,before);owner.add(()=>element.remove());
    const listeners=new Map();owner.add(()=>{for(const [name,fn]of listeners)element.removeEventListener(name,fn);});
    function attr(name,value){if(name==='key')return;if(/^on[A-Z]/.test(name)){const event=name.slice(2).toLowerCase();const previous=listeners.get(event);if(previous===value)return;if(previous)element.removeEventListener(event,previous);if(typeof value==='function'){element.addEventListener(event,value);listeners.set(event,value);}else listeners.delete(event);return;}
      if(name==='innerHTML'){if(value)throw new TypeError('Raw icon HTML outside supported text slice');return;}
      if(name==='value'){const next=String(value??'');if(element.value!==next){element.value=next;metric('domWrites');}return;}
      if(name==='disabled'){const next=!!value&&value!=='false';if(element.disabled!==next){element.disabled=next;metric('domWrites');}return;}
      if(value===undefined||value===null||value===false){if(element.hasAttribute(name)){element.removeAttribute(name);metric('domWrites');}}else{const next=String(value);if(element.getAttribute(name)!==next){element.setAttribute(name,next);metric('domWrites');}}
    }
    // Explicit schema attrs override `bind`, even when their dependencies did
    // not change on this notification. Never let the lower-priority bag write
    // those attributes (or remove them when the bag is cleared).
    const explicitAttrs=new Set(Object.keys(entry.attrs??{}));
    let boundKeys=[];if(entry.bind)binding(entry.bind,locals,owner,values=>{for(const key of boundKeys)if(!(key in(values??{})))attr(key,undefined);boundKeys=Object.keys(values??{}).filter(key=>!explicitAttrs.has(key));for(const key of boundKeys)attr(key,values[key]);});
    for(const[name,value]of Object.entries(entry.attrs??{})){
      if(value&&typeof value==='object'&&Object.hasOwn(value,'if')){binding(value.if,locals,owner,test=>attr(name,test?value.then:value.else));}
      else binding(value,locals,owner,next=>attr(name,next));
    }
    draw(entry.children,element,null,locals,owner);
  }
  draw(schema,host,null,{},root);
  const unsubscribe=subscribeReactiveStore(context,()=>{if(dead)return;metric('contextNotifications');for(const effect of [...effects])if(effects.has(effect))effect();});
  return {refresh(){for(const effect of [...effects])if(effects.has(effect))effect(true);},destroy(){if(dead)return;dead=true;unsubscribe();root.destroy();effects.clear();}};
}
