import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>');
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key] = dom.window[key];
const {mount} = await import('./index.mjs'),host = document.querySelector('main');
const schema = {$formkit: 'group',name: 'profile',children: {$el: 'fieldset',children: [{$el: 'legend',children: '$title'},{$formkit: 'text',name: 'name',label: 'Profile name'},{$formkit: 'list',name: 'tags',children: {$el: 'ol',children: {$el: 'li',for: ['item','$rows'],attrs: {key: '$item.id','data-row': '$item.id'},children: {$formkit: 'text',key: '$item.id',label: '$item.title'}}}},{if: '$extra',then: {$formkit: 'text',name: 'extra',label: 'Extra'}}]}};
const rows = [{id: 'a',title: 'Alpha'},{id: 'b',title: 'Beta'}],modes = process.argv[2] ? [process.argv[2]] : ['conditional','reorder'];
try {
  for (const mode of modes) {
    const api = mount({host,schema,values: {profile: {name: 'Initial',tags: ['a','b']}},data: {title: 'Profile',rows,extra: false},formProps: {actions: false},config: {delay: 0}});
    try {
      const input = host.querySelector('[data-row=a] input'),node = api.node.at('profile.tags').children[0];input.value = 'Edited A';input.dispatchEvent(new Event('input',{bubbles: true}));await node.settled;input.focus();input.setSelectionRange(1,5,'backward');let focusEvents = 0;const count = ()=>focusEvents++;host.addEventListener('focusin',count);host.addEventListener('focusout',count);
      const next = mode === 'reorder' ? [{id: 'b',title: 'Beta updated'},{id: 'a',title: 'Alpha updated'}] : rows;
      api.updateData({title: 'Updated',rows: next,extra: true});
      assert.equal(host.querySelector('[data-row=a] input'),input);assert.equal(document.activeElement,input,mode + ' must retain focus');assert.equal(input.selectionStart,1);assert.equal(input.selectionEnd,5);assert.equal(input.selectionDirection,'backward');assert.equal(focusEvents,0);assert.ok(api.node.at('profile.tags').children.includes(node));assert.equal(node.value,'Edited A');assert.equal(host.querySelector('legend').textContent,'Updated');assert.ok(api.node.at('profile.extra'));assert.deepEqual([...host.querySelectorAll('[data-row]')].map(el=>el.dataset.row),next.map(row=>row.id));
      api.updateData({title: 'Final',rows: [{id: 'a',title: 'Alpha final'}],extra: false});assert.equal(api.node.at('profile.extra'),undefined);assert.equal(host.querySelector('[data-row=a] input'),input);assert.deepEqual(api.getValues(),{profile: {name: 'Initial',tags: ['Edited A']}});assert.equal(document.activeElement,input);host.removeEventListener('focusin',count);host.removeEventListener('focusout',count);
    } finally {api.destroy();}assert.equal(host.childElementCount,0);
  }console.log(JSON.stringify({passed: true,modes,checks: ['mixed keyed list reorder','conditional insertion/removal','retained Core/input/value/focus/selection without focus events','nested value topology','normal teardown'],limits: 'JSDOM focused regression; licensed combined browser acceptance remains separate'}));
} finally {dom.window.close();}
