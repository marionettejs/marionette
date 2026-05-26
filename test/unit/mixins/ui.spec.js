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
  });
});
