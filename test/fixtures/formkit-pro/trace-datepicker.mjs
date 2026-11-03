// Read-only diagnostics for an already bootstrapped, authorized Pro consumer.
// Records event structure and boolean state, never values, text, keys or URLs.
export function traceDatepicker(node, document = globalThis.document) {
  const window = document.defaultView;
  const buttonId = `${node.props.id}_listbox_button`;
  const originalButton = document.getElementById(buttonId);
  const started = window.performance.now();
  const records = [];
  const describe = element => element?.nodeType === 1 ? { tag: element.tagName, id: element.id } : null;
  const record = detail => records.push({
    elapsed: Math.round(window.performance.now() - started),
    expanded: !!node.props.expanded,
    ariaExpanded: document.getElementById(buttonId)?.getAttribute('aria-expanded') ?? null,
    originalConnected: !!originalButton?.isConnected,
    sameButton: document.getElementById(buttonId) === originalButton,
    active: describe(document.activeElement), ...detail
  });
  const receipt = node.on('prop:expanded', event => record({
    kind: 'expanded', payload: !!event.payload,
    // Function names only: stack URLs can include configuration query strings.
    callers: new Error().stack?.split('\n').slice(1, 15).map(line =>
      line.match(/^\s*at (?:async )?([\w$.<>]+)\s+\(/)?.[1] ?? '<anonymous>')
  }));
  const types = ['pointerdown', 'mousedown', 'blur', 'focus', 'focusin', 'focusout', 'pointerup', 'mouseup', 'click', 'keydown'];
  const listeners = [];
  for (const capture of [true, false]) {
    for (const type of types) {
      const listener = event => record({ kind: 'event', type, phase: capture ? 'capture' : 'bubble',
        target: describe(event.target), relatedTarget: describe(event.relatedTarget),
        originalInPath: !!originalButton && event.composedPath().includes(originalButton),
        defaultPrevented: event.defaultPrevented });
      document.addEventListener(type, listener, { capture, passive: true });
      listeners.push(() => document.removeEventListener(type, listener, capture));
    }
  }
  const direct = () => record({ kind: 'button-click' });
  originalButton?.addEventListener('click', direct, { passive: true });
  const observer = new window.MutationObserver(changes => {
    for (const change of changes) {
      const relevant = [...change.addedNodes, ...change.removedNodes].some(element =>
        element === originalButton || element.nodeType === 1 && element.contains(originalButton));
      if (relevant) { record({ kind: 'placement', target: describe(change.target),
        added: [...change.addedNodes].map(describe).filter(Boolean),
        removed: [...change.removedNodes].map(describe).filter(Boolean) }); }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  record({ kind: 'start' });
  let stopped = false;
  return {
    mark(label) { record({ kind: 'mark', label }); },
    stop() {
      if (!stopped) {
        stopped = true;
        node.off(receipt);
        listeners.forEach(remove => remove());
        originalButton?.removeEventListener('click', direct);
        observer.disconnect();
        record({ kind: 'stop' });
      }
      return records;
    }
  };
}
