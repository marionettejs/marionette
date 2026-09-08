import { describe, expect, it, vi } from 'vitest';
import { MnObject, View } from 'marionette';

describe('public owner options', () => {
  it('resolves defaults on the owner and overlays passed options without mutation', () => {
    const defaults = vi.fn().mockReturnValue({ shared: 'default', retained: true });
    const Owner = MnObject.extend({ options: defaults });
    const options = { shared: 'passed', added: true };
    const owner = new Owner(options);
    expect(owner.options).toEqual({ shared: 'passed', retained: true, added: true });
    expect(options).toEqual({ shared: 'passed', added: true });
    expect(defaults).toHaveBeenCalledExactlyOnceWith();
    expect(defaults.mock.contexts[0] === owner).toBe(true);
    owner.destroy();
  });

  it('copies only own options and preserves an own __proto__ value safely', () => {
    const defaults = Object.assign(Object.create({ inheritedDefault: true }), { default: true });
    const passed = Object.assign(Object.create({ inheritedPassed: true }), { passed: true });
    const value = { polluted: true };
    Object.defineProperty(passed, '__proto__', { enumerable: true, value });
    const Owner = MnObject.extend({ options() { return defaults; } });
    const owner = new Owner(passed);
    expect(owner.getOption('default')).toBe(true);
    expect(owner.getOption('passed')).toBe(true);
    expect(owner.options).not.toHaveProperty('inheritedDefault');
    expect(owner.options).not.toHaveProperty('inheritedPassed');
    expect(Object.getPrototypeOf(owner.options)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(owner.options, '__proto__').value).toBe(value);
    owner.destroy();
  });

  it('makes declared View options available during initialize', () => {
    const initialize = vi.fn(function() {
      expect(this.tagName).toBe('article');
      expect(this.getOption('label')).toBe('custom');
    });
    const Custom = View.extend({ initialize });
    const view = new Custom({ tagName: 'article', label: 'custom' });
    expect(initialize).toHaveBeenCalledTimes(1);
    expect(view.el.tagName).toBe('ARTICLE');
    view.destroy();
  });
});
