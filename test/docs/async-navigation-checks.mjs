// Run the guide against controlled requests that deliberately ignore abort.
export const preparations = {
  'guides-routing-2': `
const requests = [];
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function answer(request, title) {
  request.resolve(new Response(JSON.stringify({ title, body: title + ' content' })));
}
globalThis.fetch = (url, { signal }) => {
  const request = { url, signal, ...deferred() };
  requests.push(request);
  return request.promise;
};
const hashListeners = new Set();
const addListener = window.addEventListener.bind(window);
const removeListener = window.removeEventListener.bind(window);
window.addEventListener = (type, listener, ...options) => {
  if (type === 'hashchange') hashListeners.add(listener);
  return addListener(type, listener, ...options);
};
window.removeEventListener = (type, listener, ...options) => {
  if (type === 'hashchange') hashListeners.delete(listener);
  return removeListener(type, listener, ...options);
};
`,
};

export const assertions = {
  'guides-routing-2': `
const turn = () => new Promise(resolve => setImmediate(resolve));
function navigate(hash) {
  window.history.replaceState(null, '', hash);
  window.dispatchEvent(new window.HashChangeEvent('hashchange'));
  return app.navigationTask;
}
const heading = () => app.getView().getChildView('content').el.querySelector('h1').textContent;
const child = app.getChildApp('page');
const shell = app.getView();
await turn();
assert.equal(app.isRunning(), true);
assert.equal(child.isRunning(), false, 'Parent activation does not await child readiness');
assert.equal(requests[0].url, '/pages/home.json');
assert.equal(heading(), 'Loading page…');
assert.equal(hashListeners.size, 1);
answer(requests[0], 'Home');
assert.equal(await app.navigationTask, true);
assert.equal(heading(), 'Home');
assert.equal(child.isRunning(), true);
const home = child.getView();
assert.equal(await app.showRoute(), false);
assert.equal(child.getView(), home);
assert.equal(requests.length, 1);

const aboutNavigation = navigate('#about');
await turn();
assert.equal(app.getView(), shell);
assert.equal(home.isDestroyed(), true);
assert.equal(heading(), 'Loading page…');
assert.equal(shell.getRegion('content').currentView.el.parentElement, shell.el.querySelector('.content'));
answer(requests.at(-1), 'About');
assert.equal(await aboutNavigation, true);
assert.equal(heading(), 'About');

// Superseded success cannot replace a newer loading or ready page.
const oldSuccess = navigate('#home');
await turn();
const oldSuccessRequest = requests.at(-1);
const newSuccess = navigate('#about');
await turn();
const newSuccessRequest = requests.at(-1);
assert.equal(oldSuccessRequest.signal.aborted, true);
assert.equal(await oldSuccess, false);
answer(oldSuccessRequest, 'Obsolete home');
await turn();
assert.equal(heading(), 'Loading page…');
assert.equal(child.isRunning(), false);
answer(newSuccessRequest, 'Latest about');
assert.equal(await newSuccess, true);
assert.equal(heading(), 'Latest about');

// Superseded failure cannot replace a newer loading or ready page.
const oldFailure = navigate('#home');
await turn();
const oldFailureRequest = requests.at(-1);
const newFailure = navigate('#about');
await turn();
oldFailureRequest.reject(new Error('Obsolete failure'));
assert.equal(await oldFailure, false);
await turn();
assert.equal(heading(), 'Loading page…');
answer(requests.at(-1), 'Current about');
assert.equal(await newFailure, true);
assert.equal(heading(), 'Current about');
assert.equal(app.getView(), shell);

// Failed readiness never activates; the current URL can be retried.
const failed = navigate('#home');
await turn();
requests.at(-1).resolve(new Response('', { status: 503 }));
assert.equal(await failed, false);
assert.equal(child.isRunning(), false);
assert.equal(child.getView(), undefined);
assert.equal(heading(), 'Could not load page');
assert.equal(window.location.hash, '#home');
app.getView().getChildView('content').el.querySelector('.retry').click();
const retry = app.navigationTask;
await turn();
assert.equal(heading(), 'Loading page…');
answer(requests.at(-1), 'Retried home');
assert.equal(await retry, true);
assert.equal(heading(), 'Retried home');

const beforeMissing = child.getView();
const beforeMissingCount = requests.length;
assert.equal(await navigate('#missing'), true);
assert.equal(beforeMissing.isDestroyed(), true);
assert.equal(child.isRunning(), false);
assert.equal(heading(), 'Page not found');
assert.equal(requests.length, beforeMissingCount);
assert.equal(await app.showRoute(), false);

// Parent stop cancels preparation, destroys the shell, and removes its listener.
const beforeStop = navigate('#home');
await turn();
const beforeStopRequest = requests.at(-1);
assert.equal(app.stop(), true);
assert.equal(app.isRunning(), false);
assert.equal(hashListeners.size, 0);
assert.equal(await beforeStop, false);
assert.equal(beforeStopRequest.signal.aborted, true);
assert.equal(shell.isDestroyed(), true);
assert.equal(hashListeners.size, 0);
const stoppedRequestCount = requests.length;
window.dispatchEvent(new window.HashChangeEvent('hashchange'));
assert.equal(await app.showRoute(), false);
assert.equal(requests.length, stoppedRequestCount);
answer(beforeStopRequest, 'Stopped response');
await turn();
assert.equal(mount.childElementCount, 0);

window.history.replaceState(null, '', '#about');
assert.equal(await app.start(), true);
await turn();
const secondShell = app.getView();
assert.notEqual(secondShell, shell);
assert.equal(app.getChildApp('page'), child);
assert.equal(hashListeners.size, 1);
assert.equal(requests.at(-1).url, '/pages/about.json');
answer(requests.at(-1), 'Started again');
assert.equal(await app.navigationTask, true);

// Restart retains the shell, its one subscription, and the child's pending request.
const duringRestart = navigate('#home');
await turn();
const duringRestartRequest = requests.at(-1);
const duringRestartCount = requests.length;
assert.equal(await app.restart(), true);
assert.equal(app.getView(), secondShell);
assert.equal(secondShell.isDestroyed(), false);
assert.equal(hashListeners.size, 1);
assert.equal(requests.length, duringRestartCount);
assert.equal(duringRestartRequest.signal.aborted, false);
answer(duringRestartRequest, 'Retained home');
assert.equal(await duringRestart, true);
assert.equal(heading(), 'Retained home');

// Synchronous destruction cancels child preparation before returning.
const beforeDestroy = navigate('#about');
await turn();
const beforeDestroyRequest = requests.at(-1);
const finalShell = app.getView();
assert.equal(app.destroy(), true);
assert.equal(app.isRunning(), false);
assert.equal(hashListeners.size, 0);
assert.equal(beforeDestroyRequest.signal.aborted, true);
assert.equal(await beforeDestroy, false);
answer(beforeDestroyRequest, 'Obsolete after destroy');
await turn();
assert.equal(child.isRunning(), false);
assert.equal(child.getView(), undefined);
assert.equal(await app.showRoute(), false);
assert.equal(finalShell.isDestroyed(), true);
assert.equal(child.isDestroyed(), true);
assert.equal(hashListeners.size, 0);
assert.equal(mount.childElementCount, 0);
const destroyedRequestCount = requests.length;
window.dispatchEvent(new window.HashChangeEvent('hashchange'));
assert.equal(requests.length, destroyedRequestCount);
window.addEventListener = addListener;
window.removeEventListener = removeListener;
mount.remove();
`,
};
