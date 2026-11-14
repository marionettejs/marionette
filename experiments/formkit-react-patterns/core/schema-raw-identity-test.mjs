import assert from 'node:assert/strict';
import {setupProjectionDom,settle,mountProjectionReference} from './schema-projection-reference.mjs';
const dom=setupProjectionDom(),arm=process.argv[2]??'experiment',surface=process.argv[3]??'document';let host=document.querySelector('main');if(surface==='shadow')host=host.attachShadow({mode:'open'}).appendChild(document.createElement('article'));
const cases=[
 {name:'raw-name',props:{__raw__name:'overridden',label:'$caption'},expected:'overridden'},
 {name:'raw-key',anonymous:true,props:{__raw__key:'explicit-key',label:'$caption'}},
 {name:'raw-literal-name',props:{__raw__name:'$literal-name',label:'$caption'},expected:'$literal-name'},
 {name:'raw-name-last',props:{name:'ordinary',__raw__name:'raw-last',label:'$caption'},expected:'raw-last'},
 {name:'ordinary-name-last',props:{__raw__name:'raw-first',name:'ordinary-last',label:'$caption'},expected:'ordinary-last'},
 {name:'raw-key-last',anonymous:true,props:{key:'$identityKey',__raw__key:'$literal-key',label:'$caption'}},
 {name:'ordinary-key-last',anonymous:true,props:{__raw__key:'$literal-key',key:'$identityKey',label:'$caption'},replaces:true}
];
const observations=[];
try{for(const test of cases){
 const declaration={$cmp:'FormKit',bind:'$fieldProps',props:test.props},data={fieldProps:{type:'text',...(test.anonymous?{}:{name:'kept'}),id:'raw-'+test.name,key:'bound'},identityKey:'first',caption:'Before'};
 const api=await mountProjectionReference(arm,host,[declaration],data);
 try{
  const field=api.node.children[0],input=host.querySelector('input');assert.equal(api.node.children.length,1);assert.ok(input);if(test.expected)assert.equal(field.name,test.expected);assert.equal(field.parent,api.node);await field.input('Edited');await settle();
  await api.update({...data,fieldProps:{...data.fieldProps,...(test.anonymous?{key:'changed-bound'}:{name:'changed-bound-name'})},identityKey:'second',caption:'After'});const after=api.node.children[0],afterInput=host.querySelector('input');
  if(test.replaces){assert.notEqual(after,field);assert.notEqual(afterInput,input);assert.equal(field.context==null,true);assert.equal(afterInput.value,'');}else{assert.equal(after,field);assert.equal(afterInput,input);assert.equal(afterInput.value,'Edited');}
  assert.equal(after.props.label,'After');if(test.expected)assert.equal(after.name,test.expected);observations.push(test.name);
 }finally{api.destroy();await settle();assert.equal(api.counts().created,api.counts().destroyed);assert.equal(host.childElementCount,0);}
}}finally{dom.window.close();}
console.log(JSON.stringify({arm,surface,passed:true,observations,checks:['raw name/key suppress bound identities','raw values retain literal dollar strings','ordinary/raw declaration order matches peers','data updates retain or replace the actual effective identity','exact cleanup']}));
