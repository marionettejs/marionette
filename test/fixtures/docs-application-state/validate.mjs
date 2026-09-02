import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, 'dist');
const markers = {
  applicationOwnership: '<!-- executable-example: application-child-ownership -->',
  applicationState: '<!-- executable-example: application-local-state -->',
  applicationView: '<!-- executable-example: application-root-view-communication -->',
  behaviorState: '<!-- executable-example: behavior-state-ownership -->',
  viewState: '<!-- executable-example: view-local-state -->',
};

async function writeExample(documentName, marker, outputName) {
  const docsPath = resolve(__dirname, `../../../docs/${ documentName }`);
  const markdown = await readFile(docsPath, 'utf8');

  assert.equal(markdown.split(marker).length - 1, 1, `expected one ${ marker }`);

  const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
  const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

  assert.ok(codeFence, `expected a JavaScript fence immediately after ${ marker }`);

  const examplePath = resolve(distDir, outputName);
  await writeFile(examplePath, codeFence[1], 'utf8');
  return examplePath;
}

await mkdir(distDir, { recursive: true });

const examples = {
  applicationOwnership: await writeExample(
    'marionette.application.md',
    markers.applicationOwnership,
    'application-child-ownership.mjs',
  ),
  applicationView: await writeExample(
    'marionette.application.md',
    markers.applicationView,
    'application-root-view-communication.mjs',
  ),
  applicationState: await writeExample(
    'marionette.state.md',
    markers.applicationState,
    'application-local-state.mjs',
  ),
  behaviorState: await writeExample(
    'marionette.state.md',
    markers.behaviorState,
    'behavior-state-ownership.mjs',
  ),
  viewState: await writeExample(
    'marionette.state.md',
    markers.viewState,
    'view-local-state.mjs',
  ),
};

const dom = new JSDOM(`<!doctype html>
  <html>
    <body>
      <main id="dashboard"></main>
      <div id="label"></div>
      <div id="disclosure"></div>
      <div id="settings"></div>
    </body>
  </html>`);

globalThis.window = dom.window;
globalThis.document = dom.window.document;

let ownership;
let applicationView;
let applicationState;
let behaviorState;
let viewState;

try {
  ownership = await import(pathToFileURL(examples.applicationOwnership));

  assert.equal(ownership.started, true, 'the owner start must complete');
  assert.equal(ownership.stopped, true, 'the owner stop must complete');
  assert.equal(ownership.root.isRunning(), false, 'the root must finish stopped');
  assert.equal(ownership.search.isRunning(), false, 'the child must follow its owner stop');
  assert.equal(ownership.root.getChildApp('search'), ownership.search, 'the child must be registered by name');
  assert.equal(ownership.search.getParentApp(), ownership.root, 'the child must expose its owner');
  assert.deepEqual(ownership.lifecycle, [
    'root:before:start:owner',
    'search:before:start:owner',
    'search:start:owner',
    'root:start:owner',
    'root:before:stop:owner',
    'search:before:stop:owner',
    'search:stop:owner',
    'root:stop:owner',
  ], 'owner lifecycle must wrap sequential child lifecycle');

  applicationView = await import(pathToFileURL(examples.applicationView));

  assert.equal(applicationView.dashboard.isRunning(), true, 'the dashboard must finish startup');
  assert.equal(applicationView.dashboard.getView(), applicationView.dashboardView, 'the Application must expose its root View');
  assert.equal(document.querySelector('#dashboard .status').textContent, 'Idle', 'the root View must render its initial status');

  applicationView.dashboardView.el.querySelector('.refresh').click();

  assert.deepEqual(applicationView.refreshes, [{ source: 'button' }], 'the View must send one semantic request');
  assert.equal(document.querySelector('#dashboard .status').textContent, 'Updated', 'the Application must communicate down through a public View method');

  viewState = await import(pathToFileURL(examples.viewState));

  assert.equal(viewState.label.el.textContent, 'Account', 'the stateless View must render normally');
  assert.equal(viewState.disclosure.getState().open, false, 'the View must own its initial plain-object state');
  assert.equal(viewState.disclosure.el.dataset.open, 'false', 'render must reflect initial state');

  viewState.disclosure.el.querySelector('.toggle').click();

  assert.equal(viewState.disclosure.getState().open, true, 'the View event must update its exact source');
  assert.equal(viewState.disclosure.el.dataset.open, 'true', 'explicit render must reflect plain-object state');

  applicationState = await import(pathToFileURL(examples.applicationState));

  assert.equal(applicationState.session.isRunning(), true, 'the Session Application must finish restarted');
  assert.equal(applicationState.session.getState(), applicationState.sessionState, 'Application state must persist across stop and restart');
  assert.equal(applicationState.sessionState.phase, 'ready', 'restart must commit current plain-object state');
  assert.equal(applicationState.started, true, 'initial start must complete');
  assert.equal(applicationState.stopped, true, 'stop must complete');
  assert.equal(applicationState.restarted, true, 'restart must complete');

  behaviorState = await import(pathToFileURL(examples.behaviorState));

  assert.equal(behaviorState.settings.el.dataset.disclosureOpen, 'false', 'the host must reflect private Behavior state initially');
  assert.equal(behaviorState.settings.el.dataset.selected, 'false', 'the host must reflect View state initially');

  behaviorState.settings.el.querySelector('.disclosure').click();
  behaviorState.settings.el.querySelector('.selection').click();

  assert.equal(behaviorState.settings.el.dataset.disclosureOpen, 'true', 'host render must reflect private Behavior state');
  assert.equal(behaviorState.settings.getState().selected, true, 'View state must remain exact');
  assert.equal(behaviorState.settings.el.dataset.selected, 'true', 'host render must reflect View state');
} finally {
  if (applicationState?.session && !applicationState.session.isDestroyed()) {
    await applicationState.session.destroy();
  }
  behaviorState?.settings?.destroy();
  if (viewState?.label && !viewState.label.isDestroyed()) {
    viewState.label.destroy();
  }
  if (viewState?.disclosure && !viewState.disclosure.isDestroyed()) {
    viewState.disclosure.destroy();
  }
  if (applicationView?.dashboard && !applicationView.dashboard.isDestroyed()) {
    const dashboardView = applicationView.dashboardView;
    await applicationView.dashboard.destroy();
    assert.equal(dashboardView.isDestroyed(), true, 'Application teardown must destroy its root View through the Region');
  }
  if (ownership?.root && !ownership.root.isDestroyed()) {
    await ownership.root.destroy();
    assert.equal(ownership.search.isDestroyed(), true, 'owner destroy must destroy the child Application');
    assert.equal(ownership.root.getChildApp('search'), undefined, 'owner destroy must clear child registration');
    assert.deepEqual(
      ownership.lifecycle.slice(-2),
      ['search:destroy', 'root:destroy'],
      'owner destroy must complete child destruction first',
    );
  }
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
