export const assertions = {
  'guides-existing-ui-1': `
const host = document.createElement('section');
document.body.append(host);
const counts = [];
const feature = mountCounter(host, value => counts.push(value));
const button = host.querySelector('button');
button.click();
assert.deepEqual(counts, [1]);
assert.equal(button.textContent, 'Count: 1');
feature.destroy();
feature.destroy();
assert.equal(host.isConnected, true);
assert.equal(host.childElementCount, 0);
button.click();
assert.deepEqual(counts, [1]);
const next = mountCounter(host, value => counts.push(value));
assert.equal(host.querySelector('button').textContent, 'Count: 0');
next.destroy();
host.remove();
`,
  'guides-routing-1': `
const shell = app.getView();
const home = shell.getChildView('content');
assert.equal(home.el.querySelector('h1').textContent, 'Home');
app.showRoute();
assert.equal(shell.getChildView('content'), home);
window.history.replaceState(null, '', '#about');
window.dispatchEvent(new window.HashChangeEvent('hashchange'));
const about = shell.getChildView('content');
assert.equal(app.getView(), shell);
assert.equal(home.isDestroyed(), true);
assert.equal(about.el.querySelector('h1').textContent, 'About');
assert.equal(document.title, 'About');
assert.equal(document.activeElement, about.el.querySelector('h1'));
window.history.replaceState(null, '', '#missing');
window.dispatchEvent(new window.HashChangeEvent('hashchange'));
assert.equal(about.isDestroyed(), true);
assert.equal(shell.getChildView('content').el.textContent, 'Page not found');
const originalShowRoute = app.showRoute;
let routeCalls = 0;
app.showRoute = function(...args) { routeCalls++; return originalShowRoute.apply(this, args); };
await app.stop();
assert.equal(shell.isDestroyed(), true);
window.dispatchEvent(new window.HashChangeEvent('hashchange'));
assert.equal(app.getView(), undefined);
assert.equal(routeCalls, 0);
window.history.replaceState(null, '', '#about');
await app.start();
assert.equal(app.getView().getChildView('content').el.querySelector('h1').textContent, 'About');
routeCalls = 0;
window.dispatchEvent(new window.HashChangeEvent('hashchange'));
assert.equal(routeCalls, 1);
await app.destroy();
assert.equal(mount.isConnected, true);
mount.remove();
`,
};
