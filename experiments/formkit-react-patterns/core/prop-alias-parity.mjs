import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';
const dom=new JSDOM('<body><main></main>');
for(const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','SVGElement'])globalThis[key]=dom.window[key];
Object.defineProperty(globalThis,'navigator',{value:dom.window.navigator,configurable:true});
globalThis.getComputedStyle=dom.window.getComputedStyle.bind(dom.window);
const arm=process.argv[2]??'experiment',host=document.querySelector('main');
const {camel}=await import('@formkit/utils');
const base={attrs:{disabled:true},box:{attrs:{'on-value':'yes','off-value':'no'}}};
let node,update,destroy;
const upstream=spec=>({...Object.fromEntries(Object.entries(spec.attrs??{}).map(([k,v])=>[camel(k),v])),...Object.fromEntries(Object.entries(spec).filter(([k])=>k!=='attrs'))});
if(arm==='vue'){
 const {createApp,h,shallowRef}=await import('vue'),{FormKit,plugin,defaultConfig}=await import('@formkit/vue');
 const state=shallowRef(base),app=createApp({render:()=>h(FormKit,{type:'form',actions:false,onNode:n=>node=n},{default:()=>h(FormKit,{type:'group',name:'g',...upstream({attrs:state.value.attrs,...('disabled'in state.value?{disabled:state.value.disabled}:{})})},{default:()=>h(FormKit,{type:'checkbox',name:'box',...upstream(state.value.box)})})})});
 app.use(plugin,defaultConfig());app.mount(host);update=s=>state.value=s;destroy=()=>app.unmount();
}else if(arm==='react'){
 const R=await import('react'),{createRoot}=await import('react-dom/client'),{flushSync}=await import('react-dom'),{FormKit,FormKitProvider,defaultConfig}=await import('@formkit/react');
 const root=createRoot(host),config=defaultConfig();
 function App(){const[s,set]=R.useState(base);update=set;return R.createElement(FormKitProvider,{config},R.createElement(FormKit,{type:'form',actions:false,onNode:n=>node=n},R.createElement(FormKit,{type:'group',name:'g',...upstream({attrs:s.attrs,...('disabled'in s?{disabled:s.disabled}:{})})},R.createElement(FormKit,{type:'checkbox',name:'box',...upstream(s.box)}))));}
 flushSync(()=>root.render(R.createElement(App)));destroy=()=>flushSync(()=>root.unmount());
}else{
 const {mount}=await import('./index.mjs');
 const fields=s=>[{type:'group',name:'g',attrs:s.attrs,...('disabled'in s?{disabled:s.disabled}:{}),children:[{type:'checkbox',name:'box',...s.box}]}];
 const api=mount({host,fields:fields(base)});node=api.node;update=s=>api.setFields(fields(s));destroy=api.destroy;
}
async function until(fn){const end=Date.now()+2000;while(Date.now()<end){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('Unsettled alias fixture');}
await until(()=>node?.at('g.box')&&host.querySelector('input'));
const input=host.querySelector('input'),box=node.at('g.box');
assert.equal(box.props.onValue,'yes');assert.equal(box.props.offValue,'no');assert.equal(node.at('g').props.disabled,true);assert.equal(input.disabled,true);
const next={attrs:{disabled:true},disabled:false,box:{attrs:{'on-value':'wrong','off-value':'wrong'},onValue:'Y',offValue:'N'}};
update(next);await until(()=>!input.disabled&&box.props.onValue==='Y');
input.click();await until(()=>box.value==='Y');input.click();await until(()=>box.value==='N');
update({attrs:{disabled:false},box:{attrs:{'on-value':'new','off-value':'old'}}});await until(()=>box.props.onValue==='new'&&!input.disabled);input.click();await until(()=>box.value==='new');
assert.equal(host.querySelector('input'),input);assert.equal(input.hasAttribute('on-value'),false);assert.deepEqual(base.box.attrs,{'on-value':'yes','off-value':'no'});
destroy();assert.equal(host.querySelector('input'),null);
console.log(JSON.stringify({arm,passed:true,checks:['definition aliases','group disabled inheritance','explicit prop precedence','notified alias changes','retained input','caller ownership'],note:'Vue/React bindings receive canonical props; alternate public attrs aliases follow Core addProps canonicalization'}));
