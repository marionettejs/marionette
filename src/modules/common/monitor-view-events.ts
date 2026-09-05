import type { ViewLifecycle } from './view.ts';

// DOM Refresh
// -----------

function eachChild(children: unknown, iteratee: (view: ViewLifecycle) => void) {
  // Do not turn a malformed private child collection into a lifecycle error.
  if (!Array.isArray(children)) { return; }

  const length = children.length;
  for (let index = 0; index < length; index++) {
    iteratee(children[index]);
  }
}

// Trigger methods only on children that expose Marionette child traversal.
function triggerMethodChildren(view: ViewLifecycle, event: string, shouldTrigger: (child: ViewLifecycle) => unknown) {
  if (!view._getImmediateChildren) { return; }
  eachChild(view._getImmediateChildren(), child => {
    if (!shouldTrigger(child)) { return; }
    child.triggerMethod(event, child);
  });
}

function shouldTriggerAttach(view: ViewLifecycle) {
  return !view._isAttached;
}

function shouldAttach(view: ViewLifecycle) {
  if (!shouldTriggerAttach(view)) { return false; }
  view._isAttached = true;
  return true;
}

function shouldTriggerDetach(view: ViewLifecycle) {
  return view._isAttached;
}

function shouldDetach(view: ViewLifecycle) {
  view._isAttached = false;
  return true;
}

function triggerDOMRefresh(view: ViewLifecycle) {
  if (view._isAttached && view._isRendered) {
    view.triggerMethod('dom:refresh', view);
  }
}

function triggerDOMRemove(view: ViewLifecycle) {
  if (view._isAttached && view._isRendered) {
    view.triggerMethod('dom:remove', view);
  }
}

function handleBeforeAttach(this: ViewLifecycle) {
  triggerMethodChildren(this, 'before:attach', shouldTriggerAttach);
}

function handleAttach(this: ViewLifecycle) {
  triggerMethodChildren(this, 'attach', shouldAttach);
  triggerDOMRefresh(this);
}

function handleBeforeDetach(this: ViewLifecycle) {
  triggerMethodChildren(this, 'before:detach', shouldTriggerDetach);
  triggerDOMRemove(this);
}

function handleDetach(this: ViewLifecycle) {
  triggerMethodChildren(this, 'detach', shouldDetach);
}

function handleBeforeRender(this: ViewLifecycle) {
  triggerDOMRemove(this);
}

function handleRender(this: ViewLifecycle) {
  triggerDOMRefresh(this);
}

// Monitor a view's state, propagating attach/detach events to children and firing dom:refresh
// whenever a rendered view is attached or an attached view is rendered.
function monitorViewEvents(view: ViewLifecycle) {
  if (view._areViewEventsMonitored || view.monitorViewEvents === false) { return; }

  view._areViewEventsMonitored = true;

  view.on({
    'before:attach': handleBeforeAttach,
    'attach': handleAttach,
    'before:detach': handleBeforeDetach,
    'detach': handleDetach,
    'before:render': handleBeforeRender,
    'render': handleRender
  });
}

export default monitorViewEvents;
