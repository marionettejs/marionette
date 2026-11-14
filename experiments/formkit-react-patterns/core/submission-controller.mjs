// Explicit application submission compatibility. Native FormKit handlers unchanged.
import {createMessage} from '@formkit/core';
export class SubmissionError extends Error {
  constructor(message,fieldErrors = {}) {super(message);this.name = 'SubmissionError';this.fieldErrors = fieldErrors;}
}
export function createSubmissionController(form,{submit} = {}) {
  if (typeof submit !== 'function') {throw new TypeError('Application submit callback required');}
  const node = form.node;let active,dead = false;
  const alive = attempt=>!dead && active === attempt && !attempt.abort.signal.aborted;
  const cancel = ()=>{if (active) {const attempt = active;active = null;attempt.abort.abort();if (!form._ending && !form.isDestroyed()) {node.props.disabled = attempt.disabled;loading(false);}}};
  const resetReceipt = node.on('reset',cancel);
  const destroy = ()=>{if (dead) {return;}dead = true;cancel();node.off(resetReceipt);form.off('before:destroy',destroy);};
  form.on('before:destroy',destroy);
  async function wait(promise,attempt) {
    const signal = attempt.abort.signal;if (signal.aborted) {return;}
    let release;const cancelled = new Promise(resolve=>{release = ()=>resolve();signal.addEventListener('abort',release,{once: true});});
    try {return await Promise.race([promise,cancelled]);} finally {signal.removeEventListener('abort',release);}
  }
  function state() {form.triggerMethod('form:state',form.getFormState());}
  function loading(value) {if (value) {node.store.set(createMessage({key: 'loading',value: true,visible: false}));} else {node.store.remove('loading');}state();}
  async function run(event) {
    event?.preventDefault();if (dead || form.isDestroyed()) {return 'cancelled';} if (active) {return 'busy';}
    const attempt = {abort: new AbortController(),disabled: node.props.disabled};active = attempt;
    node.clearErrors();const mark = n=>n.store.set(createMessage({key: 'submitted',value: true,visible: false}));mark(node);node.walk(mark);
    loading(true);if (node.props.submitBehavior !== 'live') {node.props.disabled = true;}
    const finish = async()=>{
      // Value and validation settlement are separate upstream contracts. Recheck
      // both after either wait because live controls/topology may have changed.
      do {await wait(node.settled,attempt);if (!alive(attempt)) {return 'cancelled';} await wait(node.ledger.settled('validating'),attempt);if (!alive(attempt)) {return 'cancelled';}}
      while (!node.isSettled || node.ledger.value('validating'));
      node.emit('submit-raw');node.props.onSubmitRaw?.(event,node);
      // Raw callback mutation/reentrant destruction is not a compatibility promise.
      if (!alive(attempt)) {return 'cancelled';}
      if (node.ledger.value('blocking')) {
        node.props.onSubmitInvalid?.(node);
        if (node.props.incompleteMessage !== false) {node.store.set(createMessage({key: 'incomplete',type: 'ui',blocking: false,value: node.props.incompleteMessage ?? 'Form incomplete.',meta: {localize: node.props.incompleteMessage === undefined,i18nArgs: [{node}],showAsMessage: true}}));}
        form.triggerMethod('submit:invalid',form.getValues());return 'invalid';
      }
      try {const values = node.hook.submit.dispatch(form.getValues());const result = await submit(values,{node,signal: attempt.abort.signal});if (!alive(attempt)) {return 'cancelled';}form.triggerMethod('submit:success',values,result);return 'success';} catch (error) {if (!alive(attempt)) {return 'cancelled';}form.setErrors([error instanceof Error ? error.message : 'Unable to submit.'],error instanceof SubmissionError ? error.fieldErrors : {});form.triggerMethod('submit:error',error);return 'error';}
    };
    try {return await wait(finish(),attempt) ?? 'cancelled';} finally {
      if (active === attempt) {
        active = null;node.props.disabled = attempt.disabled;loading(false);
        // Context stores publish DOM disabled/validation state in a microtask.
        await Promise.resolve();
        const invalidIds = new Set();if (!dead && !form.isDestroyed()) {node.walk(child=>{if (child.type === 'input' && child.ledger.value('blocking')) {invalidIds.add(child.props.id);}});}
        if (!dead && !form.isDestroyed()) {for (const control of form.el.querySelectorAll('input,select,textarea')) {if (!invalidIds.has(control.id)) {continue;} if (control.isConnected && !control.matches(':disabled,input[type="hidden"]') && !control.closest('[hidden],[inert]')) {control.focus();if (document.activeElement === control) {break;}}}}
      }
    }
  }
  return {submit: run,cancel,destroy,get pending() {return !!active;}};
}
