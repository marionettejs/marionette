import { describe, expect, it, vi } from 'vitest';
import { monitorViewEvents, Region, View } from 'marionette';

function family() {
  const parent = new View({ template: () => '<main></main><aside></aside>', regions: { first: 'main', second: 'aside' } });
  const first = new View({ template: () => '' });
  const second = new View({ template: () => '' });
  parent.showChildView('first', first);
  parent.showChildView('second', second);
  const el = document.createElement('div');
  document.body.append(el);
  return { parent, first, second, el, region: new Region({ el }) };
}

describe('monitorViewEvents', () => {
  it('propagates attachment and detachment to owned child Views', () => {
    const { parent, first, second, el, region } = family();
    const calls = [];
    first.on('attach', () => { expect(first.isAttached()).toBe(true); calls.push('first'); });
    second.on('attach', () => { expect(second.isAttached()).toBe(true); calls.push('second'); });
    region.show(parent);
    expect(calls).toEqual(['first', 'second']);
    region.detachView();
    expect(first.isAttached()).toBe(false);
    expect(second.isAttached()).toBe(false);
    parent.destroy();
    region.destroy();
    el.remove();
  });

  it('does not add duplicate lifecycle subscriptions', () => {
    const { parent, first, el, region } = family();
    const onAttach = vi.fn();
    first.on('attach', onAttach);
    monitorViewEvents(parent);
    monitorViewEvents(parent);
    region.show(parent);
    expect(onAttach).toHaveBeenCalledTimes(1);
    region.destroy();
    el.remove();
  });

  it('honors a disabled monitor', () => {
    const view = new (View.extend({ monitorViewEvents: false }))();
    const on = vi.spyOn(view, 'on');
    monitorViewEvents(view);
    expect(on).not.toHaveBeenCalled();
    view.destroy();
  });
});
