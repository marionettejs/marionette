import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>');
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
const {mount} = await import('./index.mjs');const pause = ()=>new Promise(resolve=>setTimeout(resolve,40));
const fields = [{name: 'inherited'},{name: 'override',config: {classes: {input: ()=>({local: true})}}},{name: 'group',type: 'group',children: [{name: 'nested'}]}];
const api = mount({host: document.querySelector('main'),fields,classes: {input: ()=>({initial: true})}});
const input = api.form.el.querySelector('[name=inherited]'),nested = api.form.el.querySelector('[name=nested]'),local = api.form.el.querySelector('[name=override]');
try {
  assert.equal(api.form.config,api.node.config);assert.ok(input.classList.contains('initial'));assert.ok(nested.classList.contains('initial'));assert.ok(local.classList.contains('local'));
  api.form.config.classes = {input: ()=>({replaced: true})};await pause();
  assert.ok(input.classList.contains('replaced'));assert.ok(nested.classList.contains('replaced'));assert.ok(!input.classList.contains('initial'));assert.ok(local.classList.contains('local'));assert.ok(!local.classList.contains('replaced'));
  let silent = false;api.node.config.classes = {input: ()=>({silent})};await pause();assert.ok(!input.classList.contains('silent'));
  silent = true;await api.node.at('group.nested').input('unrelated');await pause();assert.ok(!input.classList.contains('silent'));
  api.form.render();assert.ok(input.classList.contains('silent'));assert.equal(api.form.el.querySelector('[name=inherited]'),input);
  api.setFields([...fields,{name: 'late'}]);await pause();assert.ok(api.form.el.querySelector('[name=late]').classList.contains('silent'));
  api.node.at('override').config.classes = {input: ()=>({changedLocal: true})};await pause();assert.ok(local.classList.contains('changedLocal'));
  api.node.config.rootClasses = section=>({['alternate-' + section]: true});await pause();assert.ok(input.classList.contains('alternate-input'));assert.ok(!input.classList.contains('formkit-input'));
} finally {api.destroy();dom.window.close();}
console.log('class config: Core inheritance, notified replacement, local overrides, late fields, explicit closure refresh and retained DOM passed');
