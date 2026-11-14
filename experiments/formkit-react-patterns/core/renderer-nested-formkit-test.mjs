import {JSDOM} from 'jsdom';import assert from 'node:assert/strict';
const dom=new JSDOM('<body><main></main>');for(const k of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[k]=dom.window[k];
const {mount}=await import('./index.mjs');
const child={$formkit:'text',name:'inside'};Object.defineProperty(child,'label',{get:()=> 'Nested label'});
const api=mount({host:document.querySelector('main'),fields:[{name:'outer',type:'nested'}],inputs:{nested:{type:'group',schema:()=>({$el:'section',children:[child]})}}});
await new Promise(r=>setTimeout(r,30));const el=document.querySelector('section input');assert.ok(el);assert.equal(document.querySelector('section label').textContent,'Nested label');el.value='nested value';el.dispatchEvent(new Event('input'));await new Promise(r=>setTimeout(r,40));assert.equal(api.node.at('outer.inside').value,'nested value');api.destroy();assert.equal(document.querySelector('section'),null);console.log('nested $formkit sugar creates bound child Core node through FormKit factory and tears down');
