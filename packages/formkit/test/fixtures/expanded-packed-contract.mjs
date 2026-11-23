import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<body></body>', { url: 'https://consumer.example.test/' });
for (const key of ['window','document','Node','Element','HTMLElement','HTMLInputElement','HTMLFormElement','Event','CustomEvent','MutationObserver','getComputedStyle']) {globalThis[key] = dom.window[key];}
const require = createRequire(import.meta.url);
const until = async predicate => { for (let i = 0;i < 100;i++) { if (predicate()) {return;} await new Promise(resolve=>setTimeout(resolve,10)); } assert.fail('Observable outcome timed out'); };
async function checkMessageOutlet(api, { FormKitMessages: renderMessages }) {
  const formHost = document.createElement('main');
  const outletHost = document.createElement('aside');
  const secondHost = document.createElement('aside');
  document.body.append(formHost, outletHost, secondHost);
  const fields = [
    { name: 'email', id: 'packed-email', label: 'Email', help: 'Where to reply' },
    { name: 'zip', id: 'packed-zip', label: 'ZIP code', help: 'Where to send it' },
  ];
  const form = api.mount({ host: formHost, fields, formProps: { actions: false } });
  let outlet, secondOutlet;
  const messages = ['Email issue', 'ZIP issue'];
  const inputs = fields.map(({ id }) => document.getElementById(id));
  const targetIds = input => (input.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean);
  const elementsNamed = id => [...document.querySelectorAll('[id]')].filter(element => element.id === id);
  const currentTargets = input => targetIds(input).flatMap(elementsNamed);
  const inHost = (input, message, host) => currentTargets(input).some(element => host.contains(element) && element.textContent.trim() === message);
  const assertDescription = (index, host, message) => {
    const { id, label, help } = fields[index];
    const input = inputs[index];
    assert.equal(input.labels.length, 1, label);
    assert.equal(input.labels[0].htmlFor, id, label);
    assert.equal(input.labels[0].textContent.trim(), label);
    const ids = targetIds(input);
    assert.equal(new Set(ids).size, ids.length, 'Every description token is unique');
    const targets = ids.map(ref => {
      const matches = elementsNamed(ref);
      assert.equal(matches.length, 1, 'Description target must exist exactly once: ' + ref);
      return matches[0];
    });
    assert.equal(targets.length, message ? 2 : 1);
    assert.equal(targets.find(element => element.id === 'help-' + id)?.textContent.trim(), help);
    if (message) {
      const error = targets.find(element => element.getAttribute('data-message-type') === 'error');
      assert.ok(error, 'Description must include the visible error');
      assert.equal(error.textContent.trim(), message);
      assert.ok(host.contains(error), 'Error is in the expected outlet');
    }
    return targets.find(element => element.getAttribute('data-message-type') === 'error')?.id;
  };
  try {
    form.setErrors([], { email: [messages[0]], zip: [messages[1]] });
    await until(() => inputs.every((input, i) => inHost(input, messages[i], formHost)));
    const errorIds = inputs.map((_, i) => assertDescription(i, formHost, messages[i]));

    outlet = renderMessages({ host: outletHost, props: { node: form.node.at('email') } });
    await until(() => inHost(inputs[0], messages[0], outletHost));
    await Promise.resolve();
    assert.equal(assertDescription(0, outletHost, messages[0]), errorIds[0]);
    assert.equal(assertDescription(1, formHost, messages[1]), errorIds[1]);

    secondOutlet = renderMessages({ host: secondHost, props: { node: form.node.at('zip') } });
    await until(() => inHost(inputs[1], messages[1], secondHost));
    await Promise.resolve();
    assert.equal(assertDescription(0, outletHost, messages[0]), errorIds[0]);
    assert.equal(assertDescription(1, secondHost, messages[1]), errorIds[1]);
    secondOutlet.destroy(); secondOutlet = undefined;
    await until(() => inHost(inputs[1], messages[1], formHost));
    assert.equal(assertDescription(1, formHost, messages[1]), errorIds[1]);

    outlet.update({ node: form.node.at('zip') });
    await until(() => inHost(inputs[0], messages[0], formHost) && inHost(inputs[1], messages[1], outletHost) && !inHost(inputs[1], messages[1], formHost));
    assert.equal(assertDescription(0, formHost, messages[0]), errorIds[0]);
    assert.equal(assertDescription(1, outletHost, messages[1]), errorIds[1]);

    outlet.destroy(); outlet = undefined;
    await until(() => inHost(inputs[1], messages[1], formHost));
    assert.equal(outletHost.childNodes.length, 0, 'Disposing the outlet leaves no stale DOM');
    assert.equal(assertDescription(1, formHost, messages[1]), errorIds[1]);

    form.clearErrors();
    await until(() => inputs.every((input, i) => !targetIds(input).includes(errorIds[i])) && errorIds.every(id => elementsNamed(id).length === 0));
    inputs.forEach((_, i) => assertDescription(i, formHost));
  } finally {
    secondOutlet?.destroy();
    outlet?.destroy();
    form.destroy();
    assert.equal(formHost.childNodes.length, 0);
    assert.equal(outletHost.childNodes.length, 0);
    formHost.remove();
    assert.equal(secondHost.childNodes.length, 0);
    outletHost.remove();
    secondHost.remove();
  }
}
function checkReentrantMessageOwnership(createNode, renderMessages) {
  // Exercise a caller-owned framework context without modifying stock bindings.
  const node = createNode({ props: { id: 'packed-outlet-lease' } });
  let placement = true, onRestore, original, successor, parallel;
  node.context = {
    id: 'packed-outlet-lease', messages: {}, classes: {},
    fns: { length: value => Object.keys(value).length },
    get defaultMessagePlacement() {return placement;},
    set defaultMessagePlacement(value) {
      placement = value;
      if (value) {
        const afterRestore = onRestore;
        onRestore = undefined;
        afterRestore?.();
      }
    },
  };
  const show = () => renderMessages({ host: document.createElement('aside'), props: { node } });
  try {
    original = show();
    onRestore = () => {successor = show();};
    original.destroy();
    assert.ok(successor, 'A successor claimed the restored placement');
    parallel = show();
    successor.destroy();
    assert.equal(placement, false, 'A parallel outlet still owns suppression');
    parallel.destroy();
    assert.equal(placement, true, 'The last outlet restores default placement');
  } finally {
    onRestore = undefined;
    parallel?.destroy();
    successor?.destroy();
    original?.destroy();
    node.destroy();
  }
}
const results = [];
for (const [format,api,components,core] of [
  ['esm',await import('@mnjs/formkit'),await import('@mnjs/formkit/components'),await import('@formkit/core')],
  ['cjs',require('@mnjs/formkit'),require('@mnjs/formkit/components'),require('@formkit/core')],
]) {
  await checkMessageOutlet(api, components);
  checkReentrantMessageOwnership(core.createNode, components.FormKitMessages);
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
  results.push({format,mixedFields: true,errorsReset: true,asyncSubmission: true,balancedNodes: true,applicationDisposal: true,messageDescriptions: true,reentrantMessageOwnership: true});
}
dom.window.close();console.log(JSON.stringify(results,null,2));
