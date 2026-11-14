// FormKit field-schema projection using the official expression compiler.
// DOM layout composition remains owned by schema-layout.mjs.
import { compile } from '@formkit/core';
import { eq } from '@formkit/utils';
import { createObserver } from '@formkit/observer';
import { createSchemaRegistry } from './schema-registry.mjs';

export function createSchemaController({ node, schema, onFields, data = {}, dataOnly = false }) {
  if (!schema || typeof schema !== 'object') throw new TypeError('Schema must be an array or schema object');
  const expressions = new Map(), anonymousKeys = new WeakMap();
  let activeNode, activeScope = {}, currentData = data, dead = false, pending = false, latest, previousFields;
  const registry=createSchemaRegistry(()=>{if(!dead){observer.watch(evaluate,receive);apply(latest);}});
  function read(token) {
    if(token==='get')return registry.get;
    const parts = token.split('.');
    let value = parts[0] in activeScope ? activeScope : parts[0] === 'values'&&!dataOnly ? { values: activeNode.value } : currentData;
    let owner;
    for (const part of parts) { owner = value; value = value?.[part]; }
    return typeof value === 'function' ? value.bind(owner) : value;
  }
  // Unlike literal prop strings, every string condition is an expression.
  function condition(input, locals) {
    return value(typeof input === 'string' && !input.startsWith('$') ? '$: ' + input : input, locals);
  }
  function value(input, locals, key = '') {
    if (typeof input === 'string' && input.length > 1 && input.startsWith('$')) {
      if ((input === '$reset' || input.startsWith('$reset ')) && /(?:class|Class)$/.test(key)) return input; // FormKit class reset directive, not an expression.
      let expression = expressions.get(input);
      if (!expression) { expression = compile(input).provide(tokens => Object.fromEntries(tokens.map(token => [token, () => read(token)]))); expressions.set(input, expression); }
      const old = activeScope; activeScope = locals;
      try { return expression(); } finally { activeScope = old; }
    }
    if (Array.isArray(input)) return input.map(item => value(item, locals));
    if (input && typeof input === 'object') {
      if (Object.hasOwn(input,'if') && Object.hasOwn(input,'then')) return value(condition(input.if,locals) ? input.then : input.else,locals,key);
      return Object.fromEntries(Object.entries(input).map(([key,item]) => key.startsWith('__raw__') ? [key.slice(7),item] : [key,value(item,locals,key)]));
    }
    return input;
  }
  function project(input, locals = {}, loopKeys = [], origin = input) {
    if (input == null || input === false) return [];
    if (Array.isArray(input)) return input.flatMap(entry => project(entry, locals, loopKeys));
    if (typeof input !== 'object') throw new TypeError('Field schema entries must be objects');
    if (input.for) {
      if (!Array.isArray(input.for) || ![2, 3].includes(input.for.length)) throw new TypeError('Schema for requires [value, source] or [value, key, source]');
      const [name] = input.for, keyName = input.for.length === 3 ? input.for[1] : null;
      let items = value(input.for.at(-1), locals);
      if (Number.isFinite(items)) { if (!Number.isInteger(items) || items < 0) throw new TypeError('Numeric schema loop requires a non-negative integer'); items = Array.from({ length: items }, (_, index) => index); }
      if (!items || typeof items !== 'object') return [];
      return Object.keys(items).flatMap(key => project({ ...input, for: undefined }, { ...locals, [name]: items[key], ...(keyName !== null ? { [keyName]: Array.isArray(items) ? Number(key) : key } : {}) }, [...loopKeys,key], origin));
    }
    if (Object.hasOwn(input, 'if') && !condition(input.if, locals)) return project(input.else, locals,loopKeys);
    if (Object.hasOwn(input, 'then') && !Object.hasOwn(input, '$formkit')) return project(input.then, locals,loopKeys);
    if (!Object.hasOwn(input, '$formkit')) throw new TypeError('Use createLayoutController for DOM layout nodes');
    const bound=input.bind?value(input.bind,locals):{};
    if(bound!=null && (typeof bound!=='object'||Array.isArray(bound)))throw new TypeError('Field schema bind must resolve to a props object');
    const type = value(input.$formkit, locals), name = Object.hasOwn(input,'name')?value(input.name, locals):bound?.name;
    if (typeof type !== 'string' || !type || (name!==undefined&&(!['string', 'number'].includes(typeof name) || String(name) === ''))) throw new TypeError('Field schema requires a resolved type and name');
    const field = { ...(bound??{}), type };
    if(name!==undefined)field.name=String(name);else delete field.name;
    if(Object.hasOwn(input,'key'))field.key=value(input.key,locals);
    else if(name===undefined){let keys=anonymousKeys.get(origin);if(!keys){keys=new Map();anonymousKeys.set(origin,keys);}const path=JSON.stringify(loopKeys);if(!keys.has(path))keys.set(path,Symbol('schema field'));field.key=keys.get(path);}
    for (const [key, item] of Object.entries(input)) {
      if (['$formkit', 'name', 'if', 'else', 'for', 'children', 'key', 'bind'].includes(key)) continue;
      // Raw props skip expression interpretation, as in FormKit Schema.
      field[key.startsWith('__raw__') ? key.slice(7) : key] = key.startsWith('__raw__') ? item : value(item, locals,key);
    }
    if (Object.hasOwn(input, 'children')) {
      field.children = Array.isArray(input.children) || ['group', 'list'].includes(type) ? project(input.children, locals,loopKeys) : input.children;
      if(!['group','list'].includes(type)){field.__schemaScope=locals;field.__schemaData=currentData;}
    }
    return [field];
  }
  function validateNames(fields) {
    const names = new Set();
    for (const field of fields) {
      if (field.name!==undefined && names.has(field.name)) throw new TypeError(`Duplicate active schema field: ${field.name}`);
      if(field.name!==undefined)names.add(field.name);
      if (Array.isArray(field.children)) validateNames(field.children ?? []);
    }
  }
  const observer = createObserver(node);
  const apply = fields => { if (dead) return; validateNames(fields); if (eq(previousFields, fields)) return; onFields(fields); previousFields = fields; };
  const evaluate = observed => { activeNode = observed; const fields = project(schema); validateNames(fields); return fields; };
  const receive = fields => { latest = fields; if (pending || dead) return; pending = true; queueMicrotask(() => { pending = false; if (!dead) apply(latest); }); };
  const destroy = () => { if (dead) return; dead = true; registry.destroy(); observer.kill(); node.off(destroyReceipt); };
  const destroyReceipt = node.on('destroyed', destroy);
  try { observer.watch(evaluate, receive); apply(latest); } catch (error) { destroy(); throw error; }
  return {
    destroy,
    // Plain data objects are deliberately not proxied. Call updateData after
    // external state changes; FormKit node dependencies update automatically.
    updateData(next) { if (dead) return; currentData = next ?? {}; observer.watch(evaluate, receive); apply(latest); },
    refresh() { if (dead) return; observer.watch(evaluate, receive); apply(latest); },
    get destroyed() { return dead; }
  };
}
