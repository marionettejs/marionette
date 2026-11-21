import {fields,values,classes} from './fixtures.mjs';
export async function mountReference(arm,host,count,options = {}) {
  const testClasses = options.classes ?? classes;const testFields = options.fields ?? fields(count).map(f=>({...f,classes: testClasses}));
  const core = await import('@formkit/core');
  let node;
  if (arm === 'vue') {
    const {createApp,h,nextTick,shallowRef} = await import('vue');
    const {FormKit,plugin,defaultConfig} = await import('@formkit/vue');
    const list = shallowRef(testFields);
    const app = createApp({render: ()=>h(FormKit,{type: 'form',actions: false,id: 'study-root',value: values(count),onNode: n=>node = n},{default: ()=>list.value.map(f=>h(FormKit,{...f,key: f.name}))})});
    app.use(plugin,defaultConfig({config: {delay: 0,classes: testClasses}}));app.mount(host);await nextTick();
    return {get node() {return node ?? core.getNode('study-root')},setFields: async fs=>{list.value = fs;await nextTick()},reset: ()=>core.reset(node),destroy: ()=>app.unmount()};
  }
  const React = await import('react');const {createRoot} = await import('react-dom/client');const {flushSync} = await import('react-dom');
  const {FormKit,FormKitProvider,defaultConfig} = await import('@formkit/react');
  const root = createRoot(host);const config = defaultConfig({config: {delay: 0,classes: testClasses}});
  const render = fs=>flushSync(()=>root.render(React.createElement(FormKitProvider,{config},React.createElement(FormKit,{type: 'form',actions: false,id: 'study-root',value: values(count),onNode: n=>node = n},...fs.map(f=>React.createElement(FormKit,{...f,key: f.name}))))));
  render(testFields);
  return {get node() {return node ?? core.getNode('study-root')},setFields: render,reset: ()=>core.reset(node),destroy: ()=>flushSync(()=>root.unmount())};
}

export async function mountCurrent(host,count,options = {}) {
  const testClasses = options.classes ?? classes;const testFields = options.fields ?? fields(count).map(f=>({...f,classes: testClasses}));
  const {FormView} = await import('../current-303ddfbb/index.mjs');const {Region} = await import('marionette');
  const schema = fs=>fs.map(({type,...f})=>({$formkit: type,...f}));
  const form = new FormView({values: values(count),schema: schema(testFields),config: {delay: 0,classes: testClasses},formProps: {actions: false,id: 'study-root'}});
  const region = new Region({el: host});region.show(form);
  return {node: form.node,setFields: fs=>form.setSchema(schema(fs)),reset: ()=>form.resetForm(),destroy: ()=>region.destroy()};
}
