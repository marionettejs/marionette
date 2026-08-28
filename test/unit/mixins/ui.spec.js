import View from '../../../modules/view';
import UIMixin from '../../../mixins/ui';

describe('normalizeUIKeys', function() {
  'use strict';

  describe('When creating a generic View class without a ui hash, and creating two generic view sublcasses with a ui hash', function() {
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

    describe('the 1st generic view subclass instance', function() {
      it('should have its registered event handler called when the ui DOM event is triggered', function() {
        genericViewSubclass1Instance.ui.someUi[0].dispatchEvent(new Event('change', {bubbles: true}));
        expect(genericViewSubclass1Instance.onSomeUiChange).to.be.calledOnce;
      });
    });

    describe('the 2nd generic view subclass instance', function() {
      it('should have its registered event handler called when the ui DOM event is triggered', function() {
        genericViewSubclass2Instance.ui.someUi[0].dispatchEvent(new Event('change', {bubbles: true}));
        expect(genericViewSubclass2Instance.onSomeUiChange).to.be.calledOnce;
      });
    });

    it('the generic view class should have its prototype events hash untouched and in its original form', function() {
      expect(GenericView.prototype.events).to.eql({'change @ui.someUi': 'onSomeUiChange'});
    });
  });

  describe('direct UI normalization helpers', function() {
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

    it('normalizes ui keys with default bindings', function() {
      expect(view.normalizeUIKeys({'click @ui.foo': 'onFoo'})).to.eql({
        'click .foo': 'onFoo'
      });
    });

    it('normalizes string and object values', function() {
      const values = {
        stringValue: '@ui.foo',
        objectValue: {el: '@ui.bar'},
        emptyValue: null
      };

      expect(view.normalizeUIValues(values, 'el')).to.equal(values);
      expect(values).to.eql({
        stringValue: '.foo',
        objectValue: {el: '.bar'},
        emptyValue: null
      });
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

    it('requires ui references in keys and values to be own declared keys', function() {
      const operations = [
        () => view.normalizeUIString('@ui.toString'),
        () => view.normalizeUIKeys({'click @ui.missing': 'onMissing'}),
        () => view.normalizeUIValues({region: '@ui.missing'}, 'el'),
        () => view.normalizeUIValues({region: {el: '@ui.missing'}}, 'el')
      ];

      operations.forEach(operation => {
        expect(operation).to.throw().with.property('code', 'MN0018');
      });
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

    it('requires a declared ui reference to contain a string selector', function() {
      view.ui.invalid = 1;

      expect(() => view.normalizeUIString('@ui.invalid'))
        .to.throw('The ui reference "invalid" must be a string selector.')
        .with.property('code', 'MN0018');
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
  });
});
