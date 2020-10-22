import View from '../../src/view';

describe('_getImmediateChildren', function() {
  let BaseView;

  beforeEach(function() {
    // A suitable view to use as a child
    BaseView = View.extend({
      template: _.noop
    });
  });

  describe('Marionette.View', function() {
    let view;

    beforeEach(function() {
      view = new View();
    });
    it('should return an empty array for getImmediateChildren', function() {
      expect(view._getImmediateChildren())
        .to.be.instanceof(Array)
        .and.to.have.length(0);
    });

    describe('without regions', function() {
      let layoutView;

      beforeEach(function() {
        layoutView = new View({
          template: _.noop
        });
      });
      it('should return an empty array for getImmediateChildren', function() {
        expect(layoutView._getImmediateChildren())
          .to.be.instanceof(Array)
          .and.to.have.length(0);
      });
    });

    describe('when there are empty regions', function() {
      let layoutView;

      beforeEach(function() {
        layoutView = new View({
          template: _.template('<main></main><footer></footer>'),
          regions: {
            main: '.main',
            footer: '.footer'
          }
        });
        layoutView.render();
      });
      it('should return an empty array for getImmediateChildren', function() {
        expect(layoutView._getImmediateChildren())
          .to.be.instanceof(Array)
          .and.to.have.length(0);
      });
    });

    describe('when there are non-empty regions', function() {
      let layoutView;
      let childOne;
      let childTwo;

      beforeEach(function() {
        layoutView = new View({
          template: _.template('<main></main><footer></footer>'),
          regions: {
            main: 'main',
            footer: 'footer'
          }
        });
        layoutView.render();
        childOne = new BaseView();
        childTwo = new BaseView();
        layoutView.getRegion('main').show(childOne);
        layoutView.getRegion('footer').show(childTwo);
      });
      it('should return an empty array for getImmediateChildren', function() {
        expect(layoutView._getImmediateChildren())
          .to.be.instanceof(Array)
          .and.to.have.length(2)
          .and.to.contain(childOne)
          .and.to.contain(childTwo);
      });
    });
  });
});
