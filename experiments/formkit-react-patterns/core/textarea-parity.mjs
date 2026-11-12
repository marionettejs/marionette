import { JSDOM } from 'jsdom';
import assert from 'node:assert/strict';
const dom = new JSDOM('<body><main></main>', {url:'http://localhost'});
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLFormElement','Event','CustomEvent','MutationObserver','SVGElement']) globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);
const arm=process.argv[2]??'experiment', host=document.querySelector('main'), tick=()=>new Promise(r=>setTimeout(r,30));
const initial={}, base={type:'textarea',name:'notes',disabled:false,label:'Notes',help:'Multiple lines',validation:'required',validationVisibility:'live',attrs:{rows:3,cols:24,maxlength:100}};
const upstreamProps=({attrs,...spec})=>({...spec,...attrs});
if(process.argv.includes('--probe-absent-disabled'))delete base.disabled;
let node,update,destroy,api;
if(arm==='vue') {
 const {createApp,h,shallowRef}=await import('vue'),{FormKit,plugin,defaultConfig}=await import('@formkit/vue');
 const spec=shallowRef(base), app=createApp({render:()=>h(FormKit,{type:'form',value:initial,actions:false,onNode:n=>node=n},{default:()=>h(FormKit,{type:'group',name:'profile'},{default:()=>[h(FormKit,upstreamProps(spec.value)),h(FormKit,{type:'text',name:'title'})]})})});
 app.use(plugin,defaultConfig({config:{delay:0}}));app.mount(host);update=s=>spec.value=s;destroy=()=>app.unmount();
} else if(arm==='react') {
 const R=await import('react'),{createRoot}=await import('react-dom/client'),{flushSync}=await import('react-dom'),{FormKit,FormKitProvider,defaultConfig}=await import('@formkit/react');
 const root=createRoot(host),config=defaultConfig({config:{delay:0}});
 function App(){const[s,set]=R.useState(base);update=set;return R.createElement(FormKitProvider,{config},R.createElement(FormKit,{type:'form',value:initial,actions:false,onNode:n=>node=n},R.createElement(FormKit,{type:'group',name:'profile'},R.createElement(FormKit,upstreamProps(s)),R.createElement(FormKit,{type:'text',name:'title'}))));}
 flushSync(()=>root.render(R.createElement(App)));destroy=()=>flushSync(()=>root.unmount());
} else {
 const {mount}=await import('./index.mjs'); const fields=s=>[{type:'group',name:'profile',children:[s,{type:'text',name:'title'}]}];
 api=mount({host,fields:fields(base)});node=api.node;update=s=>api.setFields(fields(s));destroy=api.destroy;
}
async function until(predicate,label){const end=Date.now()+2000;while(Date.now()<end){if(predicate())return;await new Promise(resolve=>setTimeout(resolve,10));}throw new Error(`Timed out waiting for ${label}`);}
await until(()=>node?.at('profile.notes')&&host.querySelector('textarea')&&node.at('profile.notes').ledger.value('blocking')===1,'mounted/validated textarea');const child=node.at('profile.notes'),textarea=host.querySelector('textarea');
assert.equal(child.value,undefined);assert.equal(textarea.value,'');assert.equal(child.ledger.value('blocking'),1);
assert.equal(textarea.rows,3);assert.equal(textarea.cols,24);assert.equal(textarea.maxLength,100);
assert.equal(host.querySelector(`label[for="${textarea.id}"]`).textContent,'Notes');
for(const id of textarea.getAttribute('aria-describedby').split(' '))assert.ok(document.getElementById(id));
textarea.value='First line\nSecond line';textarea.dispatchEvent(new Event('input',{bubbles:true}));await until(()=>child.value==='First line\nSecond line'&&child.ledger.value('blocking')===0,'multiline commit/validation');
assert.equal(child.value,'First line\nSecond line');assert.equal(child.ledger.value('blocking'),0);
await child.input('External\nUpdate');await until(()=>textarea.value==='External\nUpdate','external value rendering');assert.equal(textarea.value,'External\nUpdate');
update({...base,disabled:true,attrs:{rows:5,cols:30,maxlength:120}});await until(()=>textarea.disabled===true&&textarea.rows===5&&textarea.cols===30&&textarea.maxLength===120,'disabled/attribute update');
assert.equal(textarea.disabled,true);assert.equal(textarea.rows,5);assert.equal(textarea.cols,30);assert.equal(textarea.maxLength,120);assert.equal(host.querySelector('textarea'),textarea);assert.equal(node.at('profile.notes'),child);
update(base);await until(()=>textarea.disabled===false,'enabled update');assert.equal(textarea.disabled,false);
const {reset}=await import('@formkit/core');reset(node);await until(()=>child.value===undefined&&textarea.value===''&&child.ledger.value('blocking')===1,'reset/validation');assert.equal(child.value,undefined);assert.equal(textarea.value,'');assert.equal(child.ledger.value('blocking'),1);
destroy();assert.equal(host.querySelector('textarea'),null);if(api)assert.equal(api.metrics.coreNodesCreated,api.metrics.coreNodesDestroyed);
console.log(JSON.stringify({arm,passed:true,checks:['nested group/text composition','absent default and required validation','multiline native input','external value','label/help/error ID references','live rows/cols/maxlength/disabled','node/control identity','reset','cleanup'],limits:['JSDOM, not native browser keyboard']}));
