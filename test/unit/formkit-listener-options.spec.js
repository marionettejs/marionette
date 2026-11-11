import { afterEach, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { createSchemaRenderer } from '@mnjs/formkit';

const owners = [];
afterEach(() => {
  owners.splice(0).forEach(owner => owner.destroy());
  document.body.replaceChildren();
});
function mount() {
  const host = document.body.appendChild(document.createElement('div'));
  const renderer = createSchemaRenderer(host, { schema: {
    $el: 'section', children: { $el: 'button', children: 'Click' }
  } });
  owners.push(renderer);
  return { renderer, section: host.firstElementChild, button: host.querySelector('button') };
}
function options(kind, values) {
  return kind === 'inherited' ? Object.create(values) : Object.defineProperties({},
    Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { value }])));
}

it('reads option getters in the same order and count as the native DOM API', () => {
  const { button } = mount();
  // Vitest patches the test window's addEventListener to translate Node signals.
  // Use an independent realm for the standard dictionary-conversion control.
  const controlDOM = new JSDOM('');
  const control = controlDOM.window.document.createElement('button');
  const nativeController = new controlDOM.window.AbortController();
  const controller = new AbortController();
  const calls = [];
  const nativeCalls = [];
  const makeOptions = (reads, signal) => Object.defineProperties({}, Object.fromEntries(
    ['capture', 'once', 'passive', 'signal'].map(key => [key, {
      get() { reads.push(key); return key === 'signal' ? signal : false; }
    }])));
  try {
    control.addEventListener('click', () => {}, makeOptions(nativeCalls, nativeController.signal));
    button.addEventListener('click', () => {}, makeOptions(calls, controller.signal));
    expect(calls).toEqual(nativeCalls);
  } finally {
    controller.abort();
    nativeController.abort();
    controlDOM.window.close();
  }
});

it.each([true, false])('honors boolean capture=%s and releases the listener on teardown', capture => {
  const { renderer, section, button } = mount();
  const phases = [];
  section.addEventListener('click', event => phases.push(event.eventPhase), capture);
  button.click();
  expect(phases).toEqual([capture ? Event.CAPTURING_PHASE : Event.BUBBLING_PHASE]);
  renderer.destroy();
  button.click();
  expect(phases).toHaveLength(1);
});

it.each(['inherited', 'non-enumerable'])('honors %s once options and releases retained elements', kind => {
  const { renderer, button } = mount();
  let calls = 0;
  button.addEventListener('click', () => { calls++; }, options(kind, { once: true }));
  button.click();
  button.click();
  expect(calls).toBe(1);
  renderer.destroy();
  button.click();
  expect(calls).toBe(1);
});

it.each(['inherited', 'non-enumerable'])('honors %s capture options', kind => {
  const { renderer, section, button } = mount();
  const phases = [];
  section.addEventListener('click', event => phases.push(event.eventPhase), options(kind, { capture: true }));
  button.click();
  expect(phases).toEqual([Event.CAPTURING_PHASE]);
  renderer.destroy();
  button.click();
  expect(phases).toEqual([Event.CAPTURING_PHASE]);
});

it.each(['inherited', 'non-enumerable'])('honors %s passive options', kind => {
  const { renderer, button } = mount();
  let calls = 0;
  button.addEventListener('click', event => { calls++; event.preventDefault(); }, options(kind, { passive: true }));
  const event = new Event('click', { cancelable: true });
  button.dispatchEvent(event);
  expect(calls).toBe(1);
  expect(event.defaultPrevented).toBe(false);
  renderer.destroy();
  button.dispatchEvent(new Event('click', { cancelable: true }));
  expect(calls).toBe(1);
});

it.each(['inherited', 'non-enumerable'])('preserves %s caller signal ownership on teardown', kind => {
  const { renderer, button } = mount();
  const controller = new AbortController();
  let calls = 0;
  button.addEventListener('click', () => { calls++; }, options(kind, { signal: controller.signal }));
  button.click();
  expect(calls).toBe(1);
  renderer.destroy();
  expect(controller.signal.aborted).toBe(false);
  button.click();
  expect(calls).toBe(1);
});
