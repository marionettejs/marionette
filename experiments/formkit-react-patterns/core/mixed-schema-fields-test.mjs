import assert from 'node:assert/strict';
import {setupProjectionDom,settle} from './schema-projection-reference.mjs';
const dom = setupProjectionDom(),arm = process.argv[2] ?? 'experiment',host = document.querySelector('main');
const {reset,getNode} = await import('@formkit/core');
const initial = {direct: 'Direct initial',generated: 'Schema initial'};
const directFields = [{type: 'text',name: 'direct',label: 'Direct',validation: 'required'}];
const makeSchema = (extra = false)=>[{$el: 'section',attrs: {'data-schema': 'yes'},children: [{$formkit: 'text',name: 'generated',label: '$caption',validation: 'required',if: '$showSchema'},...(extra ? [{$formkit: 'text',name: 'secondGenerated'}] : [])]}];
let state = {fields: directFields,schema: makeSchema(),data: {caption: 'Generated',showSchema: true}},node,api,update,destroy,created = 0,destroyed = 0,submitted = [],invalid = 0;
const nodes = [],capture = n=>{created++;nodes.push(n);n.on('destroyed',()=>destroyed++);};
const formProps = {type: 'form',actions: false,value: structuredClone(initial),onNode: n=>node = n,onSubmit: value=>submitted.push(structuredClone(value)),onSubmitInvalid: ()=>invalid++};
if (arm === 'vue') {
  const {createApp,h,shallowRef,nextTick} = await import('vue');const {FormKit,FormKitSchema,plugin,defaultConfig} = await import('@formkit/vue');const current = shallowRef(state);
  const app = createApp({render: ()=>h(FormKit,formProps,{default: ()=>[...current.value.fields.map(spec=>h(FormKit,{...spec,key: spec.key ?? spec.name})),h(FormKitSchema,{key: 'schema',schema: current.value.schema,data: current.value.data})]})});
  app.use(plugin,defaultConfig({plugins: [capture],config: {delay: 0}}));app.mount(host);await nextTick();destroy = ()=>app.unmount();update = async next=>{state = {...state,...next};current.value = state;await nextTick();await settle();};
} else if (arm === 'react') {
  const React = await import('react');const {createRoot} = await import('react-dom/client');const {flushSync} = await import('react-dom');const {FormKit,FormKitSchema,FormKitProvider,defaultConfig} = await import('@formkit/react');const ui = createRoot(host),config = defaultConfig({plugins: [capture],config: {delay: 0}});
  const render = ()=>flushSync(()=>ui.render(React.createElement(FormKitProvider,{config},React.createElement(FormKit,formProps,...state.fields.map(spec=>React.createElement(FormKit,{...spec,key: spec.key ?? spec.name})),React.createElement(FormKitSchema,{key: 'schema',schema: state.schema,data: state.data})))));
  render();destroy = ()=>flushSync(()=>ui.unmount());update = async next=>{state = {...state,...next};render();await settle();};
} else {
  const {mount} = await import('./index.mjs');api = mount({host,fields: state.fields,schema: state.schema,data: state.data,values: initial,plugins: [capture],config: {delay: 0},formProps: {actions: false},onSubmit: formProps.onSubmit,onSubmitInvalid: formProps.onSubmitInvalid});node = api.node;destroy = ()=>api.destroy();
  update = async next=>{state = {...state,...next};if ('fields' in next) {api.setFields(next.fields);} if ('schema' in next) {api.setSchema(next.schema);} if ('data' in next) {api.updateData(next.data);} await settle();};
}
await settle();
const input = name=>host.querySelector(`[name="${name}"]`),errors = n=>n.store.reduce((a,m)=>m.type === 'error' ? [...a,m.value] : a,[]),submit = async()=>{host.querySelector('form').dispatchEvent(new Event('submit',{bubbles: true,cancelable: true}));await settle();};
try {
  assert.equal(host.querySelectorAll('form').length,1);assert.equal(node.children.length,2);assert.ok(node.children.every(n=>n.parent === node && n.type === 'input'));assert.deepEqual(node.value,initial);
  const direct = node.at('direct'),generated = node.at('generated'),directInput = input('direct'),generatedInput = input('generated');assert.ok(direct && generated);assert.ok(host.querySelector('section input') === generatedInput);
  node.setErrors(['Root error'],{direct: 'Direct error',generated: 'Schema error'});await settle();assert.deepEqual(errors(direct),['Direct error']);assert.deepEqual(errors(generated),['Schema error']);assert.deepEqual(errors(node),['Root error']);node.clearErrors(true);await settle();
  await direct.input('');await settle();assert.equal(node.context.state.valid,false);await submit();assert.equal(invalid,1);assert.equal(submitted.length,0);
  await direct.input('Direct edit');await generated.input('');await settle();assert.equal(node.context.state.valid,false);await generated.input('Schema edit');await settle();assert.equal(node.context.state.valid,true);await submit();assert.deepEqual(submitted.at(-1),{direct: 'Direct edit',generated: 'Schema edit'});
  reset(node);await settle();assert.deepEqual(node.value,initial);assert.ok(node.at('direct') === direct);assert.ok(node.at('generated') === generated);assert.ok(input('direct') === directInput);assert.ok(input('generated') === generatedInput);assert.equal(directInput.value,initial.direct);assert.equal(generatedInput.value,initial.generated);
  await update({data: {caption: 'Hidden',showSchema: false}});assert.equal(node.at('generated'),undefined);assert.equal(generated.context == null,true);assert.ok(node.at('direct') === direct);assert.ok(input('direct') === directInput);assert.deepEqual(node.value,{direct: initial.direct});
  await update({fields: [...directFields,{type: 'text',name: 'extraDirect'}]});const extraDirect = node.at('extraDirect');assert.ok(extraDirect);assert.equal(extraDirect.parent,node);assert.equal(node.children.length,2);
  await update({data: {caption: 'Shown',showSchema: true}});const retainedSchema = node.at('generated'),retainedInput = input('generated');assert.ok(retainedSchema);assert.deepEqual([...host.querySelectorAll('input')].map(el=>el.name),['direct','extraDirect','generated']);await retainedSchema.input('Retained schema edit');await settle();
  await update({schema: makeSchema(true)});assert.ok(node.at('generated') === retainedSchema);assert.ok(input('generated') === retainedInput);assert.equal(retainedSchema.value,'Retained schema edit');assert.ok(node.at('extraDirect') === extraDirect);assert.equal(node.at('secondGenerated').parent,node);assert.ok(node.at('direct') === direct);
  await update({fields: directFields});assert.equal(node.at('extraDirect'),undefined);assert.equal(extraDirect.context == null,true);assert.ok(node.at('generated') === retainedSchema);assert.ok(node.at('secondGenerated'));
  await update({schema: arm === 'experiment' ? undefined : []});assert.equal(node.at('generated'),undefined);assert.equal(node.at('secondGenerated'),undefined);assert.ok(node.at('direct') === direct);assert.ok(input('direct') === directInput);assert.equal(node.children.length,1);
  await update({schema: makeSchema()});const schemaOnly = node.at('generated'),schemaOnlyInput = input('generated');assert.ok(schemaOnly);assert.ok(schemaOnly !== retainedSchema);
  schemaOnlyInput.focus();await update({fields: []});assert.equal(document.activeElement,schemaOnlyInput);assert.equal(node.at('direct'),undefined);assert.equal(direct.context == null,true);assert.ok(node.at('generated') === schemaOnly);assert.ok(input('generated') === schemaOnlyInput);assert.equal(node.children.length,1);
  await update({fields: directFields});assert.equal(document.activeElement,schemaOnlyInput);assert.deepEqual([...host.querySelectorAll('input')].map(el=>el.name),['direct','generated']);assert.ok(node.at('direct'));assert.equal(node.at('direct').parent,node);assert.ok(node.at('generated') === schemaOnly);node.input({direct: 'Final direct',generated: 'Final schema'},false);await settle();await submit();assert.deepEqual(submitted.at(-1),{direct: 'Final direct',generated: 'Final schema'});
  if (api) {assert.throws(()=>api.setFields([{name: 'generated'}]),/Unique sibling names/);assert.equal(node.children.length,2);const keptDirect = node.at('direct');api.setSlots({default: {$el: 'article',children: ['$slots.fields']}});assert.equal(host.querySelectorAll('article input').length,2);assert.ok(node.at('direct') === keptDirect);assert.ok(node.at('generated') === schemaOnly);api.setSlots({});}
} finally {
  const ids = nodes.map(n=>n.props.id);destroy();await settle();assert.equal(created,destroyed);assert.equal(host.childNodes.length,0);for (const id of ids) {assert.equal(getNode(id),undefined);}dom.window.close();
}
console.log(JSON.stringify({arm,passed: true,created,destroyed,checks: ['direct FormKit and Schema siblings share one Core form','flat shared values and validation/errors','submit and reset both sources','independent schema/direct add/remove/replacement','retained sibling Core/DOM/edit identity','schema removal preserves direct fields and vice versa','root redraw and unique sibling names','exact node/registry/DOM teardown']}));
