import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});for (const key of ['window','document','Document','ShadowRoot','Node','Element','HTMLElement','SVGElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key] = dom.window[key];
const {mount} = await import('./index.mjs'),host = document.querySelector('main');
const wait = ms=>new Promise(resolve=>setTimeout(resolve,ms));async function until(test) {for (let i = 0;i < 120;i++) {if (test()) return;await wait(5);}assert.ok(test(),'semantic wait');}
const api = mount({host,schema: {$cmp: 'FormKitRoot',children: {$el: 'section',attrs: {id: 'placement'},children: [{$cmp: 'FormKit',if: '$show',props: {type: 'text',name: 'inside',sectionsSchema: '$sections'}},{$el: 'button',attrs: {type: 'button',id: 'after'},children: 'After'}]}},data: {show: true,sections: {}},config: {delay: 0},formProps: {actions: false},instrument: true});
try {
  await until(()=>api.node.at('inside'));const scope = host.querySelector('#placement'),node = api.node.at('inside'),outer = scope.querySelector('.formkit-outer');
  assert.equal(outer.parentElement,scope,'official native outer must be a direct child of its schema container');
  const input = scope.querySelector('input');input.value = 'Edited';input.dispatchEvent(new Event('input',{bubbles: true}));await until(()=>node.value === 'Edited');
  api.updateData({show: true,sections: {outer: {$el: 'article'}}});await until(()=>scope.querySelector('article.formkit-outer'));
  const article = scope.querySelector('article.formkit-outer');assert.equal(article.parentElement,scope);assert.equal(outer.isConnected,false);assert.equal(scope.querySelectorAll('.formkit-outer').length,1);assert.equal(api.node.at('inside'),node);assert.equal(scope.querySelector('input').value,'Edited');
  api.updateData({show: false,sections: {}});assert.equal(scope.querySelector('.formkit-outer'),null);assert.equal(api.node.at('inside') == null,true);assert.equal(host.querySelector('#after').parentElement,scope);
  api.updateData({show: true,sections: {}});await until(()=>scope.querySelector('input'));assert.equal(scope.querySelector('.formkit-outer').parentElement,scope);
  api.destroy();assert.equal(api.metrics.coreNodesCreated,3);assert.equal(api.metrics.coreNodesDestroyed,3);assert.equal(host.childElementCount,0);
  console.log(JSON.stringify({passed: true,checks: ['factory native outer placed directly in schema container','full sections redraw re-presents once with same Core and edited value','conditional removal removes presented DOM and Core owner','re-add and terminal disposal exact'],scope: 'DOM hierarchy and lifecycle only; real geometry belongs to licensed browser evidence'}));
} finally {api.destroy();dom.window.close();}
