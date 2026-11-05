import { afterEach, describe, expect, it } from 'vitest';
import { createSchemaRenderer } from '@mnjs/formkit';

const renderers = [];
function render(schema, options = {}) {
  const container = document.body.appendChild(document.createElement('div'));
  const renderer = createSchemaRenderer(container, { schema, ...options });
  renderers.push(renderer);
  return { container, ...renderer };
}
afterEach(() => {
  renderers.splice(0).forEach(renderer => renderer.destroy());
  document.body.replaceChildren();
});

describe('@mnjs/formkit expression evaluation lifetimes', () => {
  it('reads live getters for each occurrence and preserves short-circuit evaluation', () => {
    let reads = 0;
    const data = { enabled: false, get value() { return ++reads; } };
    const view = render([
      { $el: 'b', children: '$value + $value' },
      { $el: 'i', children: '$enabled && $value' }
    ], { data });
    expect(view.container.textContent).toBe('3false'); expect(reads).toBe(2);
    data.enabled = true; view.update();
    expect(view.container.textContent).toBe('75'); expect(reads).toBe(5);
    view.update({ enabled: false, value: 10 });
    expect(view.container.textContent).toBe('20false'); expect(reads).toBe(5);
  });

  it('keeps repeated expressions isolated across forms and reentrant getters or coercion', () => {
    const schema = { $el: 'b', children: '$first + $suffix' };
    const a = render(schema, { data: { first: 'A', suffix: ':a' } });
    const b = render(schema, { data: { first: 'B', suffix: ':b' } });
    const inner = [];
    a.update({ get first() {
      b.update({ first: 'Other', suffix: ':other' });
      a.update({ first: 'Nested', suffix: ':nested' });
      inner.push(a.container.textContent);
      return 'Outer';
    }, suffix: ':outer' });
    expect(inner).toEqual(['Nested:nested']);
    expect(a.container.textContent).toBe('Outer:outer');
    expect(b.container.textContent).toBe('Other:other');
    a.update({ first: { [Symbol.toPrimitive]() {
      a.update({ first: 'Coercion nested', suffix: ':nested' });
      return 'Coercion outer';
    } }, suffix: ':outer' });
    expect(a.container.textContent).toBe('Coercion outer:outer');
  });

  it('isolates function-tail providers during reentry and respects replacement receivers', () => {
    const schema = { $el: 'b', children: '$factory().pick($suffix)' };
    const data = (label, suffix) => ({ label, suffix, factory() {
      return { label: this.label, pick(value) { return `${this.label}:${value}`; } };
    } });
    const view = render(schema, { data: data('Initial', 'i') });
    const observed = [];
    view.update({ label: 'Outer', suffix: 'a', factory() {
      view.update(data('Inner', 'b'));
      observed.push(view.container.textContent);
      return { label: this.label, pick(value) { return `${this.label}:${value}`; } };
    } });
    expect(observed).toEqual(['Inner:b']);
    expect(view.container.textContent).toBe('Outer:a');
    view.update(data('Replacement', 'r'));
    expect(view.container.textContent).toBe('Replacement:r');
  });

  it('updates nested row scopes, slot receivers and opaque fallbacks through reorder and removal', () => {
    const schema = { $el: 'section', for: ['group', '$groups'], key: '$group.id', children: [
      { $el: 'b', children: '$group.label + $suffix' },
      { $el: 'i', for: ['row', '$group.rows'], key: '$row.id', attrs: { 'data-id': '$row.id' },
        children: '$slots.row || $row.label' }
    ] };
    const groups = [
      { id: 'a', label: 'A', rows: [{ id: 'x', label: '$literal' }, { id: 'y', label: 'Y' }] },
      { id: 'b', label: 'B', rows: [{ id: 'z', label: 'Z' }] }
    ];
    const view = render(schema, { data: { groups, suffix: '!', slots: {} } });
    expect(view.container.textContent).toBe('A!$literalYB!Z');
    const y = view.container.querySelector('[data-id=y]');
    const slots = { prefix: 'Slot:', row(scope) {
      return { schema: '$label + $suffix', data: { label: this.prefix + scope.row.label, suffix: scope.group.label } };
    } };
    view.update({ groups: [groups[1], { ...groups[0], rows: [groups[0].rows[1]] }], suffix: '?', slots });
    expect(view.container.textContent).toBe('B?Slot:ZBA?Slot:YA');
    expect(view.container.querySelector('[data-id=y]')).toBe(y);
    expect(view.container.querySelector('[data-id=x]')).toBeNull();
    view.update({ groups: [groups[0]], suffix: '.', slots: {} });
    expect(view.container.textContent).toBe('A.$literalY');
    view.destroy(); expect(view.container.childNodes).toHaveLength(0);
  });

  it('evaluates many distinct expressions with current data after schema replacement', () => {
    const schema = Array.from({ length: 200 }, (_, index) => ({
      $el: 'b', key: String(index), children: `$value + ' / ${index}'`
    }));
    const view = render(schema, { data: { value: 'First' } });
    const first = view.container.firstElementChild;
    view.update({ value: 'Second' });
    expect([...view.container.children].map(element => element.textContent))
      .toEqual(schema.map((_, index) => `Second / ${index}`));
    view.setSchema([schema[0], { $el: 'i', children: '$value + \' (grouped literal)\'' }]);
    view.update({ value: 'Third' });
    expect(view.container.firstElementChild).toBe(first);
    expect(view.container.textContent).toBe('Third / 0Third (grouped literal)');
  });

  it('propagates expression errors and releases owned listeners on terminal destruction', () => {
    let clicks = 0;
    const failure = new Error('application getter failed');
    const view = render({ $el: 'button', attrs: { onClick: '$click' }, children: '$value + $suffix' },
      { data: { value: 'Ready', suffix: '!', click() { clicks++; } } });
    const button = view.container.firstElementChild;
    button.click(); expect(clicks).toBe(1);
    expect(() => view.update({ get value() { throw failure; }, suffix: '!', click() { clicks++; } })).toThrow(failure);
    view.destroy(); button.click();
    expect(clicks).toBe(1); expect(view.container.childNodes).toHaveLength(0);
  });
});
