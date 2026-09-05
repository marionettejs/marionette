// ViewMixin
//  ---------

import { assignOwn } from '../utils/assign-in.js';
import MarionetteError from '../modules/error.ts';
import getValue from '../utils/get-value.ts';
import isString from '../utils/is-string.js';
import BehaviorsMixin from './behaviors.ts';
import CommonMixin from './common.ts';
import DelegateEntityEventsMixin from './delegate-entity-events.ts';
import StateMixin from './state.ts';
import TemplateRenderMixin from './template-render.ts';
import UIMixin from './ui.ts';
import ViewEvents from './view-events.ts';
import DomApi from '../runtime/dom-api.ts';
import DataApi from '../runtime/data-api.ts';
import disposeAll from '../utils/dispose-all.ts';

import type { BehaviorContainer } from './behaviors.ts';
import type { EntityEventHost } from './delegate-entity-events.ts';
import type { StateHost } from './state.ts';
import type { TemplateHost } from './template-render.ts';
import type { UIHost } from './ui.ts';
import type { ViewEventsHost, DOMEvents } from './view-events.ts';
import type { EventCallback, EventSource } from './events.ts';

type SharedMixins = typeof BehaviorsMixin & typeof CommonMixin & typeof DelegateEntityEventsMixin &
  Omit<typeof StateMixin, 'State'> & typeof TemplateRenderMixin & typeof UIMixin & Omit<typeof ViewEvents, 'EventDelegator'>;

export type ViewMixinHost = SharedMixins & BehaviorContainer & EntityEventHost & StateHost &
  TemplateHost & UIHost & ViewEventsHost & {
    _isDestroying?: boolean;
    _isDestroyed?: boolean;
    _isRendered?: boolean;
    _isAttached?: boolean;
    _disableDetachEvents?: boolean;
    _dataObserverCleanup?: () => void;
    _childViewEvents?: Record<string, EventCallback>;
    _childViewTriggers?: Record<string, string>;
    _eventPrefix?: string | false;
    _getAttributes(): Record<string, unknown>;
    _removeChildren(): unknown;
    _buildEventProxies(): void;
    _proxyChildViewEvents(view: EventSource): void;
    _getEventPrefix(): string | false;
    _childViewEventHandler(eventName: string, ...args: unknown[]): void;
    delegateEvents(events?: DOMEvents): unknown;
    undelegateEvents(): unknown;
    delegateEntityEvents(): unknown;
    undelegateEntityEvents(): unknown;
    unbindUIElements(): unknown;
  };

const classErrorName = 'ViewError';

function isJQueryCollection(el: unknown) {
  return el != null && typeof el === 'object' &&
    typeof (el as { jquery?: unknown }).jquery === 'string' && typeof (el as { get?: unknown }).get === 'function';
}

export const ViewOptions = [
  'attributes',
  'className',
  'collection',
  'el',
  'events',
  'id',
  'model',
  'tagName'
];

// MixinOptions
// - attributes
// - behaviors
// - childViewEventPrefix
// - childViewEvents
// - childViewTriggers
// - className
// - collection
// - collectionEvents
// - el
// - events
// - id
// - model
// - modelEvents
// - tagName
// - triggers
// - ui


const ViewMixin = {
  tagName: 'div',

  // This is a noop method intended to be overridden
  preinitialize() {},

  Dom: DomApi,

  Data: DataApi,

  _validateEl(this: ViewMixinHost, el: unknown) {
    const stringEl = isString(el);
    if (!stringEl && !isJQueryCollection(el)) { return el; }

    const migration = stringEl ?
      `Resolve selector strings at the call site, e.g. \`document.querySelector('${el}')\`.` :
      'Unwrap jQuery collections at the call site, e.g. `wrappedEl[0]`.';

    throw new MarionetteError({
      code: 'MN0001',
      name: classErrorName,
      message: `View "el" must be a DOM element. ${migration} (Region still accepts selector strings.)`,
      url: 'marionette.view.html#specifying-an-el'
    });
  },

  // Create an element from the `id`, `className` and `tagName` properties.
  _getEl(this: ViewMixinHost) {
    const elOption = getValue(this, 'el');

    if (!elOption) {
      const el = this.Dom.createElement!(getValue(this, 'tagName') as string);
      this.Dom.setAttributes!(el, this._getAttributes());
      return el;
    }

    return elOption;
  },

  _getAttributes(this: ViewMixinHost) {
    const attrs: Record<string, unknown> = assignOwn({}, getValue(this, 'attributes'));
    if ('id' in this) { attrs.id = getValue(this, 'id'); }
    if ('className' in this) { attrs.class = getValue(this, 'className'); }
    return attrs;
  },

  renderAttributes(this: ViewMixinHost) {
    if (this._isDestroying || this._isDestroyed) { return this; }

    this.Dom.setAttributes!(this.el, this._getAttributes());
    return this;
  },

  $(this: ViewMixinHost, selector: string) {
    return this.Dom.findEl!(this.el, selector);
  },

  _isElAttached(this: ViewMixinHost) {
    const documentEl = this.el && this.Dom.getDocumentEl!(this.el);
    return !!documentEl && this.Dom.hasEl!(documentEl, this.el);
  },

  supportsRenderLifecycle: true,
  supportsDestroyLifecycle: true,

  _isDestroyed: false,

  isDestroyed(this: ViewMixinHost) {
    return !!this._isDestroyed;
  },

  _isRendered: false,

  isRendered(this: ViewMixinHost) {
    return !!this._isRendered;
  },

  _isAttached: false,

  isAttached(this: ViewMixinHost) {
    return !!this._isAttached;
  },

  _rollbackView(this: ViewMixinHost, error: unknown) {
    const dataObserverCleanup = this._dataObserverCleanup;
    delete this._dataObserverCleanup;

    // Construction rollback is not yet guarded by _isDestroying. Release the
    // collection observer before child cleanup can synchronously mutate it.
    try {
      dataObserverCleanup?.();
    } catch {
      // Preserve the construction error while continuing best-effort cleanup.
    }

    disposeAll([
      () => this.stopListening(),
      () => this._destroyState(),
      () => this._rollbackBehaviors(),
      () => this.undelegateEntityEvents(),
      () => this._undelegateViewEvents(),
      () => this._removeChildren()
    ], error);
  },

  delegateEvents(this: ViewMixinHost, events?: DOMEvents) {
    if (this._isDestroying || this._isDestroyed) { return this; }

    this.undelegateEvents();
    this._buildEventProxies();
    try {
      this._delegateViewEvents(this, events);
      this._setBehaviorElements();
    } catch (error) {
      disposeAll([
        () => this._undelegateBehaviorViewEvents(),
        () => this._undelegateViewEvents()
      ], error);
    }

    return this;
  },

  undelegateEvents(this: ViewMixinHost) {
    if (this._isDestroyed || this._isDestroying) { return this; }

    disposeAll([
      () => this._undelegateBehaviorViewEvents(),
      () => this._undelegateViewEvents()
    ]);

    return this;
  },

  // Handle `modelEvents`, and `collectionEvents` configuration
  delegateEntityEvents(this: ViewMixinHost) {
    if (this._isDestroyed || this._isDestroying) { return this; }

    try {
      this._delegateEntityEvents(this.model, this.collection, this.Data);

      // bind each behaviors model and collection events
      this._delegateBehaviorEntityEvents();
    } catch (error) {
      try {
        this.undelegateEntityEvents();
      } catch {
        // Preserve the subscription error after best-effort rollback.
      }
      throw error;
    }

    return this;
  },

  // Handle unbinding `modelEvents`, and `collectionEvents` configuration
  undelegateEntityEvents(this: ViewMixinHost) {
    disposeAll([
      () => this._undelegateBehaviorEntityEvents(),
      () => this._undelegateEntityEvents()
    ]);

    return this;
  },

  // Handle destroying the view and its children.
  destroy(this: ViewMixinHost, options?: unknown) {
    if (this._isDestroyed || this._isDestroying) { return this; }
    this._isDestroying = true;
    const shouldTriggerDetach = this._isAttached && !this._disableDetachEvents;

    try {
      this.triggerMethod('before:destroy', this, options);
    } catch (error) {
      delete this._isDestroying;
      throw error;
    }
    let didDetachEl = false;
    disposeAll([
      () => this.stopListening(),
      () => this._triggerEventOnBehaviors('destroy', this, options),
      () => this.triggerMethod('destroy', this, options),
      () => this._destroyState(),
      () => this._destroyBehaviors(options),
      () => this._deleteEntityEventHandlers(),
      () => {
        const dataObserverCleanup = this._dataObserverCleanup;
        delete this._dataObserverCleanup;
        dataObserverCleanup?.();
      },
      () => {
        this._isDestroyed = true;
        this._isRendered = false;
      },
      // Remove children after the root to prevent extra paints.
      () => this._removeChildren(),
      () => {
        if (!shouldTriggerDetach || !didDetachEl) { return; }
        this._isAttached = false;
        this.triggerMethod('detach', this);
      },
      () => {
        this.Dom.detachEl!(this.el);
        didDetachEl = true;
      },
      () => this._undelegateViewEvents(),
      () => this.unbindUIElements(),
      () => {
        if (shouldTriggerDetach) {
          this.triggerMethod('before:detach', this);
        }
      }
    ]);

    return this;
  },

  // This method binds the elements specified in the "ui" hash
  bindUIElements(this: ViewMixinHost) {
    if (this._isDestroyed || this._isDestroying) { return this; }

    this._bindUIElements();
    this._bindBehaviorUIElements();

    return this;
  },

  // This method unbinds the elements specified in the "ui" hash
  unbindUIElements(this: ViewMixinHost) {
    this._unbindUIElements();
    this._unbindBehaviorUIElements();

    return this;
  },

  getUI(this: ViewMixinHost, name: string) {
    return this._getUI(name);
  },

  // Cache `childViewEvents` and `childViewTriggers`
  _buildEventProxies(this: ViewMixinHost) {
    this._childViewEvents = this.normalizeMethods(getValue(this, 'childViewEvents') as Record<string, EventCallback | string> | undefined);
    this._childViewTriggers = getValue(this, 'childViewTriggers') as Record<string, string> | undefined;
    this._eventPrefix = this._getEventPrefix();
  },

  _getEventPrefix(this: ViewMixinHost) {
    const prefix = getValue(this, 'childViewEventPrefix', false);

    return (prefix === false) ? prefix : (prefix as string) + ':';
  },

  _proxyChildViewEvents(this: ViewMixinHost, view: EventSource) {
    if (this._childViewEvents || this._childViewTriggers || this._eventPrefix) {
      this.listenTo(view, 'all', this._childViewEventHandler);
    }
  },

  _childViewEventHandler(this: ViewMixinHost, eventName: string, ...args: unknown[]) {
    const childViewEvents = this._childViewEvents;

    // call collectionView childViewEvent if defined
    if (childViewEvents && childViewEvents[eventName]) {
      (childViewEvents[eventName] as (...args: unknown[]) => unknown).apply(this, args);
    }

    // use the parent view's proxyEvent handlers
    const childViewTriggers = this._childViewTriggers;

    // Call the event with the proxy name on the parent layout
    if (childViewTriggers && childViewTriggers[eventName]) {
      this.triggerMethod(childViewTriggers[eventName], ...args);
    }

    if (this._eventPrefix) {
      this.triggerMethod(this._eventPrefix + eventName, ...args);
    }
  }
};

assignOwn(ViewMixin, BehaviorsMixin, CommonMixin, DelegateEntityEventsMixin, StateMixin, TemplateRenderMixin, UIMixin, ViewEvents);

export default ViewMixin as typeof ViewMixin & SharedMixins;
