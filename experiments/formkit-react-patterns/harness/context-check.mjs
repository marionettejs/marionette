import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {fields,classes,values} from './fixtures.mjs';
const dom = new JSDOM('<!doctype html><html><body><main id="host"></main></body></html>',{url: 'https://example.test',pretendToBeVisual: true});
for (const key of ['window','document','HTMLElement','Element','Node','Document','ShadowRoot','MutationObserver','Event','CustomEvent','HTMLInputElement']) {globalThis[key] = dom.window[key];}
Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator,configurable: true});
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);globalThis.SVGElement = dom.window.SVGElement;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const arm = process.argv[2] ?? 'vue',count = Number(process.argv[3] ?? 20),host = document.querySelector('#host');
const {mountReference,mountCurrent} = await import('./reference.mjs');
const specs = [{type: 'text',name: 'f0',label: 'Name',help: 'Enter a name',validation: 'required',validationVisibility: 'blur',classes}];
const options = {fields: specs};const api = arm === 'current' ? await mountCurrent(host,1,options) : arm === 'experiment' ? await (await import('../core/index.mjs')).mount({host,fields: specs,values: {f0: ''},classes}) : await mountReference(arm,host,1,options);
const delay = ()=>new Promise(r=>setTimeout(r,5));async function until(predicate,label) {for (let i = 0;i < 400;i++) {await delay();if (predicate()) {return;}} throw Error('Did not settle: ' + label)}
await until(()=>api.node?.at('f0') && host.querySelector('input'),'mount');const node = api.node.at('f0'),input = host.querySelector('input');
assert.ok(host.textContent.includes('Enter a name'));assert.ok(input.getAttribute('aria-describedby'));assert.equal([...host.querySelectorAll('li')].filter(e=>/required/i.test(e.textContent)).length,0);
input.dispatchEvent(new Event('blur'));input.dispatchEvent(new Event('focusout',{bubbles: true}));await until(()=>node.context.state.blurred && [...host.querySelectorAll('li')].some(e=>/required/i.test(e.textContent)),'blur state/message');
await node.input('Name');await until(()=>node.context.state.dirty && input.value === 'Name' && ![...host.querySelectorAll('li')].some(e=>/required/i.test(e.textContent)),'dirty and validation');
api.reset();await until(()=>input.value === '' && !node.context.state.dirty,'reset dirty');api.destroy();assert.equal(host.querySelectorAll('input').length,0);
console.log(JSON.stringify({arm,status: 'PASS',checks: ['official help/description association','blur visibility/context','dirty state and cleared validation','reset dirty','destroy'],limits: ['JSDOM only; no full context/prop parity']}));dom.window.close();
