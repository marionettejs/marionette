import type { DomApi } from '../../runtime/dom-api.ts';
import type { EventCallback, EventMap } from '@marionette/utils';

export interface RenderableView {
  render(): unknown;
  destroy(): unknown;
}

export interface ViewLifecycle {
  cid?: string;
  el: Element;
  Dom?: Partial<DomApi>;
  _isRendered?: boolean;
  _isDestroyed?: boolean;
  _isDestroying?: boolean;
  _isAttached?: boolean;
  _isShown?: boolean;
  _parent?: object;
  _disableDetachEvents?: boolean;
  monitorViewEvents?: boolean;
  _areViewEventsMonitored?: boolean;
  _getImmediateChildren: () => readonly ViewLifecycle[];
  on(name: string, callback?: EventCallback, context?: unknown): unknown;
  on(events: EventMap, context?: unknown): unknown;
  off(name?: string | null, callback?: EventCallback | null, context?: unknown): unknown;
  triggerMethod(event: string, ...args: unknown[]): unknown;
}

export type SupportedView = ViewLifecycle & RenderableView;

type ViewCandidate = Partial<RenderableView>;

export function isView(view: unknown): view is RenderableView {
  return typeof (view as ViewCandidate | null | undefined)?.render === 'function' &&
    typeof (view as ViewCandidate).destroy === 'function';
}

export function isViewClass(ViewClass: Function) {
  return isView(ViewClass.prototype);
}

export function renderView(view: SupportedView) {
  if (view._isRendered) {
    return;
  }

  view.render();
  view._isRendered = !view._isDestroyed;
}

export function destroyView(view: SupportedView, disableDetachEvents?: boolean) {
  view._disableDetachEvents = disableDetachEvents;
  view.destroy();
}
