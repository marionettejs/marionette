import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
import {fields,classes,values} from './fixtures.mjs';
const dom=new JSDOM('<!doctype html><body><main id="host"></main>',{url:'https://example.test',pretendToBeVisual:true});
for(const key of ['window','document','HTMLElement','Element','Node','Document','ShadowRoot','MutationObserver','Event','CustomEvent','HTMLInputElement','HTMLFormElement'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);
const {mount}=await import('../core/index.mjs');const count=Number(process.argv[2]??200);const host=document.querySelector('#host');
const api=mount({host,count,fields:fields(count),classes,values:values(count)});
const tick=()=>new Promise(r=>setTimeout(r,5));async function settle(check){for(let i=0;i<1000;i++){await tick();if(api.node.isSettled&&check())return;}throw Error('semantic settlement timeout')}
await settle(()=>host.querySelectorAll('input[type=text]').length===count&&api.node.children.every(n=>n.store.rule_required));
const mounted={...api.metrics};const middle=api.node.at(`f${Math.floor(count/2)}`);const input=host.querySelectorAll('input[type=text]')[Math.floor(count/2)];input.focus();
await middle.input('x');await settle(()=>input.value==='x'&&!middle.store.rule_required);
assert.equal(document.activeElement,input);const edited={...api.metrics};const delta=Object.fromEntries(Object.keys(edited).map(k=>[k,edited[k]- (mounted[k]??0)]));
api.destroy();assert.equal(host.querySelectorAll('input').length,0);
console.log(JSON.stringify({count,mounted,firstEditDelta:delta,final:{...api.metrics},checks:['required mount','value/error update','focus/control identity','destroy'],limits:['deterministic experimental counters; not browser timing or current-adapter performance comparison','direct Core input, not real keyboard']}));dom.window.close();
