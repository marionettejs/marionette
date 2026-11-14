// Marionette adapter conveniences, not additions to FormKit's upstream API.
import { cloneAny, eq, isPojo } from '@formkit/utils';
const merge = (base,patch)=>Object.fromEntries(Object.entries({...base,...patch}).map(([key,value])=>[key,isPojo(base?.[key]) && isPojo(patch[key]) ? merge(base[key],patch[key]) : value]));
export function installValueFacade(view) {
  const node = view.node, metrics = view.metrics;
  Object.assign(metrics,{valueSnapshots: 0,resetComparisonSnapshots: 0,valueChangeEvents: 0,stateEvents: 0,facadeListeners: 0});
  const pendingInputs = new WeakMap();
  const count = key=>{if (metrics.enabled)metrics[key]++;};
  let dirty = false, source = 'programmatic', operation, dead = false, nativeEvent;
  const snapshot = ()=>{count('valueSnapshots');return cloneAny(node.value);};
  const state = ()=>({submitted: !!node.context?.state.submitted,submitting: !!node.context?.state.loading,valid: node.ledger.value('blocking') === 0,errors: node.store.reduce((items,message)=>message.type === 'error' ? [...items,String(message.value)] : items,[])});
  const listens = ()=>typeof view.onFormChange === 'function' || !!view._rdEvents?.['form:change']?.length || !!view._rdEvents?.all?.length;
  const emitState = ()=>{if (dead) return;count('stateEvents');view.triggerMethod('form:state',state());};
  const committed = event=>{
    if (dead || event.origin !== node) return;
    if (operation) return;
    const changed = dirty;dirty = false;
    if (changed) {const origin = source;source = 'programmatic';if (listens()) {count('valueChangeEvents');view.triggerMethod('form:change',snapshot(),state(),{source: origin});}}
    emitState();
  };
  const topology = ()=>{dirty = true;if (!operation)committed({origin: node});};
  const receipts = [node.on('child.deep',topology),node.on('childRemoved.deep',topology),node.on('input.deep',event=>{
    const origin = operation?.source ?? (nativeEvent?.eventPhase ? 'user' : 'programmatic');
    if (event.origin.type === 'input')pendingInputs.set(event.origin,{value: event.origin.value,source: origin});
    else if (event.origin === node && !eq(node.value,event.payload)) {dirty = true;source = origin;}
  }),node.on('commitRaw.deep',event=>{
    const pending = pendingInputs.get(event.origin);if (!pending) return;pendingInputs.delete(event.origin);
    if (!eq(pending.value,event.payload)) {dirty = true;source = pending.source;}
  }),node.on('commit',committed),...['message-added.deep','message-updated.deep','message-removed.deep'].map(name=>node.on(name,()=>{if (!operation)emitState();}))];
  const capture = event=>{nativeEvent = event;};
  view.el.addEventListener('input',capture,true);view.el.addEventListener('change',capture,true);if (metrics.enabled)metrics.facadeListeners = receipts.length + 2;
  const batch = (name,callback)=>{
    if (dead) return;
    const origin = name === 'resetForm' ? 'reset' : 'programmatic';
    const before = name === 'resetForm' ? (count('resetComparisonSnapshots'),cloneAny(node.value)) : undefined;
    const outer = operation;operation = {source: origin};
    try {return callback();} finally {operation = outer;source = origin;if (name === 'resetForm')dirty = !eq(before,node.value);if (!outer)committed({origin: node});}
  };
  const setValues = (values,options = {})=>{
    if (dead) return view;
    const candidate = merge(node.value,cloneAny(values)),changed = !eq(candidate,node.value),previous = operation;operation = {source: options.source ?? 'programmatic'};
    try {if (changed)node.input(candidate,false);} finally {operation = previous;dirty = false;}
    if (changed && options.notify !== false && listens()) {count('valueChangeEvents');view.triggerMethod('form:change',snapshot(),state(),{source: options.source ?? 'programmatic'});}
    source = 'programmatic';emitState();return view;
  };
  const setErrors = (errors = [],fieldErrors = {})=>{if (dead) return;node.clearErrors();node.setErrors(errors,fieldErrors);};
  const destroy = ()=>{dead = true;for (const receipt of receipts)node.off(receipt);view.el.removeEventListener('input',capture,true);view.el.removeEventListener('change',capture,true);metrics.facadeListeners = 0;};
  return {getValues: snapshot,getFormState: state,setValues,setErrors,batch,destroy};
}
