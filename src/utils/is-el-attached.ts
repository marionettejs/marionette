import type { DomApi } from '../runtime/dom-api.ts';

// Attachment follows shadow hosts; ordinary DomApi containment stays strict.
export default function isElAttached(el: Element, Dom: Partial<DomApi>, documentEl = Dom.getDocumentEl!(el)): boolean {
  if (!documentEl) { return false; }

  let current: Element | undefined = el;
  while (current) {
    if (Dom.hasEl!(documentEl, current)) { return true; }
    const root: Node = current.getRootNode();
    if (root.nodeType !== 11) { return false; }
    const host = (root as ShadowRoot).host;
    // A configured root may itself host the shadow; retain provider containment.
    if (host === documentEl) { return Dom.hasEl!(root, current); }
    current = host;
  }
  return false;
}
