// Owner-selected Dom operations. There is no per-method native fallback.
export function insertNode(Dom, parent, node, before = null) {
  if (node.nodeType === 1) { return Dom.moveEl(node, parent, before); }
  if (node.nodeType === 11) {
    if (before === null) { return Dom.appendContents(parent, node); }
    for (const child of [...node.childNodes]) { insertNode(Dom, parent, child, before); }
    return;
  }
  // DomApi has no placement primitive for text/comment nodes.
  parent.insertBefore(node, before);
}
export function removeNode(Dom, node) {
  if (node.nodeType === 1) { return Dom.detachEl(node); }
  if (node.parentNode) { node.parentNode.removeChild(node); }
}
export function applyStyle(Dom, element, next, previous = {}, reset = false) {
  if (reset) { Dom.setAttributes(element, { style: null }); }
  // Normalize lazily, preserving the original check/apply ordering. A later
  // membership check or conversion error cannot undo completed removals.
  let probe, failed = false;
  const apply = (key, value, remove = false) => {
    if (!probe) {
      probe = Dom.createElement('span');
      probe.style.cssText = element.style.cssText;
    }
    if (key.startsWith('--') || key.includes('-')) {
      if (remove) { probe.style.removeProperty(key); } else { probe.style.setProperty(key, value ?? ''); }
    } else { probe.style[key] = remove ? '' : value ?? ''; }
    const normalized = probe.getAttribute('style');
    if (element.getAttribute('style') !== normalized) { Dom.setAttributes(element, { style: normalized }); }
  };
  try {
    for (const key of Object.keys(previous)) {
      if (!(key in next)) { apply(key, undefined, true); }
    }
    for (const [key, value] of Object.entries(next)) {
      if (previous[key] !== value) { apply(key, value); }
    }
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (failed) {
      try { if (probe) { Dom.detachEl(probe); } } catch {
        // Releasing the temporary normalizer must not replace the original error.
      }
    } else if (probe) { Dom.detachEl(probe); }
  }
}
export function displayContents(Dom, element) { applyStyle(Dom, element, { display: 'contents' }); }
