import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>');globalThis.document = dom.window.document;
const {renderSections} = await import('./section-renderer.mjs');const host = document.querySelector('main'),context = {rows: ['one','two'],show: true,tag: 'b'};
const lazy = {$el: '$tag',for: ['item','$rows'],if: '$show'};Object.defineProperty(lazy,'children',{get: ()=>'$item'});
const renderer = renderSections({host,context,schema: lazy});assert.deepEqual([...host.querySelectorAll('b')].map(el=>el.textContent),['one','two']);context.tag = 'i';renderer.update();assert.equal(host.querySelectorAll('i').length,2);assert.equal(host.textContent,'onetwo');renderer.destroy();
let seen;const sugar = {$formkit: 'text',if: '$show'};Object.defineProperty(sugar,'label',{get: ()=> 'Lazy label'});Object.defineProperty(sugar,'children',{get: ()=> 'Lazy child'});
const sugarRenderer = renderSections({host,context,schema: sugar,components: {FormKit: ({host,props,renderChildren})=>{seen = props;renderChildren();return {destroy() {}};}}});assert.equal(seen.type,'text');assert.equal(seen.label,'Lazy label');assert.equal(host.textContent,'Lazy child');sugarRenderer.destroy();
console.log('non-enumerable schema getters survive loop/condition/dynamic-tag projection and nested FormKit sugar');
