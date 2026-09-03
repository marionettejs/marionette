import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom';

const __dirname = dirname(fileURLToPath(import.meta.url));
const docsPath = resolve(__dirname, '../../../docs/events.entity.md');
const markdown = await readFile(docsPath, 'utf8');
const distDir = resolve(__dirname, 'dist');
const examplePath = resolve(distDir, 'ownership.mjs');
const marker = '<!-- executable-example: entity-events-ownership -->';

assert.equal(markdown.split(marker).length - 1, 1, 'expected one entity-events ownership marker');

const markedContent = markdown.slice(markdown.indexOf(marker) + marker.length);
const codeFence = markedContent.match(/^\s*```javascript\n([\s\S]*?)\n```/);

assert.ok(codeFence, 'expected a JavaScript fence immediately after the ownership marker');

await mkdir(distDir, { recursive: true });
await writeFile(examplePath, codeFence[1], 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>');
globalThis.window = dom.window;
globalThis.document = dom.window.document;

try {
  const { Model, model, view } = await import(pathToFileURL(examplePath));
  const { default: Backbone } = await import('backbone');
  const { View: PackedView } = await import('marionette');

  assert.equal(view.viewCall.owner, view, 'a View entity handler must use the View as context');
  assert.deepEqual(
    view.viewCall.arguments,
    [model, 'ready'],
    'a View entity handler must receive the original arguments',
  );
  assert.notEqual(
    view.behaviorCall.owner,
    view,
    'a Behavior entity handler must use the Behavior as context',
  );
  assert.equal(
    view.behaviorCall.owner.view,
    view,
    'a Behavior entity handler must expose its owning View through this.view',
  );
  assert.deepEqual(
    view.behaviorCall.arguments,
    [model, 'ready'],
    'a Behavior entity handler must receive the original arguments',
  );
  assert.equal(view.modelEventsResolutionCount, 1, 'initial delegation must resolve the map once');
  assert.equal(
    view.behaviorCall.owner.modelEventsResolutionCount,
    1,
    'initial delegation must resolve the Behavior map once',
  );

  view.undelegateEntityEvents();
  const replacementModel = new Model();
  view.model = replacementModel;
  view.delegateEntityEvents();
  assert.equal(view.modelEventsResolutionCount, 2, 'explicit rewiring must resolve the map again');
  assert.equal(
    view.behaviorCall.owner.modelEventsResolutionCount,
    2,
    'explicit rewiring must resolve the Behavior map again',
  );

  const viewCallBeforeOldEntityTrigger = view.viewCall;
  const behaviorCallBeforeOldEntityTrigger = view.behaviorCall;
  model.trigger('change:status', model, 'stale');
  assert.equal(
    view.viewCall,
    viewCallBeforeOldEntityTrigger,
    'explicit rewiring must remove the View subscription from the old entity',
  );
  assert.equal(
    view.behaviorCall,
    behaviorCallBeforeOldEntityTrigger,
    'explicit rewiring must remove the Behavior subscription from the old entity',
  );

  replacementModel.trigger('change:status', replacementModel, 'updated');
  assert.deepEqual(
    view.viewCall.arguments,
    [replacementModel, 'updated'],
    'explicit rewiring must move the subscription to the replacement entity',
  );
  assert.deepEqual(
    view.behaviorCall.arguments,
    [replacementModel, 'updated'],
    'explicit rewiring must move the Behavior subscription to the replacement entity',
  );

  let unrelatedCallCount = 0;
  replacementModel.on('change:status', () => {
    unrelatedCallCount += 1;
  });

  view.destroy();
  const callBeforeDestroy = view.viewCall;
  const behaviorCallBeforeDestroy = view.behaviorCall;
  const retainedBehavior = behaviorCallBeforeDestroy.owner;
  const resolutionCountBeforeLateCall = view.modelEventsResolutionCount;
  const behaviorResolutionCountBeforeLateCall = retainedBehavior.modelEventsResolutionCount;

  assert.equal(view.delegateEntityEvents(), view, 'late delegation must remain chainable');
  assert.equal(
    retainedBehavior.delegateEntityEvents(),
    retainedBehavior,
    'direct Behavior delegation after host destruction must remain chainable',
  );
  assert.equal(
    replacementModel.trigger('change:status', replacementModel, 'late'),
    replacementModel,
    'destroying the View must leave the entity usable',
  );
  assert.equal(
    view.modelEventsResolutionCount,
    resolutionCountBeforeLateCall,
    'late delegation must not resolve entity-event maps',
  );
  assert.equal(
    retainedBehavior.modelEventsResolutionCount,
    behaviorResolutionCountBeforeLateCall,
    'direct Behavior delegation must not resolve maps after host destruction',
  );
  assert.equal(view.viewCall, callBeforeDestroy, 'destroyed Views must not receive entity events');
  assert.equal(
    view.behaviorCall,
    behaviorCallBeforeDestroy,
    'destroyed View Behaviors must not receive entity events',
  );
  assert.equal(unrelatedCallCount, 1, 'View cleanup must preserve unrelated entity listeners');

  let backboneStatus;
  const backboneModel = new Backbone.Model();
  const BackboneEntityView = PackedView.extend({
    modelEvents: {
      'change:status'(entity, status) {
        backboneStatus = { entity, status };
      },
    },
  });
  const backboneView = new BackboneEntityView({ model: backboneModel });

  backboneModel.trigger('change:status', backboneModel, 'plain-backbone');
  assert.deepEqual(
    backboneStatus,
    { entity: backboneModel, status: 'plain-backbone' },
    'plain Backbone entities must support entity events without configuring the integration',
  );
  backboneView.destroy();
} finally {
  dom.window.close();
  delete globalThis.document;
  delete globalThis.window;
}
