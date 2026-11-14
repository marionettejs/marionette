import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
import { inputs } from '@formkit/inputs';
const dom = new JSDOM('<!doctype html><body><div id="host"></div>',{url: 'http://localhost'});
for (const name of ['window','document','Node','Element','HTMLElement','HTMLFormElement','HTMLInputElement','Event','CustomEvent','MutationObserver']) {globalThis[name] = dom.window[name];}
const { mount } = await import('./index.mjs');
const tick = ()=>new Promise(r=>setTimeout(r,25));
let invalid = 0,raw = 0,submitted = [];
const instance = mount({host: document.querySelector('#host'),count: 1,values: {field0: ''},onSubmitInvalid: ()=>invalid++,onSubmitRaw: ()=>raw++,onSubmit: value=>{submitted.push(value);value.field0 = 'mutated callback copy';}});
assert.deepEqual(instance.node.props.definition.features,inputs.form.features); assert.equal(instance.node.props.isForm,true); assert.deepEqual(instance.node.children[0].props.definition.features,inputs.text.features);
await tick();await instance.submit();await tick();assert.equal(raw,1);assert.equal(invalid,1);assert.equal(submitted.length,0);assert.equal(instance.node.store.submitted.value,true);assert.ok(instance.form.formMessages.textContent.length > 0);
await instance.node.at('field0').input('valid');await tick();await instance.submit();assert.equal(raw,2);assert.equal(invalid,1);assert.equal(submitted.length,1);assert.equal(instance.node.value.field0,'valid');
instance.reset();await tick();assert.equal(instance.node.value.field0,'');assert.equal(instance.node.store.submitted?.value,false);instance.destroy();
console.log(JSON.stringify({passed: true,checks: ['official form/text definitions','invalid callback suppresses valid submit','raw event both paths','submitted state','incomplete UI message','valid submit detached snapshot','official reset clears submitted/value']}));
