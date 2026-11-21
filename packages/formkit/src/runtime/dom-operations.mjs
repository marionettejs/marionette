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
  const removed = Object.keys(previous).filter(key => !(key in next));
  let changed = removed.length ? undefined : Object.entries(next).filter(([key, value]) => previous[key] !== value);
  if (!removed.length && !changed.length) { return; }
  // Normalize with the platform declaration, applying completed properties in
  // their original order. A later conversion error does not roll back them.
  const probe = Dom.createElement('span');
  let failed = false;
  try {
    probe.style.cssText = element.style.cssText;
    const apply = () => {
      const value = probe.getAttribute('style');
      if (element.getAttribute('style') !== value) { Dom.setAttributes(element, { style: value }); }
    };
    for (const key of removed) {
      if (key.startsWith('--') || key.includes('-')) { probe.style.removeProperty(key); } else { probe.style[key] = ''; }
      apply();
    }
    changed ??= Object.entries(next).filter(([key, value]) => previous[key] !== value);
    for (const [key, value] of changed) {
      if (key.startsWith('--') || key.includes('-')) { probe.style.setProperty(key, value ?? ''); } else { probe.style[key] = value ?? ''; }
      apply();
    }
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    if (failed) {
      try { Dom.detachEl(probe); } catch {
        // Releasing the temporary normalizer must not replace the original error.
      }
    } else { Dom.detachEl(probe); }
  }
}
export function displayContents(Dom, element) { applyStyle(Dom, element, { display: 'contents' }); }
