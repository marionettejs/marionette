// Execute the guide against responses that deliberately ignore abort.
export const preparations = {
  'guides-retained-restart-1': `
const requests = [];
function deferred() { return Promise.withResolvers(); }
function answer(request, openTasks) {
  request.resolve(new Response(JSON.stringify({ openTasks })));
}
globalThis.fetch = (url, { signal }) => {
  const request = { url, signal, ...deferred() };
  requests.push(request);
  if (requests.length === 1) answer(request, 5);
  return request.promise;
};
`,
};

export const assertions = {
  'guides-retained-restart-1': `
const state = app.getState();
const page = app.getView();
const summaryView = page.getChildView('summary');
const notes = page.getChildView('notes');
const input = notes.el.querySelector('textarea');
input.value = 'An unfinished thought';
function retained() {
  assert.equal(app.getView(), page);
  assert.equal(page.getChildView('summary'), summaryView);
  assert.equal(page.getChildView('notes'), notes);
  assert.equal(notes.el.querySelector('textarea'), input);
  assert.equal(input.value, 'An unfinished thought');
  assert.equal(summaryView.model, state);
  assert.equal(app.isRunning(), true);
}
assert.equal(requests[0].url, '/summary.json');
assert.ok(requests[0].signal instanceof AbortSignal);
assert.equal(state.get('openTasks'), 5);
retained();

// Each DOM intent creates one preparation; newer readiness supersedes it.
page.el.querySelector('button').click();
const clicked = requests.at(-1);
assert.equal(requests.length, 2);
assert.equal(state.get('loading'), true);
retained();
const latest = app.restart();
const latestRequest = requests.at(-1);
assert.equal(clicked.signal.aborted, true);
clicked.reject(new Error('obsolete failure'));
await new Promise(resolve => setImmediate(resolve));
assert.equal(state.get('loading'), true);
assert.equal(state.get('error'), '');
answer(latestRequest, 8);
assert.equal(await latest, true);
assert.equal(state.get('openTasks'), 8);
retained();

const older = app.restart();
const olderRequest = requests.at(-1);
const newer = app.restart();
answer(requests.at(-1), 12);
assert.equal(await newer, true);
answer(olderRequest, 99);
assert.equal(await older, false);
assert.equal(state.get('openTasks'), 12);
retained();

const failed = app.reloadSummary();
requests.at(-1).resolve(new Response('', { status: 503 }));
await failed;
assert.equal(state.get('openTasks'), 12);
assert.equal(state.get('loading'), false);
assert.equal(state.get('error'), 'Could not load the summary.');
assert.match(summaryView.el.textContent, /Could not load the summary/);
retained();

page.el.querySelector('button').click();
const retry = requests.at(-1);
assert.equal(requests.length, 7, 'Retained roots have one intent listener after repeated restarts');
answer(retry, 15);
await new Promise(resolve => setImmediate(resolve));
assert.equal(state.get('openTasks'), 15);
assert.equal(state.get('error'), '');
retained();

const pending = app.restart();
const pendingRequest = requests.at(-1);
assert.equal(app.stop(), true);
assert.equal(await pending, false);
assert.equal(pendingRequest.signal.aborted, true);
assert.equal(page.isDestroyed(), true);
assert.equal(mount.childElementCount, 0);
answer(pendingRequest, 99);
await new Promise(resolve => setImmediate(resolve));
assert.equal(state.get('openTasks'), 15);

const nextStart = app.start();
answer(requests.at(-1), 20);
assert.equal(await nextStart, true);
assert.notEqual(app.getView(), page);
assert.equal(state.get('openTasks'), 20);
const finalRoot = app.getView();
const finalPreparation = app.restart();
const finalRequest = requests.at(-1);
assert.equal(app.destroy(), true);
assert.equal(await finalPreparation, false);
assert.equal(finalRoot.isDestroyed(), true);
assert.equal(state.isDestroyed(), true);
assert.equal(finalRequest.signal.aborted, true);
answer(finalRequest, 100);
await new Promise(resolve => setImmediate(resolve));
assert.equal(mount.childElementCount, 0);
mount.remove();
`,
};
