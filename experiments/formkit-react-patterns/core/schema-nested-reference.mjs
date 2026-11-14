function followValues(node,update) {let dead = false,pending = false,last = JSON.stringify(node.value);const r = node.on('commit',()=>{if (pending || dead) {return;}pending = true;queueMicrotask(()=>{pending = false;if (dead) {return;} const next = JSON.stringify(node.value);if (next !== last) {last = next;update(node.value)}})});return ()=>{dead = true;node.off(r)}}
export const conditionalSchema = [{$formkit: 'group',name: 'profile',children: [
  {$formkit: 'text',name: 'mode',label: 'Mode'},
  {$formkit: 'textarea',name: 'notes',label: '$values.profile.mode',disabled: '$values.profile.mode === \'lock\''},
  {$formkit: 'checkbox',name: 'consent',label: 'Consent',validation: 'accepted',validationVisibility: 'live'},
  {$formkit: 'select',name: 'choice',label: 'Choice',options: [{label: 'Choose',value: ''},{label: 'Two',value: 2}]},
  {$formkit: 'text',name: 'extra',label: 'Extra',if: '$values.profile.mode === \'show\''}
]}];
export async function mountSchemaReference(arm,host) {
  const initial = {profile: {mode: 'edit',choice: ''}};let node,receipt,dispose;
  if (arm === 'vue') {
    const {createApp,h,shallowRef,nextTick} = await import('vue');const {FormKit,FormKitSchema,plugin,defaultConfig} = await import('@formkit/vue');
    const data = shallowRef({values: initial});
    const app = createApp({render: ()=>h(FormKit,{type: 'form',actions: false,value: initial,onNode: n=>{node = n;receipt = followValues(n,value=>{data.value = {values: value}})}},{default: ()=>h(FormKitSchema,{schema: conditionalSchema,data: data.value})})});
    app.use(plugin,defaultConfig({config: {delay: 0}}));app.mount(host);await nextTick();dispose = ()=>app.unmount();
  } else if (arm === 'react') {
    const React = await import('react');const {createRoot} = await import('react-dom/client');const {flushSync} = await import('react-dom');const {FormKit,FormKitSchema,FormKitProvider,defaultConfig} = await import('@formkit/react');
    const root = createRoot(host),config = defaultConfig({config: {delay: 0}});
    function App() {const [data,setData] = React.useState({values: initial});const onNode = React.useCallback(n=>{node = n;receipt = followValues(n,value=>setData({values: value}));},[]);return React.createElement(FormKitProvider,{config},React.createElement(FormKit,{type: 'form',actions: false,value: initial,onNode},React.createElement(FormKitSchema,{schema: conditionalSchema,data})));}
    flushSync(()=>root.render(React.createElement(App)));dispose = ()=>flushSync(()=>root.unmount());
  } else if (arm === 'current') {
    const {FormView} = await import('../current-303ddfbb/index.mjs');const {Region} = await import('marionette');const form = new FormView({values: initial,schema: conditionalSchema,schemaData: {values: initial},config: {delay: 0},formProps: {actions: false}});const region = new Region({el: host});region.show(form);node = form.node;receipt = followValues(node,value=>form.setSchemaData({values: value}));dispose = ()=>region.destroy();
  } else {
    const {mount} = await import('../core/index.mjs');const {createSchemaController} = await import('../core/schema.mjs');const api = mount({host,fields: [],values: initial});node = api.node;const controller = createSchemaController({node,schema: conditionalSchema,onFields: fs=>api.setFields(fs)});dispose = ()=>{controller.destroy();api.destroy()};
  }
  return {get node() {return node},destroy: ()=>{if (receipt) {receipt();}dispose()}};
}
