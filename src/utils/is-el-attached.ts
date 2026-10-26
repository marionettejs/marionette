import type { DomApi } from '../runtime/dom-api.ts';

// Attachment follows shadow hosts; ordinary DomApi containment stays strict.
export default function isElAttached(el: Element, Dom: Partial<DomApi>): boolean {
  const documentEl = Dom.getDocumentEl!(el);
  if (!documentEl) { return false; }

  let current: Element | undefined = el;
  while (current) {
    if (Dom.hasEl!(documentEl, current)) { return true; }
    const root = current.getRootNode();
    current = root.nodeType === 11 ? (root as ShadowRoot).host : undefined;
  }
  return false;
}
