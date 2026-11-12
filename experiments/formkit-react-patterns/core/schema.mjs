// Narrow FormKit Schema projection. Uses official compile/provide expression API
// as upstream React FormKitSchema does. MIT attribution: LICENSE.formkit.
import { compile } from '@formkit/core';
import { eq } from '@formkit/utils';
import { createObserver } from '@formkit/observer';

const fieldKeys = new Set(['$formkit','name','label','help','validation','disabled','validationVisibility','if','children','options','placeholder','onValue','offValue']);
const branchKeys = new Set(['if','then','else']);
export function createSchemaController({ node, schema, onFields }) {
  if (!Array.isArray(schema)) throw new TypeError('Schema must be an array');
  const permanent=new Set();
  function collect(entries,path=[]){for(const entry of entries){if(!entry||!entry.$formkit||Object.hasOwn(entry,'if'))continue;const address=[...path,entry.name];if(entry.$formkit==='group')collect(entry.children??[],address);else permanent.add(address.join('.'));}}
  collect(schema);
  let activeNode;
  const declaredNames=new Set();
  function condition(expression) {
    if (typeof expression !== 'string' || !expression.startsWith('$')) throw new TypeError('Condition must be a FormKit expression');
    return compile(expression).provide(tokens => Object.fromEntries(tokens.map(token => {
      const parts = token.split('.');
      if (parts.length < 2 || parts[0] !== 'values' || !permanent.has(parts.slice(1).join('.'))) throw new TypeError(`Unsupported schema dependency: ${token}; use $values.<always-present-field>`);
      return [token, () => parts.slice(1).reduce((value,key)=>value?.[key],activeNode.value)];
    })));
  }
  function prop(value){
    if(typeof value==='string'&&value.startsWith('$'))return condition(value);
    if(Array.isArray(value)){const reads=value.map(prop);return()=>reads.map(read=>read());}
    if(value&&typeof value==='object'){const reads=Object.entries(value).map(([key,value])=>[key,prop(value)]);return()=>Object.fromEntries(reads.map(([key,read])=>[key,read()]));}
    return()=>value;
  }
  function parse(entry,path=[]) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new TypeError('Schema entries must be field or conditional objects');
    if (Object.hasOwn(entry,'$formkit')) {
      for (const key of Object.keys(entry)) if (!fieldKeys.has(key)) throw new TypeError(`Unsupported field schema key: ${key}`);
      if (!['text','textarea','checkbox','select','group'].includes(entry.$formkit) || typeof entry.name !== 'string' || !entry.name || entry.name.startsWith('$')) throw new TypeError('Only supported named literal input/group types allowed');
      if(entry.$formkit==='select'&&entry.options===undefined)throw new TypeError('Select schema requires options');
      const address=[...path,entry.name],key=address.join('.');
      if(declaredNames.has(key))throw new TypeError(`Duplicate declared schema field: ${key}`);declaredNames.add(key);
      if(entry.$formkit!=='group'&&entry.children!==undefined)throw new TypeError('Input children/slots unsupported');
      const children=entry.$formkit==='group'?parseBranch(entry.children??[],address):null;
      const test=Object.hasOwn(entry,'if')?condition(entry.if):()=>true;
      const reads=Object.entries(entry).filter(([key])=>!['$formkit','if','children','name'].includes(key)).map(([key,value])=>[key,prop(value)]);
      let previous;
      return()=>{
        if(!test())return [];
        const next={name:entry.name,type:entry.$formkit,...Object.fromEntries(reads.map(([key,read])=>[key,read()]))};
        if(children)next.children=children();
        if(!eq(previous,next))previous=next;
        return [previous];
      };
    }
    for (const key of Object.keys(entry)) if (!branchKeys.has(key)) throw new TypeError(`Unsupported branch key: ${key}`);
    if (!Object.hasOwn(entry,'then')) throw new TypeError('Conditional requires then');
    const test=condition(entry.if), yes=parseBranch(entry.then,path), no=parseBranch(entry.else ?? [],path);
    return () => test() ? yes() : no();
  }
  function parseBranch(branch,path=[]) { const entries=(Array.isArray(branch)?branch:[branch]).map(entry=>parse(entry,path)); return () => entries.flatMap(read=>read()); }
  const evaluate=parseBranch(schema);
  const observer=createObserver(node);
  let dead=false,pending=false,latest,previousFields;
  const apply=fields=>{
    if(dead)return;
    const names=new Set();for(const field of fields){if(names.has(field.name))throw new TypeError(`Duplicate active schema field: ${field.name}`);names.add(field.name);}
    if(eq(previousFields,fields))return;onFields(fields);previousFields=fields;
  };
  const destroy=()=>{if(dead)return;dead=true;observer.kill();node.off(destroyReceipt);};
  const destroyReceipt=node.on('destroyed',destroy);
  // Initial projection is synchronous; later notifications coalesce outside Core's
  // dispatch to avoid topology mutation while an observer is collecting reads.
  observer.watch(observed=>{activeNode=observed;return evaluate();}, fields=>{
    latest=fields;if(pending||dead)return;pending=true;queueMicrotask(()=>{pending=false;if(!dead)apply(latest);});
  });
  try { apply(latest); } catch(error) { destroy();throw error; }
  return { destroy, get destroyed(){return dead;} };
}
