import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<body></body>', { url: 'https://consumer.example.test/' });
for (const key of ['window', 'document', 'Node', 'Element', 'HTMLElement', 'HTMLInputElement', 'HTMLFormElement', 'Event', 'CustomEvent', 'MutationObserver', 'getComputedStyle']) {globalThis[key] = dom.window[key];}
const require = createRequire(import.meta.url);
const imported = await import('@mnjs/formkit');
const required = require('@mnjs/formkit');
const components = await import('@mnjs/formkit/components');
const cjsComponents = require('@mnjs/formkit/components');
const names = ['FormKitApplication', 'FormKitView', 'bindings', 'defaultConfig', 'mount'];
assert.deepEqual(Object.keys(imported).sort(), names);
assert.deepEqual(Object.keys(required).sort(), names);
assert.deepEqual(Object.keys(components).sort(), Object.keys(cjsComponents).sort());
for (const api of [imported, required]) {
  const host = document.createElement('main'); document.body.append(host);
  const form = api.mount({ host, fields: [{ name: 'title', label: 'Title' }], values: { title: 'Packed' }, formProps: { actions: false } });
  assert.equal(form.getValues().title, 'Packed');
  assert.equal(host.querySelector('input').value, 'Packed');
  form.setValues({ title: 'Updated' });
  assert.equal(form.getValues().title, 'Updated');
  form.destroy(); assert.equal(host.children.length, 0);
}
const manifest = require('@mnjs/formkit/package.json'); assert.equal(manifest.name, '@mnjs/formkit');
assert.throws(() => require('@mnjs/formkit/src/index.mjs'), { code: 'ERR_PACKAGE_PATH_NOT_EXPORTED' });
dom.window.close();
console.log(JSON.stringify({ esm: 'passed', commonjs: 'passed', components: 'passed', encapsulatedExports: 'passed', mountUpdateDestroy: 'passed' }));
