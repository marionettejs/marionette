function followValues(node,update) {let dead = false,pending = false,last = JSON.stringify(node.value);const r = node.on('commit',()=>{if (pending || dead) return;pending = true;queueMicrotask(()=>{pending = false;if (dead) return;const next = JSON.stringify(node.value);if (next !== last) {last = next;update(node.value)}})});return ()=>{dead = true;node.off(r)}}
export const conditionalSchema = [{$el: 'fieldset',attrs: {class: 'details'},children: [
  {$el: 'legend',children: 'Contact details'},
  {$el: 'p',attrs: {class: 'intro'},children: '$values.mode'},
  {$el: 'ul',children: [
    {$el: 'li',children: [{$formkit: 'text',name: 'mode',label: 'Mode'}]},
    {$el: 'li',children: [{$formkit: 'textarea',name: 'notes',label: 'Notes'}]},
    {if: '$values.mode === \'show\'',then: {$el: 'li',attrs: {class: 'extra'},children: [{$formkit: 'text',name: 'extra',label: 'Extra'}]}}
  ]}
]}];
export async function mountSchemaReference(arm,host) {
  const initial = {mode: 'edit'};let node,receipt,dispose;
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
    const {mount} = await import('../core/index.mjs');const api = mount({host,schema: conditionalSchema,values: initial,formProps: {actions: false}});node = api.node;dispose = ()=>api.destroy();
  }
  return {get node() {return node},destroy: ()=>{if (receipt)receipt();dispose()}};
}
