import assert from 'node:assert/strict';
import {setupProjectionDom,settle} from './schema-projection-reference.mjs';
const dom = setupProjectionDom(),arm = process.argv[2] ?? 'experiment',surface = process.argv[3] ?? 'document',selected = process.argv[4] ?? 'all';
let host = document.querySelector('main');if (surface === 'shadow')host = host.attachShadow({mode: 'open'}).appendChild(document.createElement('article'));
const actualRoot = host.getRootNode();let sequence = 0;
async function mountSchema(schema,payload) {
  let node,update,destroy,created = 0,destroyed = 0;const nodes = [],capture = n=>{created++;nodes.push(n);n.on('destroyed',()=>destroyed++);};
  const prefix = 'retention-case-' + sequence++ + '-';let state = {schema,data: payload,memoKey: prefix + 'one'};
  const advance = next=>state = {...state,...next,memoKey: next.memoKey === undefined ? state.memoKey : prefix + next.memoKey};
  if (arm === 'vue') {
    const {h,createApp,shallowRef,nextTick} = await import('vue');const {FormKit,FormKitProvider,FormKitRoot,FormKitSchema,defaultConfig} = await import('@formkit/vue');
    const current = shallowRef(state),config = defaultConfig({plugins: [capture],config: {delay: 0}});
    const app = createApp({render: ()=>h(FormKitProvider,{config},()=>h(FormKit,{type: 'form',actions: false,onNode: n=>node = n},()=>h(FormKit,{type: 'group',name: 'profile'},()=>h(FormKitRoot,null,()=>h(FormKitSchema,current.value)))))});
    app.mount(host);destroy = ()=>app.unmount();update = async next=>{advance(next);current.value = state;await nextTick();await settle();};await nextTick();
  } else if (arm === 'react') {
    const {createElement: h} = await import('react');const {createRoot} = await import('react-dom/client');const {flushSync} = await import('react-dom');const {FormKit,FormKitProvider,FormKitRoot,FormKitSchema,defaultConfig} = await import('@formkit/react');
    const root = createRoot(host),config = defaultConfig({plugins: [capture],config: {delay: 0}});
    const render = ()=>flushSync(()=>root.render(h(FormKitProvider,{config},h(FormKit,{type: 'form',actions: false,onNode: n=>node = n},h(FormKit,{type: 'group',name: 'profile'},h(FormKitRoot,null,h(FormKitSchema,state)))))));
    render();destroy = ()=>flushSync(()=>root.unmount());update = async next=>{advance(next);render();await settle();};
  } else {
    const {mount} = await import('./index.mjs');const api = mount({host,schema: {$formkit: 'group',name: 'profile',children: [{$cmp: 'FormKitRoot',children: {$cmp: 'FormKitSchema',props: {schema: '$schema',data: '$data',memoKey: '$memoKey'}}}]},data: state,plugins: [capture],formProps: {actions: false},config: {delay: 0}});
    node = api.node;destroy = ()=>api.destroy();update = async next=>{advance(next);api.updateData(state);await settle();};
  }
  await settle();return {node,update,destroy,nodes,counts: ()=>({created,destroyed})};
}
async function cleanup(app) {const ids = app.nodes.map(n=>n.props.id);app.destroy();await settle();assert.equal(app.counts().created,app.counts().destroyed);assert.equal(host.childNodes.length,0);const {getNode} = await import('@formkit/core');for (const id of ids)assert.equal(getNode(id),undefined);}
const observations = [];
for (const syntax of ['bind','object']) for (const operation of ['data','schema','memo','schema-memo','key','key-remove']) {
  if (selected === 'bind' && (syntax !== 'bind' || operation.startsWith('key'))) continue;
  if (selected === 'key' && (syntax !== 'object' || !operation.startsWith('key'))) continue;
  if (selected === 'contracts') continue;
  const id = 'retained-' + sequence++,payload = {fieldProps: {type: 'text',name: 'kept',id,key: 'stable',placeholder: 'Bound'},identityKey: 'stable',label: 'Before'};
  const declaration = ()=>[syntax === 'bind' ? {$cmp: 'FormKit',bind: '$fieldProps',props: {label: '$label'}} : {$cmp: 'FormKit',props: {type: 'text',name: 'kept',id,key: '$identityKey',label: '$label'}}];
  const schema = declaration(),app = await mountSchema(schema,payload);
  try {
    const parent = app.node.at('profile'),before = app.node.at('profile.kept'),input = host.querySelector('input');assert.ok(before);assert.equal(before.parent,parent);assert.equal(before.props.__root,actualRoot);if (syntax === 'bind')assert.equal(input.placeholder,'Bound');
    input.value = 'User edit';input.dispatchEvent(new Event('input',{bubbles: true}));await settle();assert.equal(before.value,'User edit');
    const next = {};if (operation === 'data')next.data = {...payload,label: 'After'};
    if (operation === 'schema' || operation === 'schema-memo')next.schema = declaration();
    if (operation === 'memo' || operation === 'schema-memo')next.memoKey = 'two';
    if (operation === 'schema-memo')next.schema.push({$cmp: 'FormKit',props: {type: 'text',name: 'added',key: 'added'}});
    if (operation === 'key')next.data = {...payload,fieldProps: {...payload.fieldProps,key: 'changed'},identityKey: 'changed'};
    if (operation === 'key-remove') {const {key,...fieldProps} = payload.fieldProps;next.data = {...payload,fieldProps,identityKey: undefined};}
    await app.update(next);
    const after = app.node.at('profile.kept'),afterInput = host.querySelector('input');assert.equal(app.node.at('profile'),parent);assert.equal(after.parent,parent);assert.equal(after.props.__root,actualRoot);
    if (operation.startsWith('key')) {assert.ok(after !== before,syntax + ' changed key replaces Core');assert.notEqual(afterInput,input);assert.equal(before.context == null,true);assert.equal(after.value,undefined);assert.equal(afterInput.value,'');} else {assert.ok(after === before,syntax + ' ' + operation + ' retains Core');assert.equal(afterInput,input);assert.equal(after.value,'User edit');assert.equal(afterInput.value,'User edit');}
    assert.equal(parent.children.length,operation === 'schema-memo' ? 2 : 1);if (operation === 'schema-memo')assert.ok(app.node.at('profile.added'));
    observations.push({syntax,operation,sameCore: after === before,sameDom: afterInput === input,value: after.value ?? null});
  } finally {await cleanup(app);}
}
if (selected === 'all' || selected === 'contracts') {
  for (const explicit of [false,true]) {
    const schema = [{$cmp: 'FormKit',bind: '$fieldProps',props: explicit ? {type: 'text',name: 'override',key: 'explicit',label: '$label',placeholder: 'Explicit',__raw__help: '$literal help'} : {label: '$label'}}];
    const app = await mountSchema(schema,{fieldProps: {type: 'textarea',name: 'bound',key: 'bound',placeholder: 'Bound',help: 'Bound help'},label: 'Type check'});
    try {const field = app.node.at('profile.' + (explicit ? 'override' : 'bound')),input = host.querySelector('input,textarea');assert.ok(field,(explicit ? 'explicit' : 'bound') + ' field; actual names ' + app.node.at('profile').children.map(n=>n.name));assert.equal(field.props.type,explicit ? 'text' : 'textarea');assert.equal(input.tagName,explicit ? 'INPUT' : 'TEXTAREA');assert.equal(input.placeholder,explicit ? 'Explicit' : 'Bound');if (explicit)assert.equal(field.props.help,'$literal help');} finally {await cleanup(app);}
  }
  const defaultType = await mountSchema([{$cmp: 'FormKit',bind: '$: $fieldProps',props: {label: '$label'}}],{fieldProps: {name: 'defaulted',key: 'defaulted'},label: 'Default type'});
  try {assert.equal(defaultType.node.at('profile.defaulted').props.type,'text');assert.equal(host.querySelector('input').type,'text');} finally {await cleanup(defaultType);}
  const anonymousSchema = ()=>[{$cmp: 'FormKit',bind: '$fieldProps',props: {label: '$label'}}],anonymous = await mountSchema(anonymousSchema(),{fieldProps: {type: 'text',key: 'anonymous-stable'},label: 'Anonymous'});
  try {const parent = anonymous.node.at('profile'),field = parent.children[0],input = host.querySelector('input');await field.input('Anonymous edit');await settle();await anonymous.update({schema: anonymousSchema(),memoKey: 'two'});assert.equal(parent.children[0],field);assert.equal(host.querySelector('input'),input);assert.equal(field.value,'Anonymous edit');} finally {await cleanup(anonymous);}
  const loopSchema = ()=>[{$cmp: 'FormKit',for: ['row','i','$rows'],bind: '$row.props',props: {label: '$row.label'}}],data = {rows: [{props: {type: 'text',name: 'a',key: 'a'},label: 'A'},{props: {type: 'textarea',name: 'b',key: 'b'},label: 'B'}]};
  const loop = await mountSchema(loopSchema(),data);
  try {const a = loop.node.at('profile.a'),b = loop.node.at('profile.b'),input = host.querySelector('input'),textarea = host.querySelector('textarea');await a.input('A edit');await b.input('B edit');await settle();await loop.update({schema: loopSchema(),memoKey: 'two',data: {rows: [data.rows[1],{...data.rows[0],label: 'A updated'}]}});assert.equal(loop.node.at('profile.a'),a);assert.equal(loop.node.at('profile.b'),b);assert.equal(host.querySelector('input'),input);assert.equal(host.querySelector('textarea'),textarea);assert.equal(a.value,'A edit');assert.equal(b.value,'B edit');assert.equal(a.props.label,'A updated');} finally {await cleanup(loop);}
}
dom.window.close();console.log(JSON.stringify({arm,surface,selected,passed: true,observations,checks: ['legal bind/object stable Schema/memo/data retention','changed/removed explicit key replaces named owner','bound textarea and explicit precedence/raw props','anonymous bound-key retention','loop lexical scope and reorder','native parent and actual DOM root','exact teardown and registry cleanup']}));
