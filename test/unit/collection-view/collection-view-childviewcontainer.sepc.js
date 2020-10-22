import _ from 'underscore';
import Backbone from 'backbone';
import CollectionView from '../../../src/collection-view';
import View from '../../../src/view';

describe('CollectionView - childViewContainer', function() {
  let MyCollectionView;
  let ChildView;
  let template;
  let collection;

  beforeEach(function() {
    collection = new Backbone.Collection([{ foo: 'bar' }, { foo: 'baz' }]);

    template = _.template('<ul id="foo"></ul>bazinga');

    ChildView = View.extend({
      tagName: 'li',
      template: _.template('<%=foo%>')
    });

    MyCollectionView = CollectionView.extend({
      childView: ChildView
    });
  });

  describe('when childViewContainer is undefined', function() {
    it('should set the $container to the $el', function() {
      const myCollectionView = new MyCollectionView({ collection });
      myCollectionView.render();

      expect(myCollectionView.$container).to.equal(myCollectionView.$el);
    });
  });

  describe('when childViewContainer is defined', function() {
    describe('when a selector within the el', function() {
      it('should should put the children within the found $container', function() {
        const myCollectionView = new MyCollectionView({
          collection,
          template,
          childViewContainer: '#foo'
        });
        myCollectionView.render();

        expect(myCollectionView.$container).to.have.$text('barbaz');
      });
    });

    describe('when a selector not within the el', function() {
      it('should should throw an error', function() {
        const myCollectionView = new MyCollectionView({
          collection,
          template,
          childViewContainer: '#bar'
        });

        expect(myCollectionView.render.bind(myCollectionView))
          .to.throw('The specified "childViewContainer" was not found: #bar');
      });
    });

    describe('when a function', function() {
      it('should should put the children within the found $container', function() {
        const myCollectionView = new MyCollectionView({
          collection,
          template,
          childViewContainer: _.constant('#foo')
        });
        myCollectionView.render();

        expect(myCollectionView.$container).to.have.$text('barbaz');
      });
    });
  });
});
