import View from '../../../src/view';

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
        genericViewSubclass1Instance.ui.someUi.trigger('change');
        expect(genericViewSubclass1Instance.onSomeUiChange).to.be.calledOnce;
      });
    });

    describe('the 2nd generic view subclass instance', function() {
      it('should have its registered event handler called when the ui DOM event is triggered', function() {
        genericViewSubclass2Instance.ui.someUi.trigger('change');
        expect(genericViewSubclass2Instance.onSomeUiChange).to.be.calledOnce;
      });
    });

    it('the generic view class should have its prototype events hash untouched and in its original form', function() {
      expect(GenericView.prototype.events).to.eql({'change @ui.someUi': 'onSomeUiChange'});
    });
  });
});
