// DomApi
// -------


export interface DomApi<Query extends ArrayLike<Element> = ArrayLike<Element>, Content = never> {
  createElement: (tagName: string) => Element;
  createBuffer: () => DocumentFragment;
  getDocumentEl: (el: Element) => Element | null;
  findEl: (el: Element | Document, selector: string) => Query;
  hasEl: (el: Node, childEl: Node | null | undefined) => boolean;
  detachEl: (el: Element) => void;
  replaceEl: (newEl: Element, oldEl: Element) => void;
  setContents: (el: Element, html: Content) => void;
  setAttributes: (el: Element, attrs: unknown) => void;
  appendContents: (el: Element | DocumentFragment, contents: Element | DocumentFragment) => void;
  moveEl: (el: Element, parent: Element | DocumentFragment, before?: Node | null) => void;
  hasContents: (el: Node | null | undefined) => boolean;
  detachContents: (el: Element) => void;
  notifyAttach: (el: Element) => void;
  notifyDetach: (el: Element) => void;
}

interface DomApiClass {
  prototype: { Dom?: Partial<DomApi> };
}

// Static setter
export function setDomApi<Receiver extends { prototype: object }, Mixin extends object>(
  this: Receiver,
  mixin?: Mixin & Partial<DomApi> | null | boolean | number | bigint | string | symbol
): Receiver;
export function setDomApi<Receiver extends DomApiClass, Mixin extends object>(
  this: Receiver,
  mixin?: Mixin & Partial<DomApi> | null | boolean | number | bigint | string | symbol
): Receiver {
  this.prototype.Dom = { ...this.prototype.Dom, ...mixin as object };
  return this;
}

export default {
  // Native contents do not keep resources tied to attachment.
  notifyAttach(_el: Element): void {},
  notifyDetach(_el: Element): void {},

  // Returns a new HTML DOM node of tagName
  createElement(tagName: string) {
    return document.createElement(tagName);
  },

  // Return a new DocumentFragment for batching child insertion.
  createBuffer() {
    return document.createDocumentFragment();
  },

  // Returns the document element for a given DOM element
  getDocumentEl(el: Element): Element | null {
    return el.ownerDocument.documentElement;
  },

  // Return a static NodeList of matching descendants; the root itself is excluded.
  findEl(el: Element | Document | DocumentFragment, selector: string) {
    return el.querySelectorAll(selector);
  },

  // Test strict containment via the child's parent, so el does not contain itself.
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

  // Replace the contents of `el` with the `html`
  setContents(el: Element, html: string | null | undefined) {
    el.innerHTML = html ?? '';
  },

  // Sets attributes on a DOM node
  setAttributes(el: Element, attrs: unknown) {
    const attrsType = typeof attrs;
    if (attrs == null || attrsType !== 'object' && attrsType !== 'function') { return; }

    const attrNames = Object.keys(attrs);
    for (let index = 0, length = attrNames.length; index < length; index++) {
      const attr = attrNames[index];
      const value = (attrs as Record<string, unknown>)[attr];
      if (value === null) {
        el.removeAttribute(attr);
      } else if (value !== undefined) {
        el.setAttribute(attr, value as string);
      }
    }
  },

  // Takes the DOM node `el` and appends the DOM node `contents`
  // to the end of the element's contents.
  appendContents(el: Node, contents: Node) {
    el.appendChild(contents);
  },

  // Use moveBefore for an existing child of this parent when available; otherwise
  // insertBefore handles insertion or movement, including cross-parent moves.
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
