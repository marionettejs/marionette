import assert from 'node:assert/strict';
import {setupProjectionDom,settle} from './schema-projection-reference.mjs';
const dom = setupProjectionDom(),arm = process.argv[2] ?? 'experiment',surface = process.argv[3] ?? 'document';let host = document.querySelector('main');if (surface === 'shadow') {host = host.attachShadow({mode: 'open'}).appendChild(document.createElement('article'));} const actualRoot = host.getRootNode();
const {getNode} = await import('@formkit/core');
const cases = [['type-undefined','type',undefined],['type-null','type',null],['name-null','name',null],['name-empty','name',''],['name-undefined','name',undefined]],observations = [];
let sequence = 0;
async function mountCase(schema,payload,track) {
  let node,update,destroy,state = {schema,data: payload,memoKey: 'defaults-' + sequence++ + '-initial'};const prefix = state.memoKey,advance = next=>state = {...state,...next,memoKey: next.memoKey === undefined ? state.memoKey : prefix + next.memoKey};
  const capture = n=>{track.nodes.push(n);n.on('destroyed',()=>track.destroyed.push(n));};
  if (arm === 'vue') {
    const {createApp,h,shallowRef,nextTick} = await import('vue');const {FormKit,FormKitSchema,FormKitRoot,FormKitProvider,defaultConfig} = await import('@formkit/vue');const current = shallowRef(state),config = defaultConfig({plugins: [capture],config: {delay: 0}});
    const app = createApp({render: ()=>h(FormKitProvider,{config},()=>h(FormKit,{type: 'form',actions: false,onNode: n=>node = n},()=>h(FormKit,{type: 'group',name: 'profile'},()=>h(FormKitRoot,null,()=>h(FormKitSchema,current.value)))))});destroy = ()=>app.unmount();app.mount(host);await nextTick();update = async next=>{advance(next);current.value = state;await nextTick();await settle();};
  } else if (arm === 'react') {
    const {createElement: h} = await import('react');const {createRoot} = await import('react-dom/client');const {flushSync} = await import('react-dom');const {FormKit,FormKitSchema,FormKitRoot,FormKitProvider,defaultConfig} = await import('@formkit/react');const root = createRoot(host),config = defaultConfig({plugins: [capture],config: {delay: 0}});
    const render = ()=>flushSync(()=>root.render(h(FormKitProvider,{config},h(FormKit,{type: 'form',actions: false,onNode: n=>node = n},h(FormKit,{type: 'group',name: 'profile'},h(FormKitRoot,null,h(FormKitSchema,state)))))));
    destroy = ()=>flushSync(()=>root.unmount());render();update = async next=>{advance(next);render();await settle();};
  } else {
    const {mount} = await import('./index.mjs');const api = mount({host,schema: {$formkit: 'group',name: 'profile',children: [{$cmp: 'FormKitRoot',children: {$cmp: 'FormKitSchema',props: {schema: '$schema',data: '$data',memoKey: '$memoKey'}}}]},data: state,plugins: [capture],formProps: {actions: false},config: {delay: 0}});node = api.node;destroy = ()=>api.destroy();update = async next=>{advance(next);api.updateData(state);await settle();};
  }
  await settle();return {node,update,destroy};
}
for (const [label,prop,override] of cases) {
  const id = 'defaults-' + surface + '-' + label,track = {nodes: [],destroyed: []},declaration = ()=>[{$cmp: 'FormKit',bind: '$fieldProps',props: {[prop]: '$override',label: '$label'}}],payload = {fieldProps: {type: prop === 'type' ? 'textarea' : 'text',name: 'kept',key: 'stable',id},override,label: 'Before'};let app,passed = false,error;
  try {
    app = await mountCase(declaration(),payload,track);const parent = app.node.at('profile'),field = parent.children[0],input = host.querySelector('input');assert.ok(field);assert.equal(parent.children.length,1);assert.equal(field.parent,parent);assert.equal(field.props.__root,actualRoot);assert.equal(field.props.type,'text');assert.ok(input);assert.equal(host.querySelector('textarea'),null);
    if (prop === 'name') {assert.notEqual(field.name,'kept');assert.ok(field.name);assert.equal(app.node.at('profile.kept'),undefined);} else {assert.equal(field.name,'kept');}
    await field.input('User edit');await settle();await app.update({data: {...payload,label: 'Data update'}});assert.ok(parent.children[0] === field);assert.ok(host.querySelector('input') === input);assert.equal(field.value,'User edit');
    await app.update({memoKey: 'changed'});assert.ok(parent.children[0] === field);assert.ok(host.querySelector('input') === input);assert.equal(field.value,'User edit');
    await app.update({schema: declaration()});assert.ok(parent.children[0] === field);assert.ok(host.querySelector('input') === input);assert.equal(field.value,'User edit');
    if (arm === 'experiment') {
      const {createSchemaController} = await import('./schema.mjs');let applied = 0;
      for (const bad of [[{$formkit: '$missing',name: 'strict'}],[{$formkit: 'text',name: null}],[{$formkit: 'text',name: ''}]]) {assert.throws(()=>createSchemaController({node: app.node,schema: bad,onFields: ()=>applied++}),/resolved type and name/);}
      assert.equal(applied,0,'component defaults must not relax explicit field projection validation');
    }
    await app.update({data: {...payload,fieldProps: {...payload.fieldProps,key: 'replacement'},label: 'Replaced'}});const replacement = parent.children[0];assert.ok(replacement !== field);assert.ok(host.querySelector('input') !== input);assert.equal(field.context == null,true);assert.equal(replacement.value,undefined);assert.equal(replacement.props.type,'text');assert.equal(replacement.parent,parent);passed = true;
  } catch (e) {error = {name: e.name,message: e.message};} finally {const ids = track.nodes.map(n=>n.props.id);app?.destroy();await settle();assert.equal(track.nodes.length,track.destroyed.length,label + ' releases every Core node');assert.equal(new Set(track.destroyed).size,track.nodes.length);assert.equal(host.childNodes.length,0);for (const releasedId of ids) {assert.equal(getNode(releasedId),undefined);}}
  observations.push({case: label,passed,error,created: track.nodes.length,destroyed: track.destroyed.length});
}
dom.window.close();console.log(JSON.stringify({arm,surface,observations,passed: observations.every(c=>c.passed),checks: ['explicit nullish type suppresses bound textarea then defaults to text','explicit null/empty/undefined name suppresses bound name then generates Core name','shared normalized anonymous outlet lookup','data/schema/memo retention and explicit-key replacement','native field projection validation stays strict','shared parent/actual DOM root','exact node/registry/DOM teardown']}));assert.ok(observations.every(c=>c.passed),'all supported component-default cases mount and retain correctly');
