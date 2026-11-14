import {JSDOM} from 'jsdom';import assert from 'node:assert/strict';
const dom = new JSDOM('<body><div id="host"></div>');for (const k of ['window','document','Node','Element','HTMLElement','HTMLFormElement','HTMLInputElement','Event','CustomEvent','MutationObserver']) {globalThis[k] = dom.window[k];}
const {mount} = await import('./index.mjs');const {getNode} = await import('@formkit/core');const tick = ()=>new Promise(r=>setTimeout(r,10));const host = document.querySelector('#host');
const results = [];
for (const count of [200,400]) {
  const api = mount({instrument: true,host,count});await tick();const nodes = [api.node,...api.node.children],ids = nodes.map(n=>n.props.id),order = [];let parentCommits = 0;
  api.node.on('commit',()=>parentCommits++);for (const n of nodes) {n.on('destroyed',()=>order.push(n.name));}
  const observer = new MutationObserver(()=>{});observer.observe(api.form.el,{subtree: true,childList: true});
  api.node.ledger.settled('blocking').then(()=>{});const before = {...api.metrics};api.destroy();const records = observer.takeRecords();observer.disconnect();await tick();
  assert.equal(order.length,count + 1);assert.equal(order[0],'form');assert.equal(parentCommits,0);assert.equal(api.node.children.length,0);assert.equal(api.form.el.childNodes.length,0);assert.equal(host.childNodes.length,0);ids.forEach(id=>assert.equal(getNode(id),undefined));
  assert.equal(api.metrics.coreNodesCreated,api.metrics.coreNodesDestroyed);assert.equal(records.length,1);assert.equal(records[0].target,api.form.el);
  const after = {...api.metrics};await tick();assert.deepEqual(api.metrics,after);
  results.push({count,parentCommitEventsObserved: parentCommits,coreDestroyed: after.coreNodesDestroyed - before.coreNodesDestroyed,domChildListRecords: records.length,rootRemovedChildren: records[0].removedNodes.length});
}
const live = mount({instrument: true,host,fields: [{name: 'a'},{name: 'b'}],values: {a: 'A',b: 'B'}});await tick();let commits = 0;live.node.on('commit',()=>commits++);const retained = live.node.at('b');live.setFields([{name: 'b'}]);await tick();assert.ok(commits > 0);assert.equal(live.node.at('b'),retained);assert.deepEqual(live.node.value,{b: 'B'});live.destroy();
console.log(JSON.stringify({passed: true,results,checks: ['parent-first terminal destruction avoids live-parent commits; destroyed ledger settlement not required','all nodes deregistered/destroyed','one bulk root DOM clear','no later metrics activity','live field removal still commits'],limits: ['observed parent events, not instrumentation of every internal Core operation','JSDOM counters, not browser timings']}));
