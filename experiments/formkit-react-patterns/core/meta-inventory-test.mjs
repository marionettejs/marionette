// Inventory correction: the official library already supplied meta before this test.
import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<body><main></main>');for(const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key]=dom.window[key];
const {mount}=await import('./index.mjs');const api=mount({host:document.querySelector('main'),fields:[{name:'metadata',type:'meta',value:{tag:'initial'}},{name:'visible'}]});
try{assert.equal(api.node.at('metadata').type,'input');assert.equal(api.form.el.querySelectorAll('input').length,1);assert.deepEqual(api.node.value.metadata,{tag:'initial'});api.setValues({metadata:{tag:'updated'}});assert.deepEqual(api.getValues().metadata,{tag:'updated'});api.setFields([{name:'visible'}]);assert.equal(api.node.at('metadata'),undefined);}finally{api.destroy();dom.window.close();}
console.log('existing official meta input: invisible schema, value/facade/removal; inventory correction only, not new support');
