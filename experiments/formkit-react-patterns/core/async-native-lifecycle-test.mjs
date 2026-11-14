import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
const {mount} = await import('./index.mjs'),{getNode} = await import('@formkit/core');
const pause = ()=>new Promise(resolve=>setTimeout(resolve,15)),until = async predicate=>{for (let i = 0;i < 200;i++) {if (predicate()) {return;} await pause();}assert.ok(predicate(),'bounded async state wait');};
const deferred = ()=>{let resolve;const promise = new Promise(done=>resolve = done);return {promise,resolve};};
const validations = [],application = deferred(),options = deferred();let calls = 0,payload,loaderCalls = 0;
const slow = node=>new Promise(resolve=>validations.push({value: node.value,resolve}));
const fields = [{name: 'email',validation: 'slow'},{name: 'choice',type: 'select',options: ()=>{loaderCalls++;return options.promise;}}];
const api = mount({host: document.querySelector('main'),fields,values: {email: 'seed'},rules: {slow},config: {delay: 0},onSubmit: values=>{calls++;payload = values;return application.promise;}});
try {
  await until(()=>validations.some(item=>item.value === 'seed'));const email = api.node.at('email'),input = api.form.el.querySelector('input');
  assert.equal(loaderCalls,0,'official free select stores a loader; it does not invent network execution');assert.equal(typeof api.node.at('choice').props.optionsLoader,'function');
  // Establish the official rule observer's dependencies before testing supersession.
  for (const item of validations.filter(item=>item.value === 'seed')) {item.resolve(true);} await until(()=>email.ledger.value('validating') === 0);
  email.input('stale',false);await until(()=>validations.some(item=>item.value === 'stale'));
  email.input('latest',false);await until(()=>validations.some(item=>item.value === 'latest'));
  for (const item of validations.filter(item=>item.value === 'stale')) {item.resolve(false);} await pause();assert.ok(email.ledger.value('validating') > 0);assert.equal(calls,0);
  const pending = api.submit();await until(()=>api.node.context.state.loading);
  const deliver = options.promise.then(values=>api.setFields([fields[0],{...fields[1],options: values}]));options.resolve(['Alpha','Beta']);await deliver;await until(()=>api.node.at('choice').value === 'Alpha');
  for (const item of validations.filter(item=>item.value === 'latest')) {item.resolve(true);}
  await until(()=>calls === 1);assert.equal(payload.email,'latest');assert.equal(payload.choice,'Alpha');assert.equal(input.disabled,true);assert.equal(api.node.at('email'),email);
  payload.email = 'mutated callback copy';assert.equal(email.value,'latest');
  // Native reset changes state/value; it does not cancel the application callback.
  api.reset();await until(()=>email.value === 'seed');assert.equal(calls,1);for (let i = 0;i < 20;i++) {for (const item of validations) {item.resolve(true);} await pause();if (!email.ledger.value('validating')) {break;}}assert.equal(email.ledger.value('validating'),0);
  application.resolve();await pending;await until(()=>!api.node.context.state.loading);assert.equal(input.disabled,false);assert.equal(api.node.context.state.submitted,false);
  email.input('removed',false);await until(()=>validations.some(item=>item.value === 'removed'));const id = email.props.id;
  api.setFields([{name: 'choice',type: 'select',options: ['Alpha','Beta']}]);assert.equal(getNode(id),undefined);for (const item of validations) {item.resolve(false);} await pause();await pause();
  assert.equal(api.node.at('email'),undefined);assert.equal(api.form.el.querySelector('input'),null);assert.equal(api.node.value.email,undefined);assert.equal(calls,1);
} finally {for (const item of validations) {item.resolve(true);}application.resolve();api.destroy();dom.window.close();}
console.log('async native lifecycle: stale validation result, externally resolved select options, submit waits, detached payload, reset during native submission, and pending-rule removal passed');
