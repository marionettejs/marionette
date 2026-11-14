import { JSDOM } from 'jsdom';import assert from 'node:assert/strict';
const dom = new JSDOM('<body><main></main><aside></aside>');for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver']) {globalThis[key] = dom.window[key];}
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);
const {mount} = await import('./index.mjs');const {createSchemaController} = await import('./schema.mjs');const {createLayoutController} = await import('./schema-layout.mjs');
const tick = ()=>new Promise(r=>setTimeout(r,15));
const local = mount({host: document.querySelector('main'),fields: []});let fields,calls = 0;
const schema = [{if: '$get(\'remote\')',then: {$formkit: 'text',name: 'result',label: '$get(\'remote\').value'},else: {$formkit: 'text',name: 'waiting'}}];
const controller = createSchemaController({node: local.node,schema,onFields: next=>{fields = next;calls++;}});assert.equal(fields[0].name,'waiting');
const layout = createLayoutController({form: local.form,schema: {$el: 'p',children: {if: '$get(\'remote\')',then: '$get(\'remote\').value',else: 'waiting'}}});
const remote = mount({host: document.querySelector('aside'),fields: [{name: 'source',id: 'remote',value: 'Initial'}]});await tick();assert.equal(fields[0].label,'Initial');assert.equal(document.querySelector('main p').textContent,'Initial');
await remote.node.at('source').input('Changed');await tick();assert.equal(fields[0].label,'Changed');assert.equal(document.querySelector('main p').textContent,'Changed');
remote.destroy();await tick();assert.equal(fields[0].name,'waiting');assert.equal(document.querySelector('main p').textContent,'waiting');
controller.destroy();layout.destroy();const previous = calls;const replacement = mount({host: document.querySelector('aside'),fields: [{name: 'source',id: 'remote',value: 'Replacement'}]});await tick();assert.equal(calls,previous);replacement.destroy();local.destroy();console.log('$get late registration, value updates, deregistration, layout updates and disposal passed');
