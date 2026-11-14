import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>');for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
const {mount} = await import('./index.mjs');const pause = ()=>new Promise(resolve=>setTimeout(resolve,40));
const host = document.querySelector('main'),children = [{name: 'name'}];
const api = mount({host,fields: [{name: 'profile',type: 'group',validation: 'named',label: 'Before',children}],rules: {named: node=>!!node.value.name},values: {profile: {name: ''}}});
try {
  await pause();const group = api.node.at('profile'),input = host.querySelector('input');assert.ok(group.ledger.value('blocking') > 0);
  api.setFields([{name: 'profile',type: 'group',label: 'After',children,attrs: {'data-updated': 'yes'},classes: {outer: 'custom'}}]);await pause();
  assert.equal(group.props.label,'After');assert.equal(group.props.validation,undefined);assert.equal(group.ledger.value('blocking'),0);assert.equal(group.props.attrs['data-updated'],'yes');assert.equal(group.props._outerClass,'custom');assert.equal(host.querySelector('input'),input);
  api.setFields([{name: 'profile',type: 'group',children,classes: {}}]);await pause();assert.equal(group.props._outerClass,undefined);assert.equal(group.props.attrs['data-updated'],undefined);
  const options = ['A','B'];api.setFields([{name: 'choice',type: 'select',options}]);await pause();const select = host.querySelector('select'),node = api.node.at('choice');await node.input('B');
  api.setFields([{name: 'choice',type: 'select',help: 'Options omitted'}]);await pause();assert.equal(host.querySelector('select'),select);assert.equal(node.value,'B');assert.equal(select.options.length,2);
  api.setFields([{name: 'choice',type: 'select',options: []}]);await pause();assert.equal(select.options.length,0);
} finally {api.destroy();dom.window.close();}
console.log('native group prop/validation/class/attr updates and removal, retained child ownership, omitted options retention and explicit empty options passed');
