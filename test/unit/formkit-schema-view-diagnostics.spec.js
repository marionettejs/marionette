import { expect, it } from 'vitest';
import { View, Region } from 'marionette';
import { JSDOM } from 'jsdom';
import { FormView, createViewComponents } from '@mnjs/formkit';

// Deliberately invalid producer configuration. This is an isolated, handled
// diagnostic proof, not evidence of a clean application journey or recovery.
it('DIAGNOSTIC-01 wrong named component owner reports one handled Window error and no unexpected event', async() => {
  const originalQueue = globalThis.queueMicrotask;
  const diagnosticDOM = new JSDOM('<!doctype html><html><body></body></html>', { runScripts: 'outside-only' });
  const diagnosticWindow = diagnosticDOM.window;
  const windowQueue = diagnosticWindow.queueMicrotask.bind(diagnosticWindow);
  const diagnostics = [];
  const unexpected = [];
  const message = 'The schema wrapper must be inserted inside its Region owner before placement.';
  const handleError = event => {
    if (event.error instanceof Error && event.error.message === message) {
      diagnostics.push(event.error);
      event.preventDefault();
    } else {
      unexpected.push(event.error ?? event.message);
    }
  };
  const handleRejection = event => unexpected.push(event.reason);
  const browserQueue = callback => {
    // JSDOM's genuine Window scheduler itself calls the Node global scheduler.
    // Restore that binding only for its scheduling call to avoid recursion;
    // pass the actual public factory callback through without inspecting it.
    globalThis.queueMicrotask = originalQueue;
    try { windowQueue(callback); } finally { globalThis.queueMicrotask = browserQueue; }
  };
  const host = document.body.appendChild(document.createElement('div'));
  const outer = new Region({ el: host });
  const form = new FormView({ template: () => '<main></main>' });
  const wrongOwner = new View({ template: () => '<aside></aside>' });
  outer.show(form); wrongOwner.render();
  diagnosticWindow.addEventListener('error', handleError);
  diagnosticWindow.addEventListener('unhandledrejection', handleRejection);
  globalThis.queueMicrotask = browserQueue;
  try {
    const factories = createViewComponents({ getForm: () => form, getOwner: () => wrongOwner,
      registrations: { Plain: { kind: 'view', create: () => new View({ template: () => '<p>Invalid owner</p>' }) } } });
    const mounted = factories.Plain({ document, props: {}, data: {} });
    form.el.append(mounted.element);
    for (let count = 0; count < 20; count++) { await Promise.resolve(); }
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toBeInstanceOf(Error);
    expect(diagnostics[0].message).toBe(message);
    expect(unexpected).toEqual([]);
  } finally {
    globalThis.queueMicrotask = originalQueue;
    diagnosticWindow.removeEventListener('error', handleError);
    diagnosticWindow.removeEventListener('unhandledrejection', handleRejection);
    wrongOwner.destroy(); outer.destroy(); host.remove();
    diagnosticWindow.close();
  }
});
