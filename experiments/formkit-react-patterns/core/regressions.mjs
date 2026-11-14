import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
const dom = new JSDOM('<!doctype html><body><div id="one"></div><div id="two"></div>', { url: 'http://localhost' });
for (const name of ['window','document','Node','Element','HTMLElement','HTMLFormElement','HTMLInputElement','Event','CustomEvent','MutationObserver']) globalThis[name] = dom.window[name];
const { mount, ExperimentalFormView } = await import('./index.mjs');
const tick = () => new Promise(resolve => setTimeout(resolve,25));
const one = mount({instrument: true,host: document.querySelector('#one'),count: 2,config: {validationVisibility: 'live'}}),two = mount({instrument: true,host: document.querySelector('#two'),count: 2,config: {validationVisibility: 'live'}});
await tick();
const ids = [...document.querySelectorAll('[id]')].map(el=>el.id); assert.equal(new Set(ids).size,ids.length);
for (const input of document.querySelectorAll('input')) {
  const label = input.closest('[data-experiment-field]').querySelector('label'); assert.equal(label.control,input);
  for (const id of input.getAttribute('aria-describedby').split(' ')) assert.ok(input.closest('[data-experiment-field]').contains(document.getElementById(id)));
}
one.destroy(); one.setFields([{name: 'late',label: 'Late'}]); await tick();
assert.equal(one.form.fields.size,0); assert.equal(one.node.children.length,0); assert.equal(one.form.el.querySelectorAll('input').length,0);
two.destroy();
console.log(JSON.stringify({passed: true,checks: ['unique IDs','label/error references','postdestroy entry does not recreate fields']}));
