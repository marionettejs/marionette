// Narrow FormKit Schema projection. Uses official compile/provide expression API
// as upstream React FormKitSchema does. MIT attribution: LICENSE.formkit.
import { compile } from '@formkit/core';
import { createObserver } from '@formkit/observer';

const fieldKeys = new Set(['$formkit','name','label','validation','disabled','validationVisibility','if']);
const branchKeys = new Set(['if','then','else']);
export function createSchemaController({ node, schema, onFields }) {
  if (!Array.isArray(schema)) {throw new TypeError('Schema must be an array');}
  const permanent = new Set(schema.filter(x => x && x.$formkit === 'text' && !Object.hasOwn(x,'if')).map(x=>x.name));
  let activeNode;
  const declaredNames = new Set();
  function condition(expression) {
    if (typeof expression !== 'string' || !expression.startsWith('$')) {throw new TypeError('Condition must be a FormKit expression');}
    return compile(expression).provide(tokens => Object.fromEntries(tokens.map(token => {
      const parts = token.split('.');
      if (parts.length !== 2 || parts[0] !== 'values' || !permanent.has(parts[1])) {throw new TypeError(`Unsupported schema dependency: ${token}; use $values.<always-present-field>`);}
      return [token, () => activeNode.value[parts[1]]];
    })));
  }
  function parse(entry) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {throw new TypeError('Schema entries must be field or conditional objects');}
    if (Object.hasOwn(entry,'$formkit')) {
      for (const key of Object.keys(entry)) {if (!fieldKeys.has(key)) {throw new TypeError(`Unsupported field schema key: ${key}`);}}
      if (entry.$formkit !== 'text' || typeof entry.name !== 'string' || !entry.name || entry.name.startsWith('$')) {throw new TypeError('Only named literal text fields supported');}
      if (declaredNames.has(entry.name)) {throw new TypeError(`Duplicate declared schema field: ${entry.name}`);}declaredNames.add(entry.name);
      for (const key of ['label','validation']) {if (entry[key] !== undefined && (typeof entry[key] !== 'string' || entry[key].startsWith('$'))) {throw new TypeError(`${key} must be literal text`);}}
      if (entry.disabled !== undefined && typeof entry.disabled !== 'boolean') {throw new TypeError('disabled must be literal boolean');}
      if (entry.validationVisibility !== undefined && entry.validationVisibility !== 'live') {throw new TypeError('Only live validation visibility supported');}
      const test = Object.hasOwn(entry,'if') ? condition(entry.if) : () => true;
      const { $formkit, if: ignored, ...props } = entry;
      return () => test() ? [{...props,type: $formkit}] : [];
    }
    for (const key of Object.keys(entry)) {if (!branchKeys.has(key)) {throw new TypeError(`Unsupported branch key: ${key}`);}}
    if (!Object.hasOwn(entry,'then')) {throw new TypeError('Conditional requires then');}
    const test = condition(entry.if), yes = parseBranch(entry.then), no = parseBranch(entry.else ?? []);
    return () => test() ? yes() : no();
  }
  function parseBranch(branch) { const entries = (Array.isArray(branch) ? branch : [branch]).map(parse); return () => entries.flatMap(read=>read()); }
  const evaluate = parseBranch(schema);
  const observer = createObserver(node);
  let dead = false,pending = false,latest,signature;
  const apply = fields=>{
    if (dead) {return;}
    const names = new Set();for (const field of fields) {if (names.has(field.name)) {throw new TypeError(`Duplicate active schema field: ${field.name}`);}names.add(field.name);}
    const next = JSON.stringify(fields);if (next === signature) {return;}signature = next;onFields(fields);
  };
  const destroy = ()=>{if (dead) {return;}dead = true;observer.kill();node.off(destroyReceipt);};
  const destroyReceipt = node.on('destroyed',destroy);
  // Initial projection is synchronous; later notifications coalesce outside Core's
  // dispatch to avoid topology mutation while an observer is collecting reads.
  observer.watch(observed=>{activeNode = observed;return evaluate();}, fields=>{
    latest = fields;if (pending || dead) {return;}pending = true;queueMicrotask(()=>{pending = false;if (!dead) {apply(latest);}});
  });
  try { apply(latest); } catch (error) { destroy();throw error; }
  return { destroy, get destroyed() {return dead;} };
}
