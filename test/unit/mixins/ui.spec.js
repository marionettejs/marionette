import { vi, describe, it, expect, beforeEach } from 'vitest';
import _ from 'underscore';
import { View } from 'marionette';

describe('ui mixin', function() {
  'use strict';

  describe('subclass ui event normalization', function() {
    let GenericView;
    let genericViewSubclass1Instance;
    let genericViewSubclass2Instance;

    beforeEach(function() {
      GenericView = View.extend({
        events: {'change @ui.someUi': 'onSomeUiChange'},
        onSomeUiChange: vi.fn()
      });
      const GenericViewSubclass1 = GenericView.extend({
        template: _.template('<div class="subclass-1-el"><div class="subclass-1-ui"></div></div>'),
        ui: {someUi: '.subclass-1-ui'}
      });
      const GenericViewSubclass2 = GenericView.extend({
        template: _.template('<div class="subclass-2-el"><div class="subclass-2-ui"></div></div>'),
        ui: {someUi: '.subclass-2-ui'}
      });
      genericViewSubclass1Instance = new GenericViewSubclass1();
      genericViewSubclass2Instance = new GenericViewSubclass2();
      genericViewSubclass1Instance.render();
      genericViewSubclass2Instance.render();
    });

    it('normalizes inherited event maps for the first subclass ui', function() {
      genericViewSubclass1Instance.ui.someUi[0].dispatchEvent(new Event('change', {bubbles: true}));
      expect(genericViewSubclass1Instance.onSomeUiChange).toHaveBeenCalledTimes(1);
    });

    it('normalizes inherited event maps for the second subclass ui', function() {
      genericViewSubclass2Instance.ui.someUi[0].dispatchEvent(new Event('change', {bubbles: true}));
      expect(genericViewSubclass2Instance.onSomeUiChange).toHaveBeenCalledTimes(1);
    });

    it('the generic view class should have its prototype events hash untouched and in its original form', function() {
      expect(GenericView.prototype.events).to.eql({'change @ui.someUi': 'onSomeUiChange'});
    });
  });

  describe('#normalizeUIKeys', function() {
    let view;

    beforeEach(function() {
      view = new View({ ui: { foo: '.foo', bar: '.bar' } });
    });

    it('returns an empty map when there are no keys to normalize', function() {
      expect(view.normalizeUIKeys(null)).to.deep.equal({});
      expect(view.normalizeUIKeys(undefined)).to.deep.equal({});
    });

    it('normalizes ui keys with default bindings into a new object', function() {
      const hash = {'click @ui.foo': 'onFoo'};
      const normalized = view.normalizeUIKeys(hash);

      expect(normalized).to.not.equal(hash);
      expect(normalized).to.eql({
        'click .foo': 'onFoo'
      });
    });

    it('preserves an own __proto__ key without changing the result prototype', function() {
      const value = { marker: true };
      const hash = Object.defineProperty({}, '__proto__', {
        enumerable: true,
        value
      });
      const normalized = view.normalizeUIKeys(hash);

      expect(Object.getPrototypeOf(normalized)).to.equal(Object.prototype);
      expect(normalized).to.have.own.property('__proto__', value);
      expect(Object.getOwnPropertyDescriptor(normalized, '__proto__')).to.include({
        configurable: true,
        enumerable: true,
        writable: true
      });
    });

    it('keeps first insertion order while a later normalized-key collision wins', function() {
      const normalized = view.normalizeUIKeys({
        'click @ui.foo': 'first',
        'click .foo': 'second',
        keyup: 'third'
      });

      expect(Object.keys(normalized)).to.deep.equal(['click .foo', 'keyup']);
      expect(normalized['click .foo']).to.equal('second');
      expect(normalized.keyup).to.equal('third');
    });

    it('requires ui references to be own declared keys', function() {
      expect(() => view.normalizeUIKeys({'click @ui.missing': 'onMissing'}))
        .to.throw()
        .with.property('code', 'MN0018');
    });
  });

  describe('#normalizeUIString', function() {
    let view;

    beforeEach(function() {
      view = new View({ ui: { foo: '.foo', bar: '.bar' } });
    });

    it('normalizes a declared ui reference', function() {
      expect(view.normalizeUIString('@ui.foo')).to.equal('.foo');
    });

    it('throws a stable diagnostic for an unknown literal ui reference', function() {
      expect(() => view.normalizeUIString('@ui.missing'))
        .to.throw('The ui reference "missing" must be declared as an own ui key.')
        .with.property('code', 'MN0018');
    });

    it('requires a literal ui reference to include a key name', function() {
      view.ui[''] = '.empty';

      expect(() => view.normalizeUIString('@ui.'))
        .to.throw('The ui reference must include a key name.')
        .with.property('code', 'MN0018');
    });

    it('does not read inherited ui accessors', function() {
      const inheritedGetter = vi.fn().mockImplementation(() => { throw new Error('inherited getter ran'); });
      const prototype = {};
      Object.defineProperty(prototype, 'danger', { get: inheritedGetter });
      view.ui = Object.create(prototype);

      expect(() => view.normalizeUIString('@ui.danger'))
        .to.throw('The ui reference "danger" must be declared as an own ui key.')
        .with.property('code', 'MN0018');
      expect(inheritedGetter).not.toHaveBeenCalled();
    });

    it('accepts an empty selector when its ui key is declared', function() {
      view.ui.empty = '';

      expect(view.normalizeUIString('@ui.empty')).to.equal('');
    });

    it('accepts a non-enumerable own selector declaration', function() {
      Object.defineProperty(view.ui, 'hidden', { value: '.hidden' });

      expect(view.normalizeUIString('@ui.hidden')).to.equal('.hidden');
    });

  });

  describe('#normalizeUIValues', function() {
    let view;

    beforeEach(function() {
      view = new View({ ui: { foo: '.foo', bar: '.bar' } });
    });

    it('mutates string and object values in place', function() {
      const objectValue = {el: '@ui.bar'};
      const values = {
        stringValue: '@ui.foo',
        objectValue,
        emptyValue: null
      };

      expect(view.normalizeUIValues(values, 'el')).to.equal(values);
      expect(values.objectValue).to.equal(objectValue);
      expect(values).to.eql({
        stringValue: '.foo',
        objectValue: {el: '.bar'},
        emptyValue: null
      });
    });

    it('requires ui references to be own declared keys', function() {
      const operations = [
        () => view.normalizeUIValues({region: '@ui.missing'}, 'el'),
        () => view.normalizeUIValues({region: {el: '@ui.missing'}}, 'el')
      ];

      operations.forEach(operation => {
        expect(operation).to.throw().with.property('code', 'MN0018');
      });
    });
  });

  describe('public UI binding lifecycle', function() {
    it('resolves a callable map and restores it after unbinding', function() {
      const bindings = { action: 'button' };
      const ui = vi.fn().mockReturnValue(bindings);
      const view = new View({ template: () => '<button>Action</button>', ui });
      view.render();
      const bound = view.ui;
      expect(view.getUI('action')[0]).toBe(view.el.firstChild);
      expect(ui.mock.contexts.every(context => context === view)).toBe(true);
      view.unbindUIElements();
      expect(view.ui).toBe(ui);
      expect(bound).toEqual({});
      view.bindUIElements();
      expect(view.getUI('action')[0]).toBe(view.el.firstChild);
      view.destroy();
    });

    it('binds and unbinds an own __proto__ selector safely', function() {
      const bindings = Object.defineProperty({}, '__proto__', { enumerable: true, value: 'button' });
      const view = new View({ template: () => '<button>Action</button>', ui: bindings });
      view.render();
      const bound = view.ui;
      expect(Object.getPrototypeOf(bound)).toBe(Object.prototype);
      expect(view.getUI('__proto__')[0]).toBe(view.el.firstChild);
      view.unbindUIElements();
      expect(bound).not.toHaveProperty('__proto__');
      expect(view.ui).toBe(bindings);
      view.destroy();
    });

    it('accepts nullish callable bindings and idempotent unbinding', function() {
      const view = new View({ template: () => '', ui() { return null; } });
      view.render();
      expect(view.ui).toEqual({});
      view.unbindUIElements();
      view.unbindUIElements();
      view.destroy();
    });
  });
});
