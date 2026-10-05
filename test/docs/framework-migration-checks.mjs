export const preparations = {
  'guides-framework-migration-1': `
const requests = [];
globalThis.fetch = (url, { signal }) => {
  const request = Promise.withResolvers();
  requests.push({ ...request, url, signal });
  if (requests.length === 1) request.resolve(new Response(JSON.stringify({ title: '<Original>' })));
  return request.promise;
};
`,
};

export const assertions = {
  'guides-framework-migration-1': `
assert.equal(requests[0].url, '/records/42.json');
const page = app.getView();
const editor = page.getChildView('editor');
const summary = page.getChildView('summary');
const state = app.getState();
const input = editor.getUI('title')[0];
assert.equal(input.value, '<Original>');
assert.equal(summary.el.querySelector('original'), null);
input.value = 'Unfinished draft';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(state.get('title'), 'Unfinished draft');
assert.equal(editor.getUI('title')[0], input);
const retained = () => {
  assert.equal(app.getView(), page);
  assert.equal(page.getChildView('editor'), editor);
  assert.equal(page.getChildView('summary'), summary);
  assert.equal(editor.getUI('title')[0], input);
  assert.equal(input.value, 'Unfinished draft');
};
const answer = (request, title) => request.resolve(new Response(JSON.stringify({ title })));
page.el.querySelector('button').click();
assert.equal(requests.length, 2);
const clicked = requests.at(-1);
const newer = app.restart({ id: '42' });
assert.equal(clicked.signal.aborted, true);
answer(requests.at(-1), 'Latest');
assert.equal(await newer, true);
answer(clicked, 'Obsolete');
await new Promise(resolve => setImmediate(resolve));
assert.equal(state.get('loadedTitle'), 'Latest');
retained();
const failed = app.reloadRecord();
requests.at(-1).resolve(new Response('', { status: 503 }));
await failed;
assert.match(summary.el.textContent, /Could not load record/);
assert.equal(state.get('loadedTitle'), 'Latest');
retained();
const retry = app.reloadRecord();
answer(requests.at(-1), 'Recovered');
await retry;
assert.equal(state.get('error'), '');
retained();
const pending = app.restart({ id: '42' });
const stoppedRequest = requests.at(-1);
app.stop();
assert.equal(await pending, false);
assert.equal(stoppedRequest.signal.aborted, true);
assert.equal(editor.isDestroyed(), true);
assert.equal(mount.childElementCount, 0);
assert.equal(state.get('title'), 'Unfinished draft');
input.value = 'Removed control';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
assert.equal(state.get('title'), 'Unfinished draft');
answer(stoppedRequest, 'Late');
await new Promise(resolve => setImmediate(resolve));
assert.equal(state.get('loadedTitle'), 'Recovered');
app.destroy();
assert.equal(state.isDestroyed(), true);
mount.remove();
`,
};
