import {JSDOM} from 'jsdom'; import assert from 'node:assert/strict';
const dom = new JSDOM('<body><main></main>'); for (const k of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[k] = dom.window[k];}
const {mount} = await import('./index.mjs');
const plugin = ()=>{}; plugin.library = node=>{if (node.props.type === 'pluginText') {node.define({type: 'input',schema: {$el: 'input',attrs: {value: '$_value',onInput: '$handlers.DOMInput'}}});}};
const form = mount({host: document.querySelector('main'),plugins: [plugin],fields: [{name: 'x',type: 'pluginText'}]});
const input = document.querySelector('input');input.value = 'registered';input.dispatchEvent(new Event('input',{bubbles: true}));await new Promise(r=>setTimeout(r,40));assert.equal(form.node.value.x,'registered');form.destroy();console.log('PASS library-plugin-defined input via public mount');
