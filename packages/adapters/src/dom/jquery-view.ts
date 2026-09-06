/// <reference types="jquery" preserve="true" />
/* global JQuery */
import $ from 'jquery';
import type { BehaviorConstructor, CollectionViewConstructor, ViewConstructor } from 'marionette';
import JQueryDomApi from './jquery.ts';

interface JQueryElement {
  readonly $el: JQuery<Element>;
}

interface Extendable {
  extend(): Extendable;
  prototype: { el: Element };
  setDomApi?(api: typeof JQueryDomApi): unknown;
}

// Views and Behaviors sharing an element share its wrapper. Neither is retained.
const elements = new WeakMap<Element, JQuery<Element>>();

export default function withJQuery<Props extends object, Args extends unknown[], State, Statics extends object,
  Query extends ArrayLike<Element>>(Base: CollectionViewConstructor<Props, Args, State, Statics, Query>):
  CollectionViewConstructor<Props & JQueryElement, Args, State, Statics, JQuery<Element>>;
export default function withJQuery<Props extends object, Args extends unknown[], State, Statics extends object,
  Query extends ArrayLike<Element>>(Base: ViewConstructor<Props, Args, State, Statics, Query>):
  ViewConstructor<Props & JQueryElement, Args, State, Statics, JQuery<Element>>;
export default function withJQuery<Props extends object, Args extends unknown[], State, Statics extends object>(
  Base: BehaviorConstructor<Props, Args, State, Statics>): BehaviorConstructor<Props & JQueryElement, Args, State, Statics>;
export default function withJQuery(Base: Extendable): Extendable {
  const JQueryClass = Base.extend();
  JQueryClass.setDomApi?.(JQueryDomApi);
  Object.defineProperty(JQueryClass.prototype, '$el', {
    configurable: true,
    get(this: { el: Element }) {
      let wrapped = elements.get(this.el);
      if (!wrapped) {
        wrapped = $(this.el);
        elements.set(this.el, wrapped);
      }
      return wrapped;
    }
  });
  return JQueryClass;
}
