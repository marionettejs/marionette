// DOM Refresh
// -----------

import { each } from 'underscore';

// Trigger method on children unless a pure Backbone.View
function triggerMethodChildren(view, event, shouldTrigger) {
  if (!view._getImmediateChildren) { return; }
  each(view._getImmediateChildren(), child => {
    if (!shouldTrigger(child)) { return; }
    child.triggerMethod(event, child);
  });
}

function shouldTriggerAttach(view) {
  return !view._isAttached;
}

function shouldAttach(view) {
  if (!shouldTriggerAttach(view)) { return false; }
  view._isAttached = true;
  return true;
}

function shouldTriggerDetach(view) {
  return view._isAttached;
}

function shouldDetach(view) {
  view._isAttached = false;
  return true;
}

function triggerDOMRefresh(view) {
  if (view._isAttached && view._isRendered) {
    view.triggerMethod('dom:refresh', view);
  }
}

function triggerDOMRemove(view) {
  if (view._isAttached && view._isRendered) {
    view.triggerMethod('dom:remove', view);
  }
}

function handleBeforeAttach() {
  triggerMethodChildren(this, 'before:attach', shouldTriggerAttach);
}

function handleAttach() {
  triggerMethodChildren(this, 'attach', shouldAttach);
  triggerDOMRefresh(this);
}

function handleBeforeDetach() {
  triggerMethodChildren(this, 'before:detach', shouldTriggerDetach);
  triggerDOMRemove(this);
}

function handleDetach() {
  triggerMethodChildren(this, 'detach', shouldDetach);
}

function handleBeforeRender() {
  triggerDOMRemove(this);
}

function handleRender() {
  triggerDOMRefresh(this);
}

// Monitor a view's state, propagating attach/detach events to children and firing dom:refresh
// whenever a rendered view is attached or an attached view is rendered.
function monitorViewEvents(view) {
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
