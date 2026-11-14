// Read-only runtime comparison: deliberately tests ordinary application submission.
import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver']) {globalThis[key] = dom.window[key];}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
const {FormView,SubmissionError} = await import('../current-303ddfbb/index.mjs');
const {createSubmissionController,SubmissionError: CompatError} = await import('./submission-controller.mjs');
const {mount} = await import('./index.mjs');
const pause = ()=>new Promise(resolve=>setTimeout(resolve,10));
async function until(test) {for (let i = 0;i < 100;i++) {if (test()) {return;} await pause();}assert.ok(test(),'bounded semantic wait');}
function setup(arm,callback,valid = true) {
  const options = {fields: [{type: 'text',name: 'x',label: 'X',validation: 'required'}],values: {x: valid ? 'yes' : ''}};
  if (arm === 'original303') {const form = new FormView({...options,submit: callback});form.render();document.querySelector('main').append(form.el);return {form,submit: ()=>form.submit(),reset: ()=>form.resetForm(),destroy: ()=>form.destroy()};}
  const api = mount({...options,host: document.querySelector('main'),onSubmit: callback});const controller = arm === 'compat' ? createSubmissionController(api.form,{submit: callback}) : null;return {...api,submit: controller ? controller.submit : api.submit,reset: ()=>api.form.resetForm()};
}
const observe = promise=>{const record = {status: 'pending'};const done = promise.then(value=>Object.assign(record,{status: 'resolved',value: value ?? '<undefined>'}),error=>Object.assign(record,{status: 'rejected',error: error.message}));return {record,done};};
const results = [];
for (const arm of ['original303','compat','native']) {
  for (const kind of ['success','invalid','error','field-error','hook-error']) {
    let calls = 0,signal = false;const ErrorType = arm === 'compat' ? CompatError : SubmissionError;const expected = new ErrorType('server rejected',{x: ['field rejected']});
    const api = setup(arm,(values,context)=>{calls++;signal = !!context.signal;if (kind === 'error') {throw new Error('failed');} if (kind === 'field-error') {throw expected;} return 'saved';},kind !== 'invalid');
    if (kind === 'hook-error') {api.form.node.hook.submit(()=>{throw new Error('hook failure');});}
    let successEvents = 0,errorEvents = 0,invalidEvents = 0;api.form.on('submit:success',()=>successEvents++);api.form.on('submit:error',()=>errorEvents++);api.form.on('submit:invalid',()=>invalidEvents++);
    await until(()=>api.form.node.ledger.value('blocking') === (kind === 'invalid' ? 1 : 0));api.form.setErrors(['old error']);const attempt = observe(api.submit());await attempt.done;
    if (arm !== 'native') {assert.equal(successEvents,kind === 'success' ? 1 : 0);assert.equal(errorEvents,kind.includes('error') ? 1 : 0);assert.equal(invalidEvents,kind === 'invalid' ? 1 : 0);}
    const rootErrors = api.form.getFormState().errors,fieldErrors = api.form.node.at('x').store.reduce((list,message)=>message.type === 'error' ? [...list,message.value] : list,[]);
    if (arm !== 'native') {assert.equal(attempt.record.value,kind === 'success' ? 'success' : kind === 'invalid' ? 'invalid' : 'error');assert.equal(calls,kind === 'invalid' || kind === 'hook-error' ? 0 : 1);if (kind === 'hook-error') {assert.deepEqual(rootErrors,['hook failure']);} if (kind === 'field-error') {assert.deepEqual(rootErrors,['server rejected']);assert.deepEqual(fieldErrors,['field rejected']);}} else {assert.equal(attempt.record.status,kind.includes('error') ? 'rejected' : 'resolved');/* Native errors do not imply compatibility error clearing. */}
    results.push({arm,case: kind,...attempt.record,calls,signal,rootErrors,fieldErrors});api.destroy();
  }
  for (const action of ['reset','destroy']) {
    let calls = 0;const contexts = [],releases = [];const api = setup(arm,(values,context)=>{calls++;contexts.push(context);return new Promise(resolve=>releases.push(resolve));});
    let lateEvents = 0;api.form.on('submit:success submit:error',()=>lateEvents++);await until(()=>api.form.node.ledger.value('blocking') === 0);const first = observe(api.submit());await until(()=>calls === 1);const second = observe(api.submit());await until(()=>arm !== 'native' ? second.record.status === 'resolved' : calls === 2);
    api[action]();await pause();
    const afterCancel = {first: {...first.record},second: {...second.record},signals: contexts.map(context=>context.signal?.aborted ?? null)};
    if (arm !== 'native') {assert.equal(first.record.value,'cancelled');assert.equal(second.record.value,'busy');assert.deepEqual(afterCancel.signals,[true]);} else {assert.equal(first.record.status,'pending');assert.equal(second.record.status,'pending');}
    releases.forEach(resolve=>resolve('late'));await Promise.all([first.done,second.done]);
    if (arm !== 'native') {assert.equal(lateEvents,0);}results.push({arm,case: action,calls,afterCancel,afterLateCompletion: {first: first.record,second: second.record}});if (action !== 'destroy') {api.destroy();}
  }
}
console.log(JSON.stringify({passed: true,results,limits: ['historical original303, not current-main claim','native alternate uses actual FormKit2.5 official submit handler','no browser timing; no new API implementation','pre-callback validation cancellation and raw callback mutation deliberately not asserted here']},null,2));
