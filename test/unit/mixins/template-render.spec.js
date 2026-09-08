import { describe, expect, it, vi } from 'vitest';
import { View } from 'marionette';

describe('View template rendering', () => {
  it.each([['html', 'html'], ['', ''], [undefined, '']])('attaches renderer output %s', (output, expected) => {
    const Custom = View.extend({ template: () => 'template' });
    Custom.setRenderer(() => output);
    const view = new Custom();
    view.render();
    expect(view.el.innerHTML).toBe(expected);
    view.destroy();
  });

  it.each([
    [{ foo: 'data', bar: 'data' }, { baz: 'context' }, { foo: 'data', bar: 'data', baz: 'context' }],
    [{ foo: 'data' }, undefined, { foo: 'data' }],
    [undefined, { baz: 'context' }, { baz: 'context' }],
    [{ shared: 'data' }, { shared: 'context' }, { shared: 'context' }]
  ])('combines model data and template context', (model, templateContext, expected) => {
    const template = vi.fn().mockReturnValue('rendered');
    const view = new View({ model, template, templateContext });
    view.render();
    expect(template).toHaveBeenCalledExactlyOnceWith(expected);
    expect(view.el.textContent).toBe('rendered');
    view.destroy();
  });

  it('resolves callable context on the View and copies only own values safely', () => {
    const data = Object.assign(Object.create({ inherited: true }), { label: 'data' });
    const value = { safe: true };
    const context = Object.defineProperty({ own: true }, '__proto__', { enumerable: true, value });
    const template = vi.fn().mockReturnValue('rendered');
    const templateContext = vi.fn().mockReturnValue(context);
    const view = new View({ model: data, template, templateContext });
    view.render();
    const rendered = template.mock.calls[0][0];
    expect(rendered).toMatchObject({ label: 'data', own: true });
    expect(rendered).not.toHaveProperty('inherited');
    expect(Object.getOwnPropertyDescriptor(rendered, '__proto__').value).toBe(value);
    expect(Object.getPrototypeOf(rendered)).toBe(Object.prototype);
    expect(templateContext.mock.contexts[0] === view).toBe(true);
    expect(data).not.toHaveProperty('own');
    view.destroy();
  });

  it('uses the configured serializer without requiring a model', () => {
    const serializeData = vi.fn().mockReturnValue({ label: 'serialized' });
    const template = vi.fn().mockReturnValue('rendered');
    const Custom = View.extend({ serializeData });
    const view = new Custom({ template });
    view.render();
    expect(template).toHaveBeenCalledExactlyOnceWith({ label: 'serialized' });
    view.destroy();
  });

  it('preserves existing content with template:false and diagnoses invalid templates', () => {
    const el = document.createElement('div');
    el.textContent = 'existing';
    const view = new View({ el, template: false });
    view.render();
    expect(view.el.textContent).toBe('existing');
    view.destroy();
    expect(() => new View().render()).toThrow();
  });
});
