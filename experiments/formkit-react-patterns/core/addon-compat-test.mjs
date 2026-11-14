import {JSDOM} from 'jsdom';
import assert from 'node:assert/strict';

const dom = new JSDOM('<body><main></main>',{url: 'http://localhost'});
for (const k of ['window','document','Node','Element','HTMLElement','SVGElement','HTMLButtonElement','HTMLInputElement','HTMLTextAreaElement','HTMLFormElement','Event','KeyboardEvent','CustomEvent','MutationObserver','getComputedStyle','localStorage']) {globalThis[k] = dom.window[k];}
Object.defineProperty(globalThis,'navigator',{value: dom.window.navigator,configurable: true});
const addons = await import('@formkit/addons');
const {createSchemaController} = await import('./schema.mjs');
const {mount} = await import(process.env.ADDON_ADAPTER ?? './index.mjs');
const tick = (ms = 45)=>new Promise(r=>setTimeout(r,ms));
const arm = process.argv[2] ?? 'adapter';
let host = document.querySelector('main'),scope = document;
if (arm === 'shadow') {scope = host.attachShadow({mode: 'open'});host = document.createElement('div');scope.append(host);}
let api,root,set,destroy;
const plugins = [addons.createMultiStepPlugin()];
const fields = [{type: 'multi-step',name: 'wizard',allowIncomplete: false,children: [{type: 'step',name: 'one',label: 'First',children: [{type: 'text',name: 'first',label: 'Name',validation: 'required',validationVisibility: 'blur'}]},{type: 'step',name: 'two',label: 'Second',children: [{type: 'textarea',name: 'second',label: 'Details'}]}]}];
if (['adapter','projection','shadow'].includes(arm)) {
  api = mount({host,fields: arm === 'projection' ? [] : fields,plugins,config: {delay: 0},formProps: {actions: false}}); root = api.node;set = next=>api.setFields(next);destroy = ()=>api.destroy();
  if (arm === 'projection') {const toSchema = spec=>{const {type,children,...props} = spec;return {$formkit: type,...props,...(children ? {children: children.map(toSchema)} : {})};};const schema = createSchemaController({node: root,schema: fields.map(toSchema),onFields: next=>api.setFields(next)});schema.destroy();}
} else if (arm === 'vue') {
  const {createApp,h,shallowRef} = await import('vue');const {FormKit,plugin,defaultConfig} = await import('@formkit/vue');const state = shallowRef(fields);
  const render = spec=>h(FormKit,{...Object.fromEntries(Object.entries(spec).filter(([key])=>key !== 'children')),key: spec.name},()=>spec.children?.map(render));
  const app = createApp({render: ()=>h(FormKit,{type: 'form',actions: false,onNode: n=>root = n},()=>state.value.map(render))});app.use(plugin,defaultConfig({plugins,config: {delay: 0}}));app.mount(host);set = next=>{state.value = next;};destroy = ()=>app.unmount();
} else {
  const {createElement: h} = await import('react');const {createRoot} = await import('react-dom/client');const {flushSync} = await import('react-dom');const {FormKit,FormKitProvider,defaultConfig} = await import('@formkit/react');const r = createRoot(host),config = defaultConfig({plugins,config: {delay: 0}});
  const render = spec=>h(FormKit,{...Object.fromEntries(Object.entries(spec).filter(([key])=>key !== 'children')),key: spec.name},...spec.children?.map(render) ?? []);
  set = next=>flushSync(()=>r.render(h(FormKitProvider,{config},h(FormKit,{type: 'form',actions: false,onNode: n=>root = n},...next.map(render)))));set(fields);destroy = ()=>flushSync(()=>r.unmount());
}
await tick();
const wizard = root.at('wizard'),first = root.at('wizard.one.first');
assert.equal(wizard.type,'group');assert.equal(root.at('wizard.one').type,'group');
const report = stage=>({stage,active: wizard.props.activeStep,tabs: [...host.querySelectorAll('[role=tab]')].map(el=>({text: el.textContent,selected: el.getAttribute('aria-selected')})),panels: [...host.querySelectorAll('[role=tabpanel]')].map(el=>({hidden: el.hidden,text: el.textContent})),values: structuredClone(root.value)});
if (process.env.ADDON_DEBUG) {console.log(JSON.stringify({schema: wizard.props.definition.schema({}),steps: wizard.props.steps.map(s=>({show: s.showStepErrors,total: s.totalErrorCount,valid: s.isValid,blocking: s.blockingCount,error: s.errorCount}))}));}
assert.equal(wizard.props.__root,scope);
const evidence = [report('initial')];
assert.equal(host.querySelectorAll('[role=tab]').length,2);assert.equal(host.querySelectorAll('[role=tab]')[1].getAttribute('aria-selected'),'false');assert.equal(host.querySelectorAll('[role=tab]')[0].textContent,'First');assert.equal(host.querySelectorAll('[role=tabpanel]').length,2);assert.equal(wizard.props.activeStep,'one');
host.querySelector('[data-next=true]').click();await tick();assert.equal(wizard.props.activeStep,'one');assert.equal(first.context.state.submitted,true);evidence.push(report('invalid-blocked'));
const input = host.querySelector('input');input.value = 'Paul';input.dispatchEvent(new Event('input',{bubbles: true}));await tick();
host.querySelector('[data-next=true]').click();await tick();assert.equal(wizard.props.activeStep,'two');assert.equal(host.querySelectorAll('[role=tabpanel]')[1].hidden,false);assert.equal(host.querySelectorAll('[role=tab]')[1].getAttribute('aria-selected'),'true');assert.equal(scope.activeElement,host.querySelectorAll('[role=tab]')[1]);evidence.push(report('valid-next'));
host.querySelector('[data-prev=true]').click();await tick();assert.equal(wizard.props.activeStep,'one');
const nextButton = host.querySelector('[data-next=true]');nextButton.focus();nextButton.dispatchEvent(new KeyboardEvent('keydown',{key: 'Tab',bubbles: true,cancelable: true}));await tick();assert.equal(wizard.props.activeStep,'two');
wizard.previous();await tick();wizard.goTo('two');await tick();assert.equal(wizard.props.activeStep,'two');
const updated = [{...fields[0],children: [{...fields[0].children[0],label: 'Updated first'},{type: 'step',name: 'three',label: 'Third',children: [{type: 'text',name: 'third'}]}]}];
set(updated);await tick();assert.equal(root.at('wizard.one.first'),first);assert.equal(host.querySelectorAll('[role=tab]').length,2);assert.ok(host.textContent.includes('Third'));assert.equal(wizard.props.activeStep,'one');assert.equal(root.at('wizard.two'),undefined);evidence.push(report('replace-step'));
// A newly mounted multi-step must work after the initial prepare pass as well.
set([...updated,{type: 'multi-step',name: 'late',children: [{type: 'step',name: 'lateOne',children: [{type: 'text',name: 'lateText'}]}]}]);await tick();assert.equal(root.at('late.lateOne.lateText').type,'input');assert.equal(host.querySelectorAll('[role=tab]').length,3);
const tracked = [];root.walk(n=>{n.on('destroyed',()=>tracked.push(n.uid));});const expected = [];root.walk(n=>expected.push(n.uid));destroy();await tick();assert.equal(host.childElementCount,0);assert.deepEqual(new Set(tracked),new Set(expected));assert.equal(tracked.length,expected.length);
console.log(JSON.stringify({passed: true,arm,checks: ['real Core group ownership','two rendered tabs/panels','validation blocks forward','input commits nested value','next/previous/goTo and Tab key hookup','tab focus and selection','retained node and label update','active step removal fallback','dynamic multistep creation','every descendant destroyed once'],evidence,destroyed: tracked.length}));
dom.window.close();
