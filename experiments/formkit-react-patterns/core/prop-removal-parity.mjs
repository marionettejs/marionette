// Observe actual bound-component removal semantics; differences remain explicit.
import assert from 'node:assert/strict';import {JSDOM} from 'jsdom';
const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','SVGElement','getComputedStyle'])globalThis[key] = dom.window[key];
Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator,configurable: true});
const mode = process.argv[2] ?? 'experiment',host = document.querySelector('main'),pause = ()=>new Promise(resolve=>setTimeout(resolve,40));
const widget = {type: 'input',props: {caption: {default: 'Default',setter: value=>value == null ? value : String(value).toUpperCase()}},schema: {$el: 'div',children: [{$el: 'span',attrs: {'data-caption': true},children: '$caption'},{$el: 'input',attrs: {value: '$_value',onInput: '$handlers.DOMInput',disabled: '$disabled',title: '$attrs.title',class: '$classes.input'}}]}};
let node,replace,destroy;
const initial = {name: 'widget',type: 'widget',caption: 'one',disabled: true,classes: {input: 'custom'},config: {delay: 0,locale: 'en'},title: 'Native title'};
if (mode === 'vue') {
  const {createApp,h,shallowRef,nextTick} = await import('vue');const {FormKit,plugin,defaultConfig} = await import('@formkit/vue');const spec = shallowRef(initial);
  const app = createApp({render: ()=>h(FormKit,{...spec.value,onNode: value=>{node = value;}})});app.use(plugin,defaultConfig({inputs: {widget}}));app.mount(host);await nextTick();replace = async next=>{spec.value = next;await nextTick();};destroy = ()=>app.unmount();
} else if (mode === 'react') {
  const {createElement: h} = await import('react'),{createRoot} = await import('react-dom/client'),{flushSync} = await import('react-dom'),{FormKit,FormKitProvider,defaultConfig} = await import('@formkit/react');const root = createRoot(host),config = defaultConfig({inputs: {widget}}),onNode = value=>{node = value;};replace = async next=>flushSync(()=>root.render(h(FormKitProvider,{config},h(FormKit,{...next,onNode}))));await replace(initial);destroy = ()=>flushSync(()=>root.unmount());
} else {
  const {mount} = await import('./index.mjs');const api = mount({host,fields: [initial],inputs: {widget}});node = api.node.at('widget');replace = async next=>api.setFields([next]);destroy = api.destroy;
}
const sample = ()=>({caption: node.props.caption,renderedCaption: host.querySelector('[data-caption]').textContent,title: host.querySelector('input').getAttribute('title'),customClass: host.querySelector('input').classList.contains('custom'),disabled: host.querySelector('input').disabled,delay: node.config.delay,locale: node.config.locale});
const report = {mode};
try {
  await pause();const original = host.querySelector('input');report.initial = sample();assert.equal(report.initial.caption,'ONE');
  await replace({...initial,caption: 'two'});await pause();report.updated = sample();
  // Every binding must deliver a provided declared prop through its setter.
  assert.equal(report.updated.caption,'TWO');assert.equal(report.updated.renderedCaption,'TWO');
  await replace({name: 'widget',type: 'widget',classes: {},disabled: false});await pause();report.omitted = sample();assert.equal(host.querySelector('input'),original);assert.equal(report.omitted.disabled,false);assert.equal(report.omitted.delay,0);
  await replace({name: 'widget',type: 'widget',caption: undefined,classes: {},disabled: false,config: {locale: 'fr'}});await pause();report.explicitUndefined = sample();report.status = 'passed';
  console.log(JSON.stringify(report));
} finally {destroy();dom.window.close();}
