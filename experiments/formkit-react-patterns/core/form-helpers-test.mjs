import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom=new JSDOM('<body><main></main>');for(const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle'])globalThis[key]=dom.window[key];
const {mount}=await import('./index.mjs'),{fillForm,describeForm}=await import('@formkit/addons');const pause=()=>new Promise(resolve=>setTimeout(resolve,15));let release,entered=false,completed=false;
const api=mount({host:document.querySelector('main'),fields:[{name:'name',validation:'required'},{name:'secret',type:'password'}],onSubmit:()=>{entered=true;return new Promise(resolve=>release=()=>{completed=true;resolve();});}});
try{
 let returned=false;const pending=fillForm(api.node,{name:'Ada',secret:'example-secret'},{submit:true,timeout:1000}).then(value=>{returned=true;return value;});for(let i=0;i<100&&!entered;i++)await pause();assert.ok(entered);await pause();assert.equal(returned,false,'fillForm must await the native handler Promise');release();const result=await pending;assert.equal(completed,true);assert.equal(result.submitted,true);assert.equal(result.valid,true);
 const description=describeForm(api.node,{values:true});assert.equal(description.name,'form');assert.ok(JSON.stringify(description).includes('Ada'));assert.ok(!JSON.stringify(description).includes('example-secret'));
 const error=new Error('submission rejected');api.node.props.onSubmit=()=>Promise.reject(error);const failed=await fillForm(api.node,{name:'Grace'},{submit:true,timeout:1000});assert.equal(failed.submitError,error.message);assert.equal(api.node.value.name,'Grace');
}finally{release?.();api.destroy();dom.window.close();}
console.log('official fillForm awaits captured native submit completion/rejection; describeForm values and default sensitive-field redaction passed');
