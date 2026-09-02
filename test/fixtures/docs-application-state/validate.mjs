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
  assert.equal(viewState.disclosure.getState().get('open'), false, 'the View must own its initial local State');
  assert.equal(viewState.disclosure.el.dataset.open, 'false', 'render must reflect initial State');

  viewState.disclosure.el.querySelector('.toggle').click();

  assert.equal(viewState.disclosure.getState().get('open'), true, 'the View event must update its State');
  assert.equal(viewState.disclosure.el.dataset.open, 'true', 'the State event must update the View');

  applicationState = await import(pathToFileURL(examples.applicationState));
  const { State } = await import('marionette');

  assert.equal(applicationState.session.isRunning(), true, 'the Session Application must finish restarted');
  assert.ok(applicationState.sessionState instanceof State, 'State must be exported from the packed root entrypoint');
  assert.equal(applicationState.session.getState(), applicationState.sessionState, 'Application State must persist across stop and restart');
  assert.equal(applicationState.sessionState.get('phase'), 'resumed', 'the restarted Application must commit current readiness State');
  assert.deepEqual(applicationState.phases, ['ready', 'stopped', 'resumed'], 'State events must observe each lifecycle-owned phase');
  assert.equal(applicationState.pendingStartResult, false, 'stop must supersede the pending start');
  assert.equal(applicationState.replacementStopResult, true, 'the replacement stop must complete');
  assert.equal(applicationState.cancelledState.get('phase'), 'stopped', 'stale startup must not overwrite State after cancellation');

  const destroyedBehaviorStates = new Set();
  const destroyState = State.prototype.destroy;
  State.prototype.destroy = function() {
    destroyedBehaviorStates.add(this);
    return destroyState.call(this);
  };

  try {
    behaviorState = await import(pathToFileURL(examples.behaviorState));

    assert.equal(behaviorState.settings.el.dataset.disclosureOpen, 'false', 'the host must reflect private Behavior State initially');
    assert.equal(behaviorState.settings.el.dataset.selected, 'false', 'the host must reflect shared View State initially');

    behaviorState.settings.el.querySelector('.disclosure').click();
    behaviorState.settings.el.querySelector('.selection').click();

    assert.equal(behaviorState.settings.el.dataset.disclosureOpen, 'true', 'private Behavior State must update its host through the Behavior');
    assert.equal(behaviorState.settings.getState().get('selected'), true, 'shared State must belong to the host View');
    assert.equal(behaviorState.settings.el.dataset.selected, 'true', 'shared View State must notify the host');

    const settingsState = behaviorState.settings.getState();
    behaviorState.settings.destroy();

    assert.equal(settingsState.isDestroyed(), true, 'host destroy must destroy shared View State');
    assert.equal(destroyedBehaviorStates.size, 2, 'host destroy must destroy shared View and private Behavior State');
  } finally {
    State.prototype.destroy = destroyState;
  }
} finally {
  if (applicationState?.session && !applicationState.session.isDestroyed()) {
    await applicationState.session.destroy();
    assert.equal(applicationState.sessionState.isDestroyed(), true, 'Application destroy must destroy owned State');
  }
  if (applicationState?.cancelledSession && !applicationState.cancelledSession.isDestroyed()) {
    await applicationState.cancelledSession.destroy();
    assert.equal(applicationState.cancelledState.isDestroyed(), true, 'cancelled Application teardown must destroy owned State');
  }
  behaviorState?.settings?.destroy();
  if (viewState?.label && !viewState.label.isDestroyed()) {
    viewState.label.destroy();
  }
  if (viewState?.disclosure && !viewState.disclosure.isDestroyed()) {
    const disclosureState = viewState.disclosure.getState();
    viewState.disclosure.destroy();
    assert.equal(disclosureState.isDestroyed(), true, 'View destroy must destroy owned State');
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
