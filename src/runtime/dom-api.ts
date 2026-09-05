// DomApi
// -------
import { assignOwn, setProperty } from '../utils/assign-in.js';

export interface DomApi<Query extends ArrayLike<Element> = ArrayLike<Element>, Wrapped = unknown, Content = never> {
  createElement: (tagName: string) => Element;
  createBuffer: () => DocumentFragment;
  getDocumentEl: (el: Element) => Element | null;
  findEl: (el: Element | Document, selector: string) => Query;
  hasEl: (el: Node, childEl: Node | null | undefined) => boolean;
  detachEl: (el: Element) => void;
  replaceEl: (newEl: Element, oldEl: Element) => void;
  swapEl: (el1: Element, el2: Element) => void;
  setContents: (el: Element, html: Content) => void;
  setAttributes: (el: Element, attrs: unknown) => void;
  appendContents: (el: Element | DocumentFragment, contents: Element | DocumentFragment) => void;
  moveEl: (el: Element, parent: Element | DocumentFragment, before?: Node | null) => void;
  hasContents: (el: Node | null | undefined) => boolean;
  detachContents: (el: Element) => void;
  wrapEl?: (el: Element) => Wrapped;
}

interface DomApiClass {
  prototype: { Dom?: Partial<DomApi> };
}

type AttributeElement = Element & { __proto__?: unknown };

const objectKeys = Object.keys;

// Static setter
export function setDomApi<Receiver extends { prototype: object }, Mixin extends object>(
  this: Receiver,
  mixin?: Mixin & Partial<DomApi> | null | boolean | number | bigint | string | symbol
): Receiver;
export function setDomApi<Receiver extends DomApiClass, Mixin extends object>(
  this: Receiver,
  mixin?: Mixin & Partial<DomApi> | null | boolean | number | bigint | string | symbol
): Receiver {
  this.prototype.Dom = assignOwn({}, this.prototype.Dom, mixin);
  return this;
}

export default {
  // Returns a new HTML DOM node of tagName
  createElement(tagName: string) {
    return document.createElement(tagName);
  },

  // Returns a new HTML DOM node instance
  createBuffer() {
    return document.createDocumentFragment();
  },

  // Returns the document element for a given DOM element
  getDocumentEl(el: Element): Element | null {
    return el.ownerDocument.documentElement;
  },

  // Finds the `selector` string with the el
  // Returns an array-like object of nodes
  findEl(el: Element | Document | DocumentFragment, selector: string) {
    return el.querySelectorAll(selector);
  },

  // Returns true if the el contains the node childEl
  hasEl(el: Node, childEl: Node | null | undefined) {
    return el.contains((childEl && childEl.parentNode) as Node | null);
  },

  // Detach `el` from the DOM without removing listeners
  detachEl(el: Node) {
    if (el.parentNode) { el.parentNode.removeChild(el); }
  },

  // Remove `oldEl` from the DOM and put `newEl` in its place
  replaceEl(newEl: Node, oldEl: Node) {
    if (newEl === oldEl) {
      return;
    }

    const parent = oldEl.parentNode;

    if (!parent) {
      return;
    }

    parent.replaceChild(newEl, oldEl);
  },

  // Swaps the location of `el1` and `el2` in the DOM
  swapEl(el1: Node, el2: Node) {
    if (el1 === el2) {
      return;
    }

    const parent1 = el1.parentNode;
    const parent2 = el2.parentNode;

    if (!parent1 || !parent2) {
      return;
    }

    const next1 = el1.nextSibling;
    const next2 = el2.nextSibling;

    parent1.insertBefore(el2, next1);
    parent2.insertBefore(el1, next2);
  },

  // Replace the contents of `el` with the `html`
  setContents(el: Element, html: string) {
    el.innerHTML = html;
  },

  // Sets attributes on a DOM node
  setAttributes(el: AttributeElement, attrs: unknown) {
    const attrsType = typeof attrs;
    if (attrs == null || attrsType !== 'object' && attrsType !== 'function') { return; }

    const attrNames = objectKeys(attrs);
    for (let index = 0, length = attrNames.length; index < length; index++) {
      const attr = attrNames[index];
      const attributeName = attr === 'className' ? 'class' :
        attr === 'htmlFor' ? 'for' : attr;
      if (attr in el && attr !== 'className') {
        const value = (attrs as Record<string, unknown>)[attr];
        if (value != null) {
          if (attr === '__proto__') {
            setProperty(el, attr, value);
          } else if (!Reflect.set(el, attr, value)) {
            el.setAttribute(attributeName, value as string);
          }
          continue;
        }

        if (attr === '__proto__') {
          delete el[attr];
        } else {
          Reflect.set(el, attr, null);
        }
        // A reflected property assignment may coerce null; removing the DOM
        // attribute keeps both states cleared.
        el.removeAttribute(attributeName);
        continue;
      }

      const setAttribute = el.setAttribute;
      const value = (attrs as Record<string, unknown>)[attr];
      if (value == null) {
        el.removeAttribute(attributeName);
      } else {
        setAttribute.call(el, attributeName, value as string);
      }
    }
  },

  // Takes the DOM node `el` and appends the DOM node `contents`
  // to the end of the element's contents.
  appendContents(el: Node, contents: Node) {
    el.appendChild(contents);
  },

  // Move a child without disconnecting it when the platform supports moveBefore.
  moveEl(el: Node, parent: Element | DocumentFragment, before: Node | null = null) {
    if (el.parentNode === parent && typeof parent.moveBefore === 'function') {
      parent.moveBefore(el, before);
      return;
    }

    parent.insertBefore(el, before);
  },

  // Does the el have child nodes
  hasContents(el: Node | null | undefined) {
    return !!el && el.hasChildNodes();
  },

  // Remove the inner contents of `el` from the DOM while leaving
  // `el` itself in the DOM.
  detachContents(el: Node) {
    el.textContent = '';
  }
} satisfies DomApi;
