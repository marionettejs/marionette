import assert from 'node:assert/strict';
import {setupProjectionDom,mountProjectionReference,settle} from './schema-projection-reference.mjs';
const dom=setupProjectionDom(),arm=process.argv[2]??'experiment',host=document.querySelector('main');
const cases=[['false',false],['true',true],['1 === 2',false],['2 > 1',true],['$: false',false],['$: true',true],['$show',false],['$show',true]];
for(const [condition,active] of cases){
  const schema=[{$formkit:'group',name:'g',children:[{if:condition,then:{$el:'section',children:[{$formkit:'text',name:'required',validation:'required',disabled:{if:'false',then:true,else:false}}]},else:{$el:'aside',children:[{$formkit:'text',name:'fallback'}]}}]}];
  const app=await mountProjectionReference(arm,host,schema,{show:active});
  try{
    const group=app.node.at('g');assert.deepEqual(group.children.map(n=>n.name),[active?'required':'fallback'],condition+' Core branch');
    assert.equal(!!host.querySelector('section input'),active);assert.equal(!!host.querySelector('aside input'),!active);
    assert.equal(host.querySelectorAll('input').length,1);assert.equal(app.node.context.state.valid,!active);
    if(active)assert.equal(host.querySelector('input').disabled,false,'conditional prop uses the compiled false branch');
    await app.submit();assert.equal(app.counts().submitted,active?0:1);assert.equal(app.counts().invalid,active?1:0);
  }finally{app.destroy();await settle();assert.equal(app.counts().created,app.counts().destroyed);assert.equal(host.childNodes.length,0);}
}
const schema=[{$formkit:'group',name:'g',children:[{if:'$show',then:{$el:'section',children:[{$formkit:'text',name:'required',label:'$title',validation:'required'}]},else:{$el:'aside',children:[{$formkit:'text',name:'fallback'}]}}]}];
const app=await mountProjectionReference(arm,host,schema,{show:false,title:'Before'});
try{
  const group=app.node.at('g'),fallback=app.node.at('g.fallback');await app.update({show:true,title:'Active'});
  const required=app.node.at('g.required'),input=host.querySelector('section input');assert.equal(app.node.at('g.fallback'),undefined);assert.equal(fallback.context==null,true);assert.equal(group.children.length,1);
  await required.input('edited');await settle();await app.update({show:true,title:'Updated'});
  assert.equal(app.node.at('g.required'),required);assert.equal(host.querySelector('input'),input);assert.equal(input.value,'edited');assert.equal(app.node.context.state.valid,true);
  await app.submit();assert.equal(app.counts().submitted,1);assert.equal(app.counts().invalid,0);
  await app.update({show:false,title:'Else'});assert.equal(app.node.at('g.required'),undefined);assert.equal(required.context==null,true);assert.equal(host.querySelector('section'),null);assert.deepEqual(Object.keys(group.value),['fallback']);
  await app.update({show:true,title:'Again'});assert.notEqual(app.node.at('g.required'),required);assert.equal(app.node.at('g.required').value,undefined);assert.equal(app.node.context.state.valid,false);
  await app.submit();assert.equal(app.counts().invalid,1);assert.equal(group.children.length,1);
}finally{app.destroy();await settle();assert.equal(app.counts().created,app.counts().destroyed);assert.equal(host.childNodes.length,0);dom.window.close();}
console.log(JSON.stringify({arm,passed:true,checks:['constant true/false and arithmetic conditions','dynamic conditions and else toggles','conditional prop expressions','required submission','retained active Core/DOM/edit','removed branch value/node cleanup','exact node teardown']}));
