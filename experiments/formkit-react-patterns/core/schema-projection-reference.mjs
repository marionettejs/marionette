// Shared public mounting apparatus for the projection regression peer fixtures.
import {JSDOM} from 'jsdom';
export function setupProjectionDom() {
  const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});
  for (const key of ['window','document','Document','ShadowRoot','Node','Element','HTMLElement','SVGElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
  Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator,configurable: true});
  return dom;
}
export const settle = ()=>new Promise(resolve=>setTimeout(resolve,20));
export async function mountProjectionReference(arm,host,schema,data = {}) {
  let node,update,destroy,created = 0,destroyed = 0,submitted = 0,invalid = 0;
  const nodes = [],capture = n=>{created++;nodes.push(n);n.on('destroyed',()=>destroyed++);};
  const formProps = {type: 'form',actions: false,onNode: n=>node = n,onSubmit: ()=>submitted++,onSubmitInvalid: ()=>invalid++};
  if (arm === 'vue') {
    const {createApp,h,shallowRef,nextTick} = await import('vue');
    const {FormKit,FormKitSchema,plugin,defaultConfig} = await import('@formkit/vue');
    const state = shallowRef(data),app = createApp({render: ()=>h(FormKit,formProps,{default: ()=>h(FormKitSchema,{schema,data: state.value})})});
    destroy = ()=>app.unmount();app.use(plugin,defaultConfig({plugins: [capture],config: {delay: 0}}));app.mount(host);await nextTick();
    update = async next=>{state.value = next;await nextTick();await settle();};
  } else if (arm === 'react') {
    const React = await import('react');const {createRoot} = await import('react-dom/client');const {flushSync} = await import('react-dom');
    const {FormKit,FormKitSchema,FormKitProvider,defaultConfig} = await import('@formkit/react');
    const root = createRoot(host),config = defaultConfig({plugins: [capture],config: {delay: 0}});let setData;
    function App() {const [state,set] = React.useState(data);setData = set;return React.createElement(FormKitProvider,{config},React.createElement(FormKit,formProps,React.createElement(FormKitSchema,{schema,data: state})));}
    destroy = ()=>flushSync(()=>root.unmount());flushSync(()=>root.render(React.createElement(App)));
    update = async next=>{flushSync(()=>setData(next));await settle();};
  } else {
    const {mount} = await import('./index.mjs');
    const api = mount({host,schema,data,plugins: [capture],config: {delay: 0},formProps: {actions: false},onSubmit: formProps.onSubmit,onSubmitInvalid: formProps.onSubmitInvalid});
    node = api.node;destroy = ()=>api.destroy();update = async next=>{api.updateData(next);await settle();};
  }
  await settle();
  return {node,update,destroy,nodes,counts: ()=>({created,destroyed,submitted,invalid}),async submit() {host.querySelector('form').dispatchEvent(new Event('submit',{bubbles: true,cancelable: true}));await settle();}};
}
