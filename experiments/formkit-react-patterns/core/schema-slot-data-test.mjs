import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<body><main></main>');for(const key of ['window','document','Document','ShadowRoot','Node','Element','HTMLElement','SVGElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key]=dom.window[key];
const {mount}=await import('./index.mjs'),{createNode}=await import('@formkit/core'),host=document.querySelector('main'),borrowed=createNode({name:'borrowed',type:'group'});const created=[],destroyed=[];
const declaration=[{$el:'section',for:['row','$rows'],attrs:{key:'$row.id','data-row':'$row.id'},children:'$slots.label'}];
const slots={label:{$el:'em',children:['$prefix',': ','$row.label','$suffix']}};
const api=mount({host,schema:{$cmp:'FormKitSchema',props:{__raw__schema:declaration,__raw__slots:slots,data:'$payload'}},data:{payload:{prefix:'Old',suffix:'!',rows:[{id:'a',label:'First'},{id:'b',label:'Second'}],node:borrowed}},plugins:[n=>{created.push(n);n.on('destroyed',()=>destroyed.push(n));}],formProps:{actions:false}});
try{
 const first=host.querySelector('[data-row=a] em'),second=host.querySelector('[data-row=b] em');assert.deepEqual([...host.querySelectorAll('em')].map(el=>el.textContent),['Old: First!','Old: Second!']);
 api.updateData({payload:{prefix:'New',rows:[{id:'b',label:'Changed'},{id:'a',label:'Updated'}],node:borrowed}});
 assert.equal(host.querySelector('[data-row=a] em'),first);assert.equal(host.querySelector('[data-row=b] em'),second);assert.deepEqual([...host.querySelectorAll('em')].map(el=>el.textContent),['New: Changed','New: Updated'],'Schema slots must read replacement data and remove omitted keys');
 for(let i=0;i<4;i++){api.updateData({payload:{prefix:'Revision '+i,suffix:'?',rows:[{id:'a',label:'One'}],node:borrowed}});assert.equal(host.querySelector('em'),first);assert.equal(first.textContent,'Revision '+i+': One?');}
 assert.equal(borrowed.isCreated,true);api.destroy();assert.equal(host.childElementCount,0);assert.equal(created.length,destroyed.length);assert.equal(borrowed.isCreated,true);
 console.log(JSON.stringify({passed:true,checks:['Schema-valued slots use replacement data','omitted data keys disappear','loop locals update and keyed DOM stays retained','repeated refresh stays live','borrowed data.node survives cleanup','owned nodes destroyed once'],scope:'Adapter schema-valued slot contract;no upstream schema-valued slot API equivalence or browser/performance claim'}));
}finally{api.destroy();borrowed.destroy();dom.window.close();}
