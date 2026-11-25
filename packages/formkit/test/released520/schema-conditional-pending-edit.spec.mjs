import { afterEach, expect, it, vi } from 'vitest';
import { Region } from 'marionette';
import { FormKitView } from '@mnjs/formkit';

const owners = [];
afterEach(() => {
  try {
    for (const owner of owners.splice(0).reverse()) { owner.destroy(); }
  } finally {
    document.body.replaceChildren();
    vi.useRealTimers();
  }
});

it('retires a conditionally hidden pending edit without retiring its sibling, then observes a fresh shown generation', async() => {
  vi.useFakeTimers();
  const host = document.createElement('main');
  document.body.append(host);
  const region = new Region({ el: host });
  owners.push(region);
  const view = new FormKitView({
    instrument: true,
    formProps: { actions: false },
    data: { shown: true },
    schema: [
      { $formkit: 'text', if: '$shown', name: 'conditional', key: 'conditional',
        label: 'Conditional', value: 'Conditional initial', config: { delay: 80 } },
      { $formkit: 'text', name: 'sibling', key: 'sibling',
        label: 'Sibling', value: 'Sibling initial', config: { delay: 30 } }
    ]
  });
  region.show(view);
  const facts = [], changes = [];
  view.observeFieldCommits(fact => facts.push(fact));
  view.on('form:change', values => changes.push(structuredClone(values)));
  const settle = async() => {
    const fence = view.whenPendingEditsSettled();
    await vi.runAllTimersAsync();
    await fence;
  };
  await settle();
  const oldNode = view.node.at('conditional');
  const siblingNode = view.node.at('sibling');
  const oldInput = host.querySelector('input[name="conditional"]');
  const siblingInput = host.querySelector('input[name="sibling"]');
  expect(oldNode).toBeDefined();
  expect(siblingNode).toBeDefined();
  expect(oldInput).not.toBeNull();
  expect(siblingInput).not.toBeNull();
  const type = (input, value) => {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  // Establish real delivered generations before testing either owner's lifetime.
  facts.length = 0;
  type(oldInput, 'Conditional prior');
  type(siblingInput, 'Sibling prior');
  await settle();
  const oldFact = facts.find(fact => fact.node === oldNode && fact.value === 'Conditional prior');
  const siblingFact = facts.find(fact => fact.node === siblingNode && fact.value === 'Sibling prior');
  expect(oldFact).toBeDefined();
  expect(siblingFact).toBeDefined();
  facts.length = 0;
  changes.length = 0;

  expect(oldNode.isSettled).toBe(true);
  type(oldInput, 'Retired pending edit');
  expect(oldInput.value).toBe('Retired pending edit');
  expect(oldNode.isSettled).toBe(false);
  let resolved = false;
  const pending = view.whenPendingEditsSettled().then(() => { resolved = true; });
  // Only the disappearing field is pending here; the sibling cannot mask an unqueued edit.
  await vi.advanceTimersByTimeAsync(10);
  expect(resolved).toBe(false);
  expect(oldNode.isSettled).toBe(false);
  expect(oldNode.value).toBe('Conditional prior');
  type(siblingInput, 'Surviving pending edit');
  await vi.advanceTimersByTimeAsync(0);
  expect(resolved).toBe(false);
  expect(oldNode.value).toBe('Conditional prior');
  expect(siblingNode.value).toBe('Sibling prior');

  view.updateData({ shown: false });
  await vi.advanceTimersByTimeAsync(0);
  expect(host.querySelector('input[name="conditional"]')).toBeNull();
  expect(oldInput.isConnected).toBe(false);
  expect(view.node.at('conditional')).toBeUndefined();
  expect(Object.hasOwn(view.getValues(), 'conditional')).toBe(false);
  expect(view.node.at('sibling')).toBe(siblingNode);
  expect(host.querySelector('input[name="sibling"]')).toBe(siblingInput);
  expect(siblingInput.isConnected).toBe(true);
  expect(resolved).toBe(false);

  // Removal must not resolve the fence while the retained sibling still works.
  await vi.advanceTimersByTimeAsync(29);
  expect(resolved).toBe(false);
  expect(siblingNode.value).toBe('Sibling prior');
  await vi.advanceTimersByTimeAsync(1);
  await pending;
  expect(resolved).toBe(true);
  expect(view.getValues()).toEqual({ sibling: 'Surviving pending edit' });
  const surviving = facts.filter(fact => fact.node === siblingNode);
  expect(surviving.map(fact => [fact.path, fact.value, fact.generation])).toEqual([
    [['sibling'], 'Surviving pending edit', siblingFact.generation]
  ]);
  expect(facts.some(fact => fact.node === oldNode)).toBe(false);

  // Cross the removed producer's original deadline, not merely its DOM removal.
  await vi.advanceTimersByTimeAsync(100);
  expect(view.getValues()).toEqual({ sibling: 'Surviving pending edit' });
  expect(facts.some(fact => fact.value === 'Retired pending edit')).toBe(false);
  expect(changes.some(values => values.conditional === 'Retired pending edit')).toBe(false);
  type(siblingInput, 'Sibling next');
  await settle();
  expect(view.node.at('sibling')).toBe(siblingNode);
  expect(host.querySelector('input[name="sibling"]')).toBe(siblingInput);
  expect(facts.filter(fact => fact.node === siblingNode).map(fact => [fact.value, fact.generation])).toEqual([
    ['Surviving pending edit', siblingFact.generation],
    ['Sibling next', siblingFact.generation]
  ]);

  view.updateData({ shown: true });
  await settle();
  const freshNode = view.node.at('conditional');
  const freshInput = host.querySelector('input[name="conditional"]');
  expect(freshNode).toBeDefined();
  expect(freshNode).not.toBe(oldNode);
  expect(freshInput).not.toBeNull();
  expect(freshInput).not.toBe(oldInput);
  expect(freshInput.isConnected).toBe(true);
  expect(freshInput.value).toBe('Conditional initial');
  expect(view.node.at('sibling')).toBe(siblingNode);
  expect(host.querySelector('input[name="sibling"]')).toBe(siblingInput);
  expect(siblingInput.value).toBe('Sibling next');
  const deliveredBefore = facts.length;
  type(freshInput, 'Fresh generation edit');
  await settle();
  const freshFacts = facts.slice(deliveredBefore).filter(fact => fact.node === freshNode);
  expect(freshFacts).toHaveLength(1);
  expect(freshFacts[0].path).toEqual(['conditional']);
  expect(freshFacts[0].value).toBe('Fresh generation edit');
  expect(freshFacts[0].generation).not.toBe(oldFact.generation);
  expect(facts.some(fact => fact.value === 'Retired pending edit')).toBe(false);
  expect(view.getValues()).toEqual({ conditional: 'Fresh generation edit', sibling: 'Sibling next' });
  region.destroy();
  expect(host.childNodes).toHaveLength(0);
  expect(view.metrics.coreNodesCreated).toBe(view.metrics.coreNodesDestroyed);
});
