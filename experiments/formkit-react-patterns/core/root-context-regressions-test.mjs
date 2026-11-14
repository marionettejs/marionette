import assert from 'node:assert/strict';
import {setupProjectionDom,settle} from './schema-projection-reference.mjs';
const dom=setupProjectionDom(),arm=process.argv[2]??'experiment',test=process.argv[3]??'data',host=document.querySelector('main');
const {getNode}=await import('@formkit/core');
let node,api,destroy,submitted=0,created=0,destroyed=0,clicks=0;
const capture=n=>{created++;n.on('destroyed',()=>destroyed++);};
const person={first:'Ada',fullName(){return this.first;},clicked(){assert.equal(this.first,'Ada');clicks++;}};
const data=test==='method'?{person}:test==='id'?{}:{handlers:{},id:'shadow-id',attrs:{'data-shadow':'bad'},caption:'Slot caption'};
const schema=test==='method'?{$el:'button',attrs:{type:'button',onClick:'$person.clicked'},children:'$person.fullName()'}:'x';
const formProps={type:'form',actions:false,...(test==='id'?{id:'checkout'}:{}),onNode:n=>node=n,onSubmit:()=>submitted++};
try{
  if(arm==='vue'){
    const {createApp,h}=await import('vue'),{FormKit,FormKitSchema,plugin,defaultConfig}=await import('@formkit/vue');
    const app=createApp({render:()=>h(FormKit,formProps,{default:()=>h(FormKitSchema,{schema,data})})});destroy=()=>app.unmount();app.use(plugin,defaultConfig({plugins:[capture],config:{delay:0}}));app.mount(host);
  }else if(arm==='react'){
    const {createElement:h}=await import('react'),{createRoot}=await import('react-dom/client'),{flushSync}=await import('react-dom'),{FormKit,FormKitSchema,FormKitProvider,defaultConfig}=await import('@formkit/react');
    const root=createRoot(host);destroy=()=>flushSync(()=>root.unmount());flushSync(()=>root.render(h(FormKitProvider,{config:defaultConfig({plugins:[capture],config:{delay:0}})},h(FormKit,formProps,h(FormKitSchema,{schema,data})))));
  }else{
    const {mount}=await import('./index.mjs');api=mount({host,schema,data,plugins:[capture],config:{delay:0},formProps:{actions:false,...(test==='id'?{id:'checkout'}:{})},onSubmit:formProps.onSubmit});node=api.node;destroy=()=>api.destroy();
  }
  await settle();const form=host.querySelector('form');
  if(test==='method'){
    assert.equal(host.querySelector('button').textContent,'Ada','expression method receives its owner');host.querySelector('button').click();assert.equal(clicks,1,'event method receives its owner');
  }else{
    form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await settle();assert.equal(submitted,1,'external schema data does not replace official submit handler');
    assert.equal(form.id,node.props.id,'root DOM ID comes from its Core context');assert.equal(form.hasAttribute('data-shadow'),false,'external attrs do not become root attrs');
    if(test==='id'){assert.equal(form.id,'checkout');assert.equal(getNode('checkout'),node,'explicit form ID is registered');}
    if(api&&test==='data'){api.setSlots({default:{$el:'article',children:[{$el:'em',children:'$caption'},'$slots.fields']}});assert.equal(host.querySelector('article em').textContent,'Slot caption','user slots still receive external data');api.updateData({...data,caption:'Updated slot'});assert.equal(host.querySelector('article em').textContent,'Updated slot');}
  }
  const id=node.props.id;destroy();destroy=undefined;await settle();assert.equal(getNode(id),undefined);assert.equal(host.childElementCount,0);assert.equal(created,destroyed);
  console.log(JSON.stringify({arm,test,passed:true,created,destroyed}));
}finally{destroy?.();dom.window.close();}
