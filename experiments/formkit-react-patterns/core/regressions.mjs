import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
const dom = new JSDOM('<!doctype html><body><div id="one"></div><div id="two"></div>', { url:'http://localhost' });
for (const name of ['window','document','Node','Element','HTMLElement','HTMLFormElement','HTMLInputElement','Event','CustomEvent','MutationObserver']) globalThis[name] = dom.window[name];
const { mount, createStore, ExperimentalFormView } = await import('./index.mjs');
const tick = () => new Promise(resolve => setTimeout(resolve,25));
const one=mount({host:document.querySelector('#one'),count:2}),two=mount({host:document.querySelector('#two'),count:2});
await tick();
const ids=[...document.querySelectorAll('[id]')].map(el=>el.id); assert.equal(new Set(ids).size,ids.length);
for (const input of document.querySelectorAll('input')) {
 const label=input.closest('[data-experiment-field]').querySelector('label'); assert.equal(label.control,input);
 for(const id of input.getAttribute('aria-describedby').split(' ')) assert.ok(input.closest('[data-experiment-field]').contains(document.getElementById(id)));
}
one.destroy(); one.setFields([{name:'late',label:'Late'}]); await tick();
assert.equal(one.form.fields.size,0); assert.equal(one.node.children.length,0); assert.equal(one.form.el.querySelectorAll('input').length,0);
two.destroy();
const store=createStore(); const calls=[];
store.subscribe(()=>{calls.push('first');store.destroy();});store.subscribe(()=>calls.push('second'));store.notify(); await tick(); assert.deepEqual(calls,['first']);
const removal=createStore(); let stop; removal.subscribe(()=>stop());stop=removal.subscribe(()=>calls.push('removed'));removal.notify();await tick();assert.deepEqual(calls,['first']);
const interrupted = new ExperimentalFormView({count:1});
let rendered = 0; interrupted.on('before:render', () => interrupted.destroy()); interrupted.on('render', () => rendered++);
interrupted.render(); await tick(); assert.equal(interrupted.isDestroyed(),true); assert.equal(interrupted.isRendered(),false); assert.equal(rendered,0); assert.equal(interrupted.fields.size,0);
console.log(JSON.stringify({passed:true,checks:['multiple-instance input/message ID uniqueness','local label/error IDREFs','setFields after destroy does not create children or DOM','destroy during dispatch prevents later calls','unsubscribe during dispatch prevents later call','destroy in before:render prevents rendered state and event']}));
