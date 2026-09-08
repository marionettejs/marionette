import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const fixtureDir = dirname(fileURLToPath(import.meta.url));
const output = resolve(fixtureDir, 'dist');
await mkdir(output, { recursive: true });
async function extract(document, marker, filename) {
  const markdown = await readFile(resolve(fixtureDir, '../../../docs', document), 'utf8');
  assert.equal(markdown.split(marker).length - 1, 1);
  const code = markdown.slice(markdown.indexOf(marker) + marker.length)
    .match(/^\s*```javascript\n([\s\S]*?)\n```/);
  assert.ok(code, 'the marked example must be a JavaScript module');
  const path = resolve(output, filename);
  await writeFile(path, code[1]);
  return path;
}
const counterPath = await extract('readme.md',
  '<!-- executable-example: first-view-counter -->', 'counter.mjs');
const formPath = await extract('forms-and-accessibility.md',
  '<!-- executable-example: accessible-form-save -->', 'form.mjs');
const widgetPath = await extract('task-recipes.md',
  '<!-- executable-example: widget-owned-lifecycle -->', 'widget.mjs');

// Compile the actual TypeScript fences, including rejected consumer options.
const types = await readFile(resolve(fixtureDir, '../../../docs/typescript.md'), 'utf8');
const typeExamples = [...types.matchAll(/```ts\n([\s\S]*?)\n```/g)];
assert.equal(typeExamples.length, 2);
for (const [index, example] of typeExamples.entries()) {
  const negative = index === 0 ? `
// @ts-expect-error The documented option is required.
new MessageView();
// @ts-expect-error The documented option is a string.
new MessageView({ message: 42 });
` : '';
  await writeFile(resolve(output, `example-${index}.mts`), example[1] + negative);
}
await writeFile(resolve(output, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    target: 'ES2024', module: 'ESNext', moduleResolution: 'Bundler',
    strict: true, noEmit: true, skipLibCheck: false, types: [],
    lib: ['ES2024', 'DOM', 'DOM.Iterable']
  },
  include: ['*.mts']
}, null, 2));
execFileSync(process.execPath, [fileURLToPath(import.meta.resolve('typescript/bin/tsc')),
  '-p', resolve(output, 'tsconfig.json')], { stdio: 'inherit' });

// Execute the complete testing-guide example in its own process/environment.
const testing = await readFile(resolve(fixtureDir, '../../../docs/testing.md'), 'utf8');
const testCode = testing.match(/```javascript\n([\s\S]*?)\n```/);
assert.ok(testCode);
const testPath = resolve(output, 'counter.test.mjs');
await writeFile(testPath, testCode[1]);
execFileSync(process.execPath, ['--test', testPath], { stdio: 'inherit' });

const dom = new JSDOM('<!doctype html><main id="app"></main><main id="form"></main><main id="widget"></main>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;
const { Region } = await import('marionette');
const { region: counterRegion } = await import(pathToFileURL(counterPath));
const counter = counterRegion.currentView;
const counterButton = counter.el.querySelector('button');
assert.equal(counterButton.textContent, 'Count: 0');
counterButton.querySelector('span').click();
counterButton.click();
assert.equal(counterButton.textContent, 'Count: 2');
assert.equal(counter.el.querySelector('button'), counterButton);
counter.render();
assert.equal(counter.el.querySelector('button').textContent, 'Count: 2');
const retainedButton = counter.el.querySelector('button');
counterRegion.empty();
retainedButton.click();
assert.equal(counter.count, 2, 'destroyed View no longer handles clicks');
assert.equal(counter.isDestroyed(), true);
assert.equal(document.querySelector('#app').children.length, 0);
counterRegion.destroy();
const { ProfileForm } = await import(pathToFileURL(formPath));
const { WidgetView } = await import(pathToFileURL(widgetPath));
const security = await readFile(resolve(fixtureDir, '../../../docs/security.md'), 'utf8');
const securityExamples = [...security.matchAll(/```javascript\n([\s\S]*?)\n```/g)];
assert.equal(securityExamples.length, 2);
const commentPath = resolve(output, 'comment.mjs');
const urlPath = resolve(output, 'application-url.mjs');
await writeFile(commentPath, securityExamples[0][1]);
await writeFile(urlPath, securityExamples[1][1]);
const { CommentView } = await import(pathToFileURL(commentPath));
const { applicationURL } = await import(pathToFileURL(urlPath));
const hostile = '<img src=x onerror=alert(1)>';
const comment = new CommentView({ author: hostile, body: hostile }).render();
assert.equal(comment.el.querySelector('img'), null);
assert.equal(comment.el.querySelector('h2').textContent, hostile);
assert.equal(comment.el.querySelector('p').textContent, hostile);
comment.destroy();
assert.equal(applicationURL('/account', 'https://example.test/page'), 'https://example.test/account');
// eslint-disable-next-line no-script-url -- Verify the URL policy rejects executable protocols.
assert.throws(() => applicationURL('javascript:alert(1)', 'https://example.test/page'));
assert.throws(() => applicationURL('//other.test/page', 'https://example.test/page'));
assert.throws(() => applicationURL('data:text/html,hello', 'https://example.test/page'));
const formRegion = new Region({ el: document.querySelector('#form') });
const widgetRegion = new Region({ el: document.querySelector('#widget') });
const calls = [];
try {
  const view = new ProfileForm({
    displayName: '<img src=x onerror=alert(1)>',
    save(profile, { signal }) {
      const pending = { profile, signal, ...Promise.withResolvers() };
      calls.push(pending);
      return pending.promise;
    }
  });
  formRegion.show(view);
  const input = view.el.querySelector('input');
  const status = view.el.querySelector('[role="status"]');
  const button = view.el.querySelector('button');
  assert.equal(input.value, '<img src=x onerror=alert(1)>');
  assert.equal(view.el.querySelector('img'), null);
  assert.equal(view.el.querySelector('label').htmlFor, input.id);
  assert.equal(input.getAttribute('aria-describedby'), status.id);
  const other = new ProfileForm({ displayName: 'Other', save: async() => {} }).render();
  assert.notEqual(other.el.querySelector('input').id, input.id);
  other.destroy();
  input.value = '';
  assert.equal(await view.submit(), false);
  assert.equal(calls.length, 0);
  input.value = 'Unfinished draft';
  input.focus();
  input.setSelectionRange(3, 8);
  const failed = view.submit();
  assert.equal(input.readOnly, true);
  assert.equal(button.disabled, true);
  assert.equal(await view.submit(), false);
  assert.equal(calls.length, 1, 'duplicate saves are suppressed');
  calls[0].reject(new Error('Private server message'));
  assert.equal(await failed, false);
  assert.equal(view.el.querySelector('input'), input);
  assert.equal(document.activeElement, input);
  assert.equal(input.value, 'Unfinished draft');
  assert.equal(input.selectionStart, 3);
  assert.equal(input.selectionEnd, 8);
  assert.equal(input.readOnly, false);
  assert.equal(button.disabled, false);
  assert.match(status.textContent, /Your changes are still here/);
  assert.doesNotMatch(status.textContent, /Private server/);
  const saved = view.submit();
  assert.deepEqual(calls[1].profile, { displayName: 'Unfinished draft' });
  calls[1].resolve();
  assert.equal(await saved, true);
  assert.equal(status.textContent, 'Saved.');
  assert.equal(document.activeElement, input);
  assert.equal(view.el.hasAttribute('aria-busy'), false);
  input.value = 'Draft reset by explicit render';
  const reset = view.submit();
  view.render();
  assert.equal(calls[2].signal.aborted, true);
  calls[2].resolve();
  assert.equal(await reset, false);
  assert.equal(view.el.querySelector('input').value, 'Unfinished draft');
  assert.equal(view.el.hasAttribute('aria-busy'), false);
  const currentStatus = view.el.querySelector('[role="status"]');
  const stopped = view.submit();
  formRegion.empty();
  assert.equal(view.isDestroyed(), true);
  assert.equal(calls[3].signal.aborted, true);
  calls[3].resolve();
  assert.equal(await stopped, false, 'ignored abort cannot commit success after destruction');
  assert.equal(currentStatus.textContent, 'Saving…');
  assert.equal(await view.submit(), false);
  const rejecting = new ProfileForm({ displayName: 'Retry', save: view.save });
  formRegion.show(rejecting);
  const rejected = rejecting.submit();
  formRegion.empty();
  calls[4].reject(new Error('Late rejection'));
  assert.equal(await rejected, false, 'late rejection is handled after destruction');

  const handles = [];
  const widget = new WidgetView({
    createWidget(host) {
      assert.equal(host.isConnected, true, 'create only after managed attachment');
      const handle = { host, destroyed: 0, destroy() {
        assert.equal(host.isConnected, true, 'release before DOM removal');
        this.destroyed += 1;
      } };
      handles.push(handle);
      return handle;
    }
  });
  widget.render();
  assert.equal(handles.length, 0, 'detached render does not acquire the widget');
  widgetRegion.show(widget);
  assert.equal(handles.length, 1);
  widgetRegion.show(widget);
  assert.equal(handles.length, 1, 'reshowing the current view is a no-op');
  widget.render();
  assert.equal(handles[0].destroyed, 1);
  assert.equal(handles.length, 2);
  assert.notEqual(handles[0].host, handles[1].host);
  assert.equal(widgetRegion.detachView(), widget);
  assert.equal(handles[1].destroyed, 1);
  assert.equal(widget.isDestroyed(), false);
  widgetRegion.show(widget);
  assert.equal(handles.length, 3);
  widgetRegion.empty();
  assert.equal(handles[2].destroyed, 1);
  assert.equal(widget.isDestroyed(), true);
  widget.destroy();
  assert.deepEqual(handles.map(handle => handle.destroyed), [1, 1, 1]);
  console.log('Application guides passed: exact TypeScript/test/security snippets, form drafts/focus/errors/cancellation, widget lifecycle.');
} finally {
  formRegion.destroy();
  widgetRegion.destroy();
  dom.window.close();
  delete globalThis.window;
  delete globalThis.document;
}
