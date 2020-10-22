export function isView(view) {
  return view.render && (view.destroy || view.remove);
}

export function isViewClass(ViewClass) {
  return ViewClass.prototype.render && (ViewClass.prototype.destroy || ViewClass.prototype.remove);
}

export function renderView(view) {
  if (view._isRendered) {
    return;
  }

  if (!view.supportsRenderLifecycle) {
    view.triggerMethod('before:render', view);
  }

  view.render();
  view._isRendered = true;

  if (!view.supportsRenderLifecycle) {
    view.triggerMethod('render', view);
  }
}

export function destroyView(view, disableDetachEvents) {
  if (view.destroy) {
    // Attach flag for public destroy function internal check
    view._disableDetachEvents = disableDetachEvents;
    view.destroy();
    return;
  }

  // Destroy for non-Marionette Views
  if (!view.supportsDestroyLifecycle) {
    view.triggerMethod('before:destroy', view);
  }

  const shouldTriggerDetach = view._isAttached && !disableDetachEvents;

  if (shouldTriggerDetach) {
    view.triggerMethod('before:detach', view);
  }

  view.remove();

  if (shouldTriggerDetach) {
    view._isAttached = false;
    view.triggerMethod('detach', view);
  }

  view._isDestroyed = true;

  if (!view.supportsDestroyLifecycle) {
    view.triggerMethod('destroy', view);
  }
}
