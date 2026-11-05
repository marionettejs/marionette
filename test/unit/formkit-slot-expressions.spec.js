import { afterEach, expect, it, vi } from 'vitest';
import { createSchemaRenderer } from '@mnjs/formkit';

const owners = [];
afterEach(() => { owners.splice(0).forEach(owner => owner.destroy()); document.body.replaceChildren(); });
function render(data, schema = '$slots.default || $slots.on || $option.onLabel || $option.label') {
  const container = document.body.appendChild(document.createElement('div'));
  const view = createSchemaRenderer(container, { data, schema }); owners.push(view);
  return { container, ...view };
}

it.each(['Fallback', '$price', '<b>Text only</b>', 0, false, null, undefined])('renders a non-slot fallback as opaque text: %s', label => {
  const view = render({ slots: {}, option: { label } });
  expect(view.container.textContent).toBe(String(label));
  expect(view.container.querySelector('b')).toBeNull();
  view.update({ slots: {}, option: { label: 'Updated' } });
  expect(view.container.textContent).toBe('Updated');
});

it('evaluates a fallback callback only once per render and preserves its receiver', () => {
  const calls = [];
  const option = { label: '$literal', text() { calls.push(this); return this.label; } };
  const view = render({ slots: {}, option }, '$slots.default || $option.text()');
  expect(view.container.textContent).toBe('$literal'); expect(calls).toEqual([option]);
  view.update(); expect(calls).toEqual([option, option]);
});

it('preserves chosen slot scope and receiver through updates, fallback and terminal cleanup', () => {
  const calls = [], clicked = vi.fn();
  const slots = { label: 'Slot receiver', on(scope) {
    calls.push([this.label, scope.option.label]);
    return { schema: { $el: 'button', attrs: { onClick: '$clicked' }, children: '$label' },
      data: { label: `${this.label}: ${scope.option.label}`, clicked } };
  } };
  const view = render({ slots, option: { label: 'First' } });
  const button = view.container.querySelector('button');
  expect(button.textContent).toBe('Slot receiver: First'); button.click(); expect(clicked).toHaveBeenCalledTimes(1);
  view.update({ slots, option: { label: 'Second' } });
  expect(view.container.querySelector('button')).toBe(button);
  expect(button.textContent).toBe('Slot receiver: Second');
  expect(calls).toEqual([['Slot receiver', 'First'], ['Slot receiver', 'Second']]);
  view.update({ slots: {}, option: { label: '$fallback' } });
  expect(view.container.textContent).toBe('$fallback'); expect(button.isConnected).toBe(false);
  button.click(); expect(clicked).toHaveBeenCalledTimes(1);
  view.update({ slots, option: { label: 'Third' } });
  const retained = view.container.querySelector('button');
  view.destroy(); retained.click(); view.update({ slots, option: { label: 'Ignored' } });
  expect(clicked).toHaveBeenCalledTimes(1); expect(calls).toHaveLength(3);
});

it.each(['', []])('retains an intentionally empty supplied slot instead of using fallback text: %s', content => {
  const slot = vi.fn(() => content);
  const view = render({ slots: { default: slot }, option: { label: 'Fallback' } });
  expect(view.container.textContent).toBe(''); expect(slot).toHaveBeenCalledTimes(1);
  view.update({ slots: {}, option: { label: 'Fallback' } });
  expect(view.container.textContent).toBe('Fallback');
});
