/// <reference types="jquery" preserve="true" />
/* global JQuery */
import $ from 'jquery';

export default {
  // Finds the `selector` string within the el
  // Returns a jQuery collection
  findEl<TElement extends Element = HTMLElement>(
    el: Element | Document, selector: string
  ): JQuery<TElement> {
    return $(el).find<TElement>(selector);
  },

  // Detach `el` from the DOM without removing listeners
  detachEl(el: Element): void {
    $(el).detach();
  },

  // Replace the contents of `el` with the `html`
  setContents(el: Element, html: string): void {
    $(el).html(html);
  },

  // Takes the DOM node `el` and appends the DOM node `contents`
  // to the end of the element's contents.
  appendContents(
    el: Element | DocumentFragment,
    contents: JQuery.htmlString | JQuery.TypeOrArray<JQuery.Node | JQuery<JQuery.Node>>
  ): void {
    $(el).append(contents);
  },

  // Remove the inner contents of `el` from the DOM while leaving
  // `el` itself in the DOM.
  detachContents(el: Element): void {
    $(el).contents().detach();
  },

  // Wrap the view element for the optional `$el` compatibility surface.
  wrapEl<TElement extends Element = HTMLElement>(el: TElement): JQuery<TElement> {
    return $(el);
  }
};
