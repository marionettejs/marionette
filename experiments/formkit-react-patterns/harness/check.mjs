import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {fields,classes,values} from './fixtures.mjs';
const dom = new JSDOM('<!doctype html><html><body><main id="host"></main></body></html>',{url: 'https://example.test',pretendToBeVisual: true});
for (const key of ['window','document','HTMLElement','Element','Node','Document','ShadowRoot','MutationObserver','Event','CustomEvent','HTMLInputElement']) globalThis[key] = dom.window[key];
Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator,configurable: true});
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);globalThis.SVGElement = dom.window.SVGElement;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const arm = process.argv[2] ?? 'vue',count = Number(process.argv[3] ?? 20),host = document.querySelector('#host');
const {mountReference,mountCurrent} = await import('./reference.mjs');
const api = arm === 'current' ? await mountCurrent(host,count) : arm === 'experiment' ? await (await import('../core/index.mjs')).mount({host,count,fields: fields(count),classes,values: values(count)}) : await mountReference(arm,host,count);
const delay = ()=>new Promise(r=>setTimeout(r,5));
async function until(predicate,label) {for (let n = 0;n < 400;n++) {await delay();if (predicate()) return;} throw Error(`Did not settle: ${label}`)}
await until(()=>api.node?.isSettled && host.querySelectorAll('input[type=text]').length === count,'mount');
assert.equal(Object.keys(api.node.value).length,count);
await until(()=>host.querySelectorAll('[id$="-rule_required"]').length === count || [...host.querySelectorAll('li')].filter(e=>/required/i.test(e.textContent)).length === count,'required validation messages');
assert.equal(host.querySelectorAll('input.study-input').length,count);
for (const el of host.querySelectorAll('input')) {
  assert.ok(host.querySelector(`label[for="${el.id}"]`),'associated label');
  assert.ok(el.getAttribute('aria-describedby'),'associated validation');
  for (const id of el.getAttribute('aria-describedby').split(' ')) assert.ok(document.getElementById(id),'description target exists');
}
const input = host.querySelectorAll('input[type=text]')[Math.floor(count / 2)];const key = `f${Math.floor(count / 2)}`;
input.focus();
// JSDOM cannot represent real keyboard latency. Native setter plus input/change events tests the binding only.
const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
for (const value of ['E','Ed','Edi','Edit','Edite','Edited']) {setter.call(input,value);input.dispatchEvent(new Event('input',{bubbles: true}));input.dispatchEvent(new Event('change',{bubbles: true}));await delay();}
await until(()=>api.node.value[key] === 'Edited' && !api.node.at(key).store.rule_required,'input binding and cleared validation');assert.equal(document.activeElement,input);assert.equal(input.isConnected,true);
await api.node.at('f0').input('External');await until(()=>host.querySelector('input').value === 'External','external input');
api.reset();await until(()=>Object.values(api.node.value).every(v=>v === '') && [...host.querySelectorAll('input')].every(el=>el.value === '') && api.node.children.every(n=>!!n.store.rule_required),'all-field reset and validation');
await api.setFields(fields(count + 1));await until(()=>host.querySelectorAll('input[type=text]').length === count + 1 && api.node.children.length === count + 1 && api.node.at(`f${count}`)?.store.rule_required,'add field');
await api.setFields(fields(count));await until(()=>host.querySelectorAll('input[type=text]').length === count && api.node.children.length === count && !api.node.at(`f${count}`) && !Object.hasOwn(api.node.value,`f${count}`),'remove field');
api.destroy();assert.equal(host.querySelectorAll('input').length,0);
console.log(JSON.stringify({arm,count,status: 'PASS',checks: ['mount count/value','required messages/classes/label/error associations','six input-event bindings','focus/control identity','external input','reset','add/remove field','destroy'],limits: ['JSDOM only; no layout, genuine keyboard, paint or timing evidence','Full accessibility and cleanup leak checks still pending']}));dom.window.close();
