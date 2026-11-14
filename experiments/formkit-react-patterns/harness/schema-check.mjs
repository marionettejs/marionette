import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {fields,classes,values} from './fixtures.mjs';
const dom = new JSDOM('<!doctype html><html><body><main id="host"></main></body></html>',{url: 'https://example.test',pretendToBeVisual: true});
for (const key of ['window','document','HTMLElement','Element','Node','Document','ShadowRoot','MutationObserver','Event','CustomEvent','HTMLInputElement']) {globalThis[key] = dom.window[key];}
Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator,configurable: true});
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);globalThis.SVGElement = dom.window.SVGElement;
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame.bind(dom.window);globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame.bind(dom.window);
const arm = process.argv[2] ?? 'vue',count = Number(process.argv[3] ?? 20),host = document.querySelector('#host');
const {mountSchemaReference} = await import('./schema-reference.mjs');
const api = await mountSchemaReference(arm,host);const delay = ()=>new Promise(r=>setTimeout(r,5));
async function until(predicate,label) {for (let n = 0;n < 400;n++) {await delay();if (predicate()) {return;}} throw Error(`Did not settle: ${label}`)}
await until(()=>api.node?.at('f0') && host.querySelectorAll('input').length === 1,'initial hidden');
const toggle = host.querySelector('input');await api.node.at('f0').input('show');await until(()=>host.querySelectorAll('input').length === 2 && api.node.at('extra'),'conditional show');
const extra = api.node.at('extra');await extra.input('detail');await api.node.at('f0').input('hide');await until(()=>host.querySelectorAll('input').length === 1 && !api.node.at('extra') && !Object.hasOwn(api.node.value,'extra'),'conditional removal');assert.equal(host.querySelector('input'),toggle);
await api.node.at('f0').input('show');await until(()=>host.querySelectorAll('input').length === 2 && api.node.at('extra'),'conditional re-add');assert.notEqual(api.node.at('extra'),extra);assert.equal(host.querySelectorAll('input')[1].value,'');assert.notEqual(api.node.at('extra').value,'detail');
api.destroy();assert.equal(host.querySelectorAll('input').length,0);console.log(JSON.stringify({arm,status: 'PASS',checks: ['official schema conditional show/hide','Core values remove with field','retained toggle DOM','fresh branch node on re-add','destroy'],limits: ['explicit root-value schema-data subscription; JSDOM only']}));dom.window.close();
