import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<body></body>', { url: 'https://consumer.example.test/' });
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
const require = createRequire(import.meta.url);
const until = async predicate => { for (let i = 0;i < 100;i++) { if (predicate()) {return;} await new Promise(resolve=>setTimeout(resolve,10)); } assert.fail('Observable outcome timed out'); };
const results = [];
for (const [format,api] of [['esm',await import('@mnjs/formkit')],['cjs',require('@mnjs/formkit')]]) {
  const host = document.createElement('main'); document.body.append(host);
  let resolveSubmit; let submitted;
  const form = api.mount({host,instrument: true,fields: [{name: 'direct',type: 'text',validation: 'required'}],schema: [{$formkit: 'text',name: 'schemaField'}],values: {direct: 'original',schemaField: 'schema'},formProps: {actions: false},onSubmit(values) { submitted = {...values}; return new Promise(resolve=>{resolveSubmit = resolve;}); }});
  assert.deepEqual(form.getValues(),{direct: 'original',schemaField: 'schema'});
  const originalSchema = form.node.at('schemaField');
  form.setFields([{name: 'direct',type: 'text',validation: 'required'},{name: 'added',value: 'new'}]);
  assert.equal(form.node.at('schemaField'),originalSchema);
  form.setErrors(['Root failure'],{direct: ['Field failure']});
  await until(()=>host.textContent.includes('Root failure') && host.textContent.includes('Field failure'));
  form.clearErrors(); await until(()=>!host.textContent.includes('Root failure') && !host.textContent.includes('Field failure'));
  form.setValues({direct: 'changed',schemaField: 'next',added: 'new'});
  form.reset(); assert.equal(form.getValues().direct,'original'); assert.equal(form.getValues().schemaField,'schema');
  form.setValues({direct: 'submit',schemaField: 'submitted',added: 'new'});
  const pending = form.submit(); await until(()=>Boolean(resolveSubmit));
  assert.equal(submitted.direct,'submit'); assert.equal(form.getFormState().submitting,true);
  resolveSubmit('done'); await pending; await until(()=>!form.getFormState().submitting);
  form.destroy(); assert.equal(host.children.length,0); assert.equal(form.metrics.coreNodesCreated,form.metrics.coreNodesDestroyed);
  const appHost = document.createElement('main');document.body.append(appHost);
  const app = new api.FormKitApplication({region: {el: appHost},config: {config: {locale: 'en'}},form: {fields: [{name: 'owned'}],values: {owned: 'ready'}}});
  await app.start(); const view = app.getView(); assert.equal(view.getValues().owned,'ready'); app.stop(); assert.equal(view.isDestroyed(),true); assert.equal(appHost.children.length,0); app.destroy();
  results.push({format,mixedFields: true,errorsReset: true,asyncSubmission: true,balancedNodes: true,applicationDisposal: true});
}
dom.window.close();console.log(JSON.stringify(results,null,2));
