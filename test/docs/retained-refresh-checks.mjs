// Execute the guide itself against responses that deliberately ignore abort.
export const preparations = {
  'guides-retained-refresh-1': `
const requests = [];
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
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
  'guides-retained-refresh-1': `
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
}
assert.equal(app.isRunning(), true);
assert.equal(requests.length, 1);
assert.equal(requests[0].url, '/summary.json');
assert.ok(requests[0].signal instanceof AbortSignal);
assert.equal(state.get('openTasks'), 5);
retained();

// The actual DOM trigger reaches the operation; the next operation supersedes it.
page.el.querySelector('button').click();
const clicked = requests.at(-1);
assert.equal(requests.length, 2);
assert.equal(state.get('loading'), true);
assert.match(summaryView.el.textContent, /Refreshing/);
retained();
const latest = app.refresh();
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

const older = app.refresh();
const olderRequest = requests.at(-1);
const newer = app.refresh();
answer(requests.at(-1), 12);
assert.equal(await newer, true);
answer(olderRequest, 99);
assert.equal(await older, false);
assert.equal(state.get('openTasks'), 12);
assert.equal(state.get('loading'), false);
retained();

const failed = app.refresh();
requests.at(-1).resolve(new Response('', { status: 503 }));
assert.equal(await failed, false);
assert.equal(state.get('openTasks'), 12);
assert.equal(state.get('error'), 'Could not refresh the summary.');
assert.match(summaryView.el.textContent, /Could not refresh/);
retained();

// A rejected ordinary stop retains authority and the current UI.
const duringStop = app.refresh();
const duringStopRequest = requests.at(-1);
const stopReadiness = deferred();
app.prepareStop = () => stopReadiness.promise;
const refusedStop = app.stop();
assert.equal(app.isRunning(), true);
assert.equal(duringStopRequest.signal.aborted, false);
stopReadiness.reject(new Error('Keep editing'));
await assert.rejects(refusedStop, /Keep editing/);
answer(duringStopRequest, 15);
assert.equal(await duringStop, true);
assert.equal(state.get('openTasks'), 15);
retained();
delete app.prepareStop;

const beforeStop = app.refresh();
const beforeStopRequest = requests.at(-1);
assert.equal(await app.stop(), true);
assert.equal(beforeStopRequest.signal.aborted, true);
assert.equal(page.isDestroyed(), true);
assert.equal(notes.isDestroyed(), true);
assert.equal(state.isDestroyed(), false);
const requestCount = requests.length;
assert.equal(await app.refresh(), false);
assert.equal(requests.length, requestCount);
const restarted = app.start();
await new Promise(resolve => setImmediate(resolve));
answer(requests.at(-1), 20);
assert.equal(await restarted, true);
answer(beforeStopRequest, 999);
assert.equal(await beforeStop, false);
assert.equal(app.getState(), state);
assert.equal(state.get('openTasks'), 20);
assert.notEqual(app.getView(), page);
assert.equal(app.getView().el.querySelector('textarea').value, '');

const secondPage = app.getView();
const restart = app.restart();
await new Promise(resolve => setImmediate(resolve));
answer(requests.at(-1), 21);
assert.equal(await restart, true);
assert.equal(secondPage.isDestroyed(), true);
assert.notEqual(app.getView(), secondPage);
assert.equal(app.getState(), state);

// Destruction revokes authority before its pending stop readiness completes.
const beforeDestroy = app.refresh();
const beforeDestroyRequest = requests.at(-1);
const destroyReadiness = deferred();
app.prepareStop = () => destroyReadiness.promise;
const destroying = app.destroy();
assert.equal(app.isRunning(), false);
assert.equal(beforeDestroyRequest.signal.aborted, false);
answer(beforeDestroyRequest, 1000);
assert.equal(await beforeDestroy, false);
assert.equal(state.get('openTasks'), 21);
destroyReadiness.resolve();
assert.equal(await destroying, true);
assert.equal(beforeDestroyRequest.signal.aborted, true);
assert.equal(state.isDestroyed(), true);

const failedActivation = new DashboardApplication({ region: { el: mount } });
const starting = failedActivation.start();
await new Promise(resolve => setImmediate(resolve));
requests.at(-1).reject(new Error('Initial request failed'));
await assert.rejects(starting, /Initial request failed/);
assert.equal(failedActivation.isRunning(), false);
assert.equal(failedActivation.getView(), undefined);
await failedActivation.destroy();
mount.remove();
`,
};
