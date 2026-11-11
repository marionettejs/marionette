/**
 * @license
 * Adapter derived from Marionette's MIT-licensed lit-html adapter.
 * Copyright (c) 2020 Paul Falgout
 * See THIRD_PARTY_NOTICES.md for its complete license and provenance.
 */
import {_ChildPart} from './renderer.js';

// A weak key cannot retain a destroyed View. Each part owns only the range
// between its markers, leaving Region/CollectionView children outside it alone.
const contents = new WeakMap<Element, _ChildPart>();
const attached = new WeakSet<Element>();

/** Commit a template through Marionette's DOM API, without a render wrapper. */
export function setContents(el: Element, value: unknown): void {
  let part = contents.get(el);
  if (!part) {
    const start = el.ownerDocument.createComment('');
    const end = el.ownerDocument.createComment('');
    el.replaceChildren(start, end);
    part = new _ChildPart(start, end, undefined, {
      isConnected: attached.has(el),
      renderBefore: end,
    });
    // Store before user directives run. If they throw, later notifications must
    // still disconnect resources already created, with no rollback/retry layer.
    contents.set(el, part);
  }
  part._$setValue(value);
}

export function notifyAttach(el: Element): void {
  attached.add(el);
  contents.get(el)?.setConnected(true);
}

export function notifyDetach(el: Element): void {
  attached.delete(el);
  contents.get(el)?.setConnected(false);
}

// Region clearing can remove renderer markers as well as ordinary contents.
// Invalidate the part at that ownership boundary, not on every template update.
function detachContents(el: Element): void {
  contents.get(el)?.setConnected(false);
  contents.delete(el);
  el.replaceChildren();
}

/** Install with runtime.setDomApi(HtmlDomApi). Requires Marionette >= 5.0.1. */
export const HtmlDomApi = {setContents, notifyAttach, notifyDetach, detachContents};
export default HtmlDomApi;
