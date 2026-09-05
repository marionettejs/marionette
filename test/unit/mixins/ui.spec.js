import View from '../../../src/modules/view';
import UIMixin from '../../../src/mixins/ui';

describe('ui mixin', function() {
  'use strict';

  describe('subclass ui event normalization', function() {
    let GenericView;
    let genericViewSubclass1Instance;
    let genericViewSubclass2Instance;

    beforeEach(function() {
      GenericView = View.extend({
        events: {'change @ui.someUi': 'onSomeUiChange'},
        onSomeUiChange: sinon.stub()
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
      expect(genericViewSubclass1Instance.onSomeUiChange).to.be.calledOnce;
    });

    it('normalizes inherited event maps for the second subclass ui', function() {
      genericViewSubclass2Instance.ui.someUi[0].dispatchEvent(new Event('change', {bubbles: true}));
      expect(genericViewSubclass2Instance.onSomeUiChange).to.be.calledOnce;
    });

    it('the generic view class should have its prototype events hash untouched and in its original form', function() {
      expect(GenericView.prototype.events).to.eql({'change @ui.someUi': 'onSomeUiChange'});
    });
  });

  describe('#normalizeUIKeys', function() {
    let view;

    beforeEach(function() {
      view = {
        ui: {
          foo: '.foo',
          bar: '.bar'
        }
      };
      _.extend(view, UIMixin);
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
      view = {
        ui: {
          foo: '.foo',
          bar: '.bar'
        }
      };
      _.extend(view, UIMixin);
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
      const inheritedGetter = sinon.stub().throws(new Error('inherited getter ran'));
      const prototype = {};
      Object.defineProperty(prototype, 'danger', { get: inheritedGetter });
      view.ui = Object.create(prototype);

      expect(() => view.normalizeUIString('@ui.danger'))
        .to.throw('The ui reference "danger" must be declared as an own ui key.')
        .with.property('code', 'MN0018');
      expect(inheritedGetter).not.to.have.been.called;
    });

    it('accepts an empty selector when its ui key is declared', function() {
      view.ui.empty = '';

      expect(view.normalizeUIString('@ui.empty')).to.equal('');
    });

    it('accepts a non-enumerable own selector declaration', function() {
      Object.defineProperty(view.ui, 'hidden', { value: '.hidden' });

      expect(view.normalizeUIString('@ui.hidden')).to.equal('.hidden');
    });

    it('requires a declared ui reference to contain a string selector', function() {
      view.ui.invalid = 1;

      expect(() => view.normalizeUIString('@ui.invalid'))
        .to.throw('The ui reference "invalid" must be a string selector.')
        .with.property('code', 'MN0018');
    });
  });

  describe('#normalizeUIValues', function() {
    let view;

    beforeEach(function() {
      view = {
        ui: {
          foo: '.foo',
          bar: '.bar'
        }
      };
      _.extend(view, UIMixin);
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

  describe('#_getUIBindings', function() {
    it('calls _uiBindings on the view with no arguments and short-circuits ui', function() {
      const bindings = { foo: '.foo' };
      const uiBindings = this.sinon.stub().returns(bindings);
      const view = _.extend({
        _uiBindings: uiBindings,
        get ui() {
          throw new Error('ui should not be read');
        }
      }, UIMixin);

      expect(view._getUIBindings()).to.equal(bindings);
      expect(uiBindings).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();
    });

    it('falls back to a callable ui value when _uiBindings resolves falsy', function() {
      [null, false, 0, '', NaN].forEach(falsyValue => {
        const bindings = { foo: '.foo' };
        const uiBindings = this.sinon.stub().returns(falsyValue);
        const ui = this.sinon.stub().returns(bindings);
        const view = _.extend({ _uiBindings: uiBindings, ui }, UIMixin);

        expect(view._getUIBindings()).to.equal(bindings);
        expect(uiBindings).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();
        expect(ui).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();
      });
    });
  });

  describe('#_bindUIElements', function() {
    it('resolves callable bindings on the view with no arguments', function() {
      const bindings = { foo: '.foo' };
      const ui = this.sinon.stub().returns(bindings);
      const selectorResult = {};
      const view = _.extend({
        $: this.sinon.stub().returns(selectorResult),
        ui
      }, UIMixin);

      view._bindUIElements();

      expect(ui).to.have.been.calledOnce.and.calledOn(view).and.calledWithExactly();
      expect(view._uiBindings).to.equal(ui);
      expect(view.ui.foo).to.equal(selectorResult);
    });

    it('treats nullish resolved bindings as an empty bound map', function() {
      const ui = this.sinon.stub().returns(null);
      const view = _.extend({
        $: this.sinon.stub(),
        ui
      }, UIMixin);

      view._bindUIElements();

      expect(view.$).not.to.have.been.called;
      expect(view.ui).to.equal(view._ui).and.to.deep.equal({});
    });

    it('preserves non-string selectors when binding ui directly', function() {
      const BindingView = View.extend({
        ui: {direct: 1}
      });
      const bindingView = new BindingView();
      const selectorResult = {};
      bindingView.$ = sinon.stub().returns(selectorResult);

      bindingView.bindUIElements();

      expect(bindingView.$).to.have.been.calledOnceWithExactly(1);
      expect(bindingView.ui.direct).to.equal(selectorResult);
    });

    it('binds an own __proto__ key without changing the result prototype', function() {
      const selectorResult = {};
      const bindings = Object.defineProperty({}, '__proto__', {
        enumerable: true,
        value: 'selector'
      });
      const view = _.extend({
        $: this.sinon.stub().returns(selectorResult),
        ui: bindings
      }, UIMixin);

      view._bindUIElements();

      expect(view.$).to.have.been.calledOnceWithExactly('selector');
      expect(Object.getPrototypeOf(view.ui)).to.equal(Object.prototype);
      expect(view.ui).to.have.own.property('__proto__', selectorResult);
      expect(Object.getOwnPropertyDescriptor(view.ui, '__proto__')).to.include({
        configurable: true,
        enumerable: true,
        writable: true
      });
    });
  });

  describe('#_unbindUIElements', function() {
    it('reads and deletes snapshotted own bindings before restoring their identity', function() {
      const reads = [];
      const originalBindings = { foo: '.foo' };
      const boundTarget = {};
      Object.defineProperties(boundTarget, {
        first: {
          configurable: true,
          enumerable: true,
          get() {
            reads.push('first');
            delete boundTarget.second;
            return 'first';
          }
        },
        second: {
          configurable: true,
          enumerable: true,
          get() {
            reads.push('second');
            return 'second';
          }
        }
      });
      const deletes = [];
      const bound = new Proxy(boundTarget, {
        deleteProperty(target, property) {
          deletes.push(property);
          return Reflect.deleteProperty(target, property);
        }
      });
      const view = _.extend({
        _ui: bound,
        _uiBindings: originalBindings,
        ui: bound
      }, UIMixin);

      view._unbindUIElements();

      expect(reads).to.deep.equal(['first']);
      expect(deletes).to.deep.equal(['first', 'second']);
      expect(Reflect.ownKeys(bound)).to.deep.equal([]);
      expect(view.ui).to.equal(originalBindings);
      expect(view).to.not.have.property('_ui');
      expect(view).to.not.have.property('_uiBindings');
    });

    it('deletes an own __proto__ binding before restoring the original map', function() {
      const originalBindings = Object.defineProperty({}, '__proto__', {
        enumerable: true,
        value: 'selector'
      });
      const bound = Object.defineProperty({}, '__proto__', {
        configurable: true,
        enumerable: true,
        value: {},
        writable: true
      });
      const view = _.extend({
        _ui: bound,
        _uiBindings: originalBindings,
        ui: bound
      }, UIMixin);

      view._unbindUIElements();

      expect(bound).to.not.have.own.property('__proto__');
      expect(view.ui).to.equal(originalBindings);
      expect(view.ui).to.have.own.property('__proto__', 'selector');
    });
  });

});
