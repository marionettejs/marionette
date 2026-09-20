import { afterEach, describe, expect, it, vi } from 'vitest';
import { Application, createMarionette } from 'marionette';

const owners = [];
function own(app) {
  owners.push(app);
  return app;
}
afterEach(async() => {
  for (const app of owners.splice(0)) { await app.destroy(); }
});

describe('Application child declarations', () => {
  it('constructs fresh named children before initialize without forwarding parent options', () => {
    const initializeChild = vi.fn(function() {
      expect(this.getName()).toBeUndefined();
    });
    const Child = Application.extend({ initialize: initializeChild });
    const initializeParent = vi.fn(function() {
      expect(this.getChildApp('editor')).toBeInstanceOf(Child);
      expect(this.getChildApp('editor').getName()).toBe('editor');
    });
    const childApps = { editor: Child };
    const Parent = Application.extend({ childApps, initialize: initializeParent });
    const first = own(new Parent({ label: 'parent' }));
    const second = own(new Parent());
    expect(first.getChildApp('editor')).not.toBe(second.getChildApp('editor'));
    expect(initializeParent).toHaveBeenCalledTimes(2);
    expect(initializeChild.mock.calls).toEqual([[], []]);
    expect(childApps).toEqual({ editor: Child });
  });

  it('retains declared children through explicit activation and restart, then destroys them', async() => {
    const app = own(new Application({ childApps: { editor: Application } }));
    const child = app.getChildApp('editor');
    await expect(app.start()).resolves.toBe(true);
    expect(child.isRunning()).toBe(false);
    await expect(child.start()).resolves.toBe(true);
    await expect(app.restart()).resolves.toBe(true);
    expect(app.getChildApp('editor')).toBe(child);
    expect(child.isRunning()).toBe(false);
    await expect(child.start()).resolves.toBe(true);
    await expect(app.stop()).resolves.toBe(true);
    expect(child.isRunning()).toBe(false);
    await expect(app.destroy()).resolves.toBe(true);
    expect(child.isDestroyed()).toBe(true);
  });

  it('inherits declarations independently of initialize overrides and replaces rather than merges maps', () => {
    const baseInitialize = vi.fn();
    const Parent = Application.extend({ childApps: { inherited: Application }, initialize: baseInitialize });
    const Inherited = Parent.extend({ initialize() {} });
    const Replaced = Parent.extend({ childApps: { replacement: Application } });
    const inherited = own(new Inherited());
    expect(inherited.hasChildApp('inherited')).toBe(true);
    expect(baseInitialize).not.toHaveBeenCalled();
    const replaced = own(new Replaced());
    expect(Object.keys(replaced.getChildApps())).toEqual(['replacement']);
    const omitted = own(new Parent({ childApps: {} }));
    expect(omitted.getChildApps()).toEqual({});
  });

  it('supports preinitialize configuration and explicit registration alongside declarations', () => {
    const Parent = Application.extend({
      preinitialize() { this.childApps = { declared: Application }; },
      initialize() { this.addChildApp('explicit', new Application()); }
    });
    const app = own(new Parent());
    expect(Object.keys(app.getChildApps())).toEqual(['declared', 'explicit']);
  });

  it('supports native getters and nested declarations with child-first destruction', async() => {
    const destroyed = [];
    const Leaf = Application.extend({ onDestroy() { destroyed.push('leaf'); } });
    const Branch = Application.extend({
      childApps: { leaf: Leaf },
      onDestroy() { destroyed.push('branch'); }
    });
    const declaration = vi.fn(() => ({ branch: Branch }));
    class Parent extends Application {
      get childApps() { return declaration(); }
      onDestroy() { destroyed.push('parent'); }
    }
    const app = own(new Parent());
    expect(declaration).toHaveBeenCalledTimes(1);
    expect(app.getChildApp('branch').getChildApp('leaf')).toBeInstanceOf(Leaf);
    await app.destroy();
    expect(destroyed).toEqual(['leaf', 'branch', 'parent']);
  });

  it('resolves a function declaration once with the parent as context before initialize', async() => {
    const declaration = vi.fn(function() {
      expect(this.options.label).toBe('workspace');
      return { editor: Application };
    });
    class Parent extends Application {
      childApps() { return declaration.call(this); }
      initialize() { expect(this.hasChildApp('editor')).toBe(true); }
    }
    const app = own(new Parent({ label: 'workspace' }));
    const child = app.getChildApp('editor');
    await app.restart();
    expect(app.getChildApp('editor')).toBe(child);
    expect(declaration).toHaveBeenCalledTimes(1);
    const configured = own(new Application({ childApps: () => ({ configured: Application }) }));
    expect(configured.hasChildApp('configured')).toBe(true);
  });

  it('replaces getter declarations through options without reading or assigning the getter', () => {
    const inherited = vi.fn(() => ({ inherited: Application }));
    class Parent extends Application {
      get childApps() { return inherited(); }
    }
    const replaced = own(new Parent({ childApps: { replacement: Application } }));
    expect(Object.keys(replaced.getChildApps())).toEqual(['replacement']);
    const declaration = vi.fn(function() {
      expect(this.options.label).toBe('configured');
      return { configured: Application };
    });
    const configured = own(new Parent({ label: 'configured', childApps: declaration }));
    expect(Object.keys(configured.getChildApps())).toEqual(['configured']);
    expect(declaration).toHaveBeenCalledTimes(1);
    const empty = own(new Parent({ childApps: {} }));
    expect(empty.getChildApps()).toEqual({});
    expect(inherited).not.toHaveBeenCalled();
    const fallback = own(new Parent({ childApps: undefined }));
    expect(fallback.hasChildApp('inherited')).toBe(true);
    expect(inherited).toHaveBeenCalledTimes(1);
  });

  it('uses the existing removal lifecycle without reconstructing a declared child', async() => {
    const app = own(new Application({ childApps: { editor: Application } }));
    const child = app.getChildApp('editor');
    await expect(app.removeChildApp('editor')).resolves.toBe(child);
    expect(child.isDestroyed()).toBe(true);
    await app.restart();
    expect(app.hasChildApp('editor')).toBe(false);
  });

  it('supports declarations from an isolated runtime and preserves its ownership boundary', () => {
    const runtime = createMarionette();
    const app = own(new runtime.Application({ childApps: { editor: runtime.Application } }));
    expect(app.getChildApp('editor')).toBeInstanceOf(runtime.Application);
    const Foreign = Application.extend({ initialize() { own(this); } });
    expect(() => new runtime.Application({ childApps: { foreign: Foreign } }))
      .toThrow(expect.objectContaining({ code: 'MN0031' }));
  });
});
