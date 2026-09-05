import type { EventCallback, EventMap } from '../../mixins/events.ts';

export type RenderableView = { render(): unknown } & (
  { destroy(): unknown; remove?: unknown } | { destroy?: unknown; remove(): unknown }
);

export interface ViewLifecycle {
  cid?: string;
  el: Element;
  _isRendered?: boolean;
  _isDestroyed?: boolean;
  _isDestroying?: boolean;
  _isAttached?: boolean;
  _isShown?: boolean;
  _disableDetachEvents?: boolean;
  supportsRenderLifecycle?: boolean;
  supportsDestroyLifecycle?: boolean;
  monitorViewEvents?: boolean;
  _areViewEventsMonitored?: boolean;
  _getImmediateChildren?: () => unknown;
  on(name: string, callback?: EventCallback, context?: unknown): unknown;
  on(events: EventMap, context?: unknown): unknown;
  off(name?: string | null, callback?: EventCallback | null, context?: unknown): unknown;
  triggerMethod(event: string, ...args: unknown[]): unknown;
}

export type SupportedView = ViewLifecycle & { render(): unknown } & (
  { destroy(): unknown; remove?: unknown } |
  { destroy?: undefined | null | false | 0 | 0n | ''; remove(): unknown }
);

type ViewCandidate = { render?: unknown; destroy?: unknown; remove?: unknown };

export function isView(view: unknown): view is RenderableView {
  return typeof (view as ViewCandidate | null | undefined)?.render === 'function' &&
    (typeof (view as ViewCandidate).destroy === 'function' || typeof (view as ViewCandidate).remove === 'function');
}

export function isViewClass(ViewClass: { prototype?: Partial<RenderableView> }) {
  return ViewClass.prototype?.render && (ViewClass.prototype.destroy || ViewClass.prototype.remove);
}

export function renderView(view: SupportedView) {
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

export function destroyView(view: SupportedView, disableDetachEvents?: boolean) {
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
