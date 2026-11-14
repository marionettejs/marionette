import {JSDOM} from 'jsdom';import assert from 'node:assert/strict';
const dom = new JSDOM('<body><main></main>');for (const k of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[k] = dom.window[k];
const {mount} = await import('./index.mjs');const host = document.querySelector('main'),tick = ()=>new Promise(r=>setTimeout(r,40));
for (const field of [
  {name: 'x',type: 'radio',options: ['One','Two']},
  {name: 'x',type: 'checkbox',options: ['One','Two']},
  {name: 'x',type: 'select',multiple: true,options: ['One','Two']},
  {name: 'x',type: 'select',options: [{group: 'Group',options: ['One','Two']}]},
  {name: 'x',type: 'file'},
  {name: 'x',type: 'list',children: [{name: 0,type: 'text'},{name: 1,type: 'text'}]},
  {name: 'x',type: 'button',label: 'Do it'},
]) { let api;try {api = mount({host,fields: [field]});await tick();assert.ok(host.querySelector('[data-experiment-field]'));console.log('PASS',field.type,JSON.stringify(api.node.value));} catch (e) {console.log('FAIL',field.type,e.stack);process.exitCode = 1;} finally {api?.destroy();host.replaceChildren();}}
let feature = false;const api = mount({host,fields: [{name: 'x',type: 'custom'}],inputs: {custom: {type: 'input',schema: {$el: 'input',attrs: {value: '$_value',onInput: '$handlers.DOMInput'}},features: [()=>{feature = true;}]}}});await tick();assert.ok(feature);assert.ok(host.querySelector('input'));api.destroy();console.log('PASS custom schema definition and features');
