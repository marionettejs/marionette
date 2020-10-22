import _ from 'underscore';
import Backbone from 'backbone';
import Events from '../../src/mixins/events';
import Region from '../../src/region';
import View from '../../src/view';
import CollectionView from '../../src/collection-view';

describe('region', function() {
  'use strict';

  describe('when creating a new region and no configuration has been provided', function() {
    it('should throw an exception saying an "el" is required', function() {
      expect(function() {
        return new Region();
      }).to.throw('An "el" must be specified for a region.');
    });
  });

  describe('when passing an el DOM reference in directly', function() {
    let el;
    let customRegion;
    let optionRegion;
    let optionRegionJquery;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div>');
      el = $('#region')[0];

      customRegion = new (Region.extend({
        el: el
      }))();

      optionRegion = new Region({el: el});

      optionRegionJquery = new Region({el: $(el)});
    });

    it('should not have been replaced', function() {
      expect(customRegion.isReplaced()).to.be.false;
    });

    it('should work when el is passed in as an option', function() {
      expect(optionRegionJquery.$el[0]).to.equal(el);
      expect(optionRegionJquery.el).to.equal(el);
    });

    it('should handle when the el option is passed in as a jquery selector', function() {
      expect(optionRegion.$el[0]).to.equal(el);
    });

    it('should work when el is set in the region extend', function() {
      expect(customRegion.$el[0]).to.equal(el);
    });

    it('should not have a view', function() {
      expect(customRegion.hasView()).to.equal(false);
      expect(optionRegion.hasView()).to.equal(false);
    });

    it('should complain if the el passed in as an option is invalid', function() {
      expect(function() {
        Region({el: $('the-ghost-of-lechuck')[0]});
      }).to.throw;
    });

    it('should complain if the el passed in via an extended region is invalid', function() {
      expect(function() {
        (Region.extend({el: $('the-ghost-of-lechuck')[0]}))();
      }).to.throw;
    });

    it('should not be swapping view', function() {
      expect(customRegion.isSwappingView()).to.be.false;
    });
  });

  describe('when creating a new region and the "el" does not exist in DOM', function() {
    let MyRegion;
    let MyView;
    let myView;

    beforeEach(function() {
      MyRegion = Region.extend({
        el: '#not-existed-region'
      });

      MyView = Backbone.View.extend({
        render: function() {
          $(this.el).html('some content');
        }
      });
      myView = new MyView();

      this.setFixtures('<div id="region"></div>');
    });

    describe('when showing a view', function() {
      describe('when allowMissingEl is not set', function() {
        let region;

        beforeEach(function() {
          region = new MyRegion();
        });

        it('should throw an exception saying an "el" doesnt exist in DOM', function() {
          expect(function() {
            region.show(new MyView());
          }.bind(this)).to.throw('An "el" must exist in DOM for this region ' + region.cid);
        });

        it('should not have a view', function() {
          expect(region.hasView()).to.be.false;
        });
      });

      describe('when allowMissingEl is set', function() {
        let region;

        beforeEach(function() {
          region = new MyRegion({allowMissingEl: true});
        });

        it('should not throw an exception', function() {
          expect(function() {
            region.show(new MyView());
          }.bind(this)).not.to.throw();
        });

        it('should not have a view', function() {
          expect(region.hasView()).to.be.false;
        });

        it('should not render the view', function() {
          this.sinon.spy(myView, 'render');
          region.show(myView);
          expect(myView.render).not.to.have.been.called;
        });
      });
    });
  });

  // NOTE: Currently an internal API with potential for public release
  describe('when setting the region element', function() {
    let TestView;
    let region;
    let oneEl;
    let twoEl;

    beforeEach(function() {
      TestView = View.extend({ id: 'view', template: _.template('foo') });
      this.setFixtures('<div id="region1"></div><div id="region2"></div>');
      oneEl = $('#region1')[0];
      twoEl = $('#region2')[0];

      region = new Region({ el: oneEl });
    });

    it('should return the region', function() {
      expect(region._setElement(twoEl)).to.equal(region);
    });

    it('should set the el', function() {
      region.show(new TestView());
      region._setElement(twoEl);
      expect(region.el).to.equal(twoEl);
    });

    it('should set the $el', function() {
      region.show(new TestView());
      region._setElement(twoEl);
      expect(region.$el[0]).to.equal($(twoEl)[0]);
    });

    it('should throw an error if the `el` is not specified', function() {
      expect(region._setElement.bind(region)).to.throw();
    });

    describe('when setting the `el` to the same element', function() {
      it('should not requery the el', function() {
        this.sinon.spy(region, 'getEl');
        expect(region._setElement(oneEl)).to.equal(region);
        expect(region.getEl).to.not.be.called;
      });
    });

    describe('when there is a replaceElement:true view', function() {
      it('should replace the el of the region with the view el', function() {
        const view = new TestView();
        region.show(view, { replaceElement: true });
        region._setElement(twoEl);
        expect($('#region1')).to.be.lengthOf(1);
        expect($('#view')).to.be.lengthOf(1);
        expect($('#region2')).to.be.lengthOf(0);
      });
    });

    describe('when there is a replaceElement:false view', function() {
      it('should attach the view html to the region', function() {
        const view = new TestView();
        region.show(view, { replaceElement: false });
        region._setElement(twoEl);
        expect($('#region1')).to.be.lengthOf(1);
        expect($('#region1 #view')).to.be.lengthOf(0);
        expect($('#region2 #view')).to.be.lengthOf(1);
      });
    });
  });

  describe('when showing a template', function() {
    let myRegion;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div>');
      myRegion = new Region({
        el: '#region'
      });

      myRegion.show(_.template('<b>Hello World!</b>'));
    });

    it('should render the template in the region', function() {
      expect(myRegion.$el).to.contain.$html('<b>Hello World!</b>');
    });
  });

  describe('when showing a template with viewOptions', function() {
    let myRegion;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div>');
      myRegion = new Region({
        el: '#region'
      });

      myRegion.show({
        template: _.template('<b>Hello <%- who %>!</b>'),
        model: new Backbone.Model({ who: 'World' })
      });
    });

    it('should render the template in the region', function() {
      expect(myRegion.$el).to.contain.$html('<b>Hello World!</b>');
    });
  });

  describe('when showing an html string', function() {
    let myRegion;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div>');
      myRegion = new Region({
        el: '#region'
      });

      myRegion.show('<b>Hello World!</b>');
    });

    it('should render the string in the region', function() {
      expect(myRegion.$el).to.contain.$html('<b>Hello World!</b>');
    });
  });

  describe('when showing an initial view', function() {
    let MyView;
    let showOptions;
    let isSwappingOnShow;
    let view;
    let region;

    beforeEach(function() {
      const sinon = this.sinon;

      const MyRegion = Region.extend({
        el: '#region',
        onBeforeShow: sinon.stub(),
        onShow: sinon.spy(function() {
          isSwappingOnShow = this.isSwappingView();
        }),
        onBeforeEmpty: sinon.stub(),
        onEmpty: sinon.stub(),
      });

      MyView = Backbone.View.extend({
        events: {
          'click': 'onClick'
        },
        render: function() {
          $(this.el).html('some content');
        },
        destroy: function() {},
        onBeforeRender: function() {},
        onRender: sinon.stub(),
        onBeforeAttach: sinon.stub(),
        onAttach: sinon.stub(),
        onDomRefresh: sinon.stub(),
        onClick: sinon.stub()
      });

      _.extend(MyView.prototype, Events);

      sinon.stub(MyView.prototype, 'onBeforeRender').callsFake(() => { return region.currentView; });

      this.setFixtures('<div id="region"></div>');
      view = new MyView();
      region = new MyRegion();

      sinon.spy(region, 'show');

      showOptions = {foo: 'bar'};
      region.show(view, showOptions);
    });

    it('should have a cidPrefix', function() {
      expect(region.cidPrefix).to.equal('mnr');
    });

    it('should have a cid', function() {
      expect(region.cid).to.exist;
    });

    it('should render the view', function() {
      expect(view.onRender).to.have.been.called;
    });

    it('should have a view', function() {
      expect(region.hasView()).to.equal(true);
    });

    it('should set $el and el', function() {
      expect(region.$el[0]).to.equal(region.el);
    });

    it('should append the rendered HTML to the managers "el"', function() {
      expect(region.$el).to.contain.$html(view.$el.html());
    });

    it('should pass the proper arguments to the region "onShow"', function() {
      expect(region.onShow).to.have.been.calledWith(region, view, showOptions);
    });

    it('should pass the proper arguments to the region "onBeforeShow"', function() {
      expect(region.onBeforeShow).to.have.been.calledWith(region, view, showOptions);
    });

    it('should not be swapping view', function() {
      expect(isSwappingOnShow).to.be.false;
    });

    it('should have the currentView set before rendering', function() {
      expect(view.onBeforeRender).to.have.returned(view);
    });

    describe('region and view event ordering', function() {
      it('triggers before:show before before:render', function() {
        expect(region.onBeforeShow).to.have.been.calledBefore(view.onBeforeRender);
        expect(view.onBeforeRender).to.have.been.calledBefore(view.onRender);
        expect(view.onRender).to.have.been.calledBefore(view.onBeforeAttach);
        expect(view.onBeforeAttach).to.have.been.calledBefore(view.onAttach);
        expect(view.onAttach).to.have.been.calledBefore(view.onDomRefresh);
        expect(view.onDomRefresh).to.have.been.calledBefore(region.onShow);
        expect(region.onShow).to.have.been.called;
      });
    });

    it('should return the region', function() {
      expect(region.show).to.have.returned(region);
    });

    describe('and then showing a different view', function() {
      let view2;
      let otherOptions;

      beforeEach(function() {
        view = region.currentView;

        region.onEmpty.reset();
        region.onBeforeEmpty.reset();

        view2 = new MyView();
        otherOptions = {
          bar: 'foo'
        };
        region.show(view2, otherOptions);
      });

      it('should trigger empty once', function() {
        expect(region.onEmpty).to.have.been.calledOnce;
        expect(region.onBeforeEmpty).to.have.been.calledOnce;
      });

      it('should still have a view', function() {
        expect(region.hasView()).to.equal(true);
      });

      it('should be swapping view', function() {
        expect(isSwappingOnShow).to.be.true;
      });
    });

    describe('when setting the "replaceElement" class option', function() {
      let regionHtml;
      let $parentEl;

      beforeEach(function() {
        this.sinon.spy(region, '_restoreEl');
        // empty region to clean existing view
        region.empty();
        $parentEl = region.$el.parent();
        regionHtml = $parentEl.html();
        region.replaceElement = true;
        region.show(view);
      });

      it('should append the view HTML to the parent "el"', function() {
        expect($parentEl).to.contain.$html(view.$el.html());
      });

      it('should remove the region\'s "el" from the DOM', function() {
        expect($parentEl).to.not.contain.$html(regionHtml);
      });

      it('should call _restoreEl', function() {
        expect(region._restoreEl).to.have.been.called;
      });

      it('should not restore if the "currentView" has been deleted from the region', function() {
        delete region.currentView;
        region._restoreEl();
        expect(region.currentView).to.be.undefined;
      });

      it('should not restore if the "currentView.el" has been remove from the DOM', function() {
        view.remove();
        region._restoreEl();
        expect(region.currentView.el.parentNode).is.null;
      });

      describe('and then emptying the region', function() {
        beforeEach(function() {
          region.empty();
        });

        it('should remove the view from the parent', function() {
          expect($parentEl).to.not.contain.$html(view.$el.html());
        });

        it('should restore the region\'s "el" to the DOM', function() {
          expect($parentEl).to.contain.$html('<div id="region"></div>');
        });
      });

      describe('and the view is detaching from region', function() {
        beforeEach(function() {
          region.detachView();
        });

        it('should remove the view from the parent', function() {
          expect($parentEl).to.not.contain.$html(view.$el.html());
        });

        it('should restore the region\'s "el" to the DOM', function() {
          expect($parentEl).to.contain.$html('<div id="region"></div>');
        });

        it('should call _restoreEl', function() {
          expect(region._restoreEl).to.have.been.called;
        });
      });

      describe('and showing another view', function() {
        let MyView2;
        let view2;

        beforeEach(function() {
          MyView2 = View.extend({
            template: _.template('some different content'),
            onAttach: this.sinon.stub()
          });

          view2 = new MyView2();
          region.show(view2, { replaceElement: true });
        });

        it('should append the view HTML to the parent "el"', function() {
          expect($parentEl).to.contain.$html(view2.$el.html());
        });

        it('should trigger attach events', function() {
          expect(view2.onAttach).to.be.calledOnce;
        });
      });
    });

    describe('and the view is detached', function() {
      let viewDestroyStub;
      let viewDetachStub;
      let regionEmptyStub;
      let detachedView;
      let noDetachedView;

      beforeEach(function() {
        viewDestroyStub = this.sinon.stub();
        view.on('destroy', viewDestroyStub);

        viewDetachStub = this.sinon.stub();
        view.on('detach', viewDetachStub);

        regionEmptyStub = this.sinon.stub();
        region.on('empty', regionEmptyStub);

        this.sinon.spy(region, 'removeView');

        detachedView = region.detachView();
        noDetachedView = region.detachView();
      });

      it('should return the childView it was given', function() {
        expect(detachedView).to.equal(view);
      });

      it('should not return a childView if it was already detached', function() {
        expect(noDetachedView).to.be.undefined;
      });

      it('should have _isDestroyed set to falsy', function() {
        expect(detachedView._isDestroyed).to.not.be.ok;
      });

      it('should not have triggered destroy on the view', function() {
        expect(viewDestroyStub).to.not.been.called;
      });

      it('should have triggered detach on the view', function() {
        expect(viewDetachStub).to.been.called;
      });

      it('should have triggered empty on the region', function() {
        expect(regionEmptyStub).to.been.called;
      });

      it('should not have a parent', function() {
        expect(detachedView).to.not.have.property('_parent');
      });

      it('should not call removeView', function() {
        expect(region.removeView).not.to.have.been.called;
      });

    });
  });

  describe('when showing an attached view', function() {
    let testView;
    let region;
    let anotherRegion;
    let collectionView;

    beforeEach(function() {
      this.setFixtures('<div id="reg1"></div><div id="reg2"></div><div id="cv"></div><div id="view">content</div>')
      region = new Region({ el: '#reg1' });
      anotherRegion = new Region({ el: '#reg2' });
      collectionView = new CollectionView({ el: '#cv' });
      testView = new View({ el: '#view' });
    });

    it('should throw an error if view is attached in another region', function() {
      anotherRegion.show(testView);
      expect(region.show.bind(region, testView)).to.throw();
    });

    it('should throw an error if view is attached in a collection view', function() {
      collectionView
        .render()
        .addChildView(testView);
      expect(region.show.bind(region, testView)).to.throw();
    });

  });

  describe('when showing detached view', function() {
    let collectionView;
    let anotherRegion;
    let region;
    let view;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div><div id="another-region"></div>');
      collectionView = new CollectionView();
      region = new Region({ el: '#region' });
      anotherRegion = new Region({ el: '#another-region' });
      view = new View({ template: _.noop });
    });

    it('should not throw an error if a view was detached from CollectionView',function() {
      collectionView.addChildView(view);
      collectionView.detachChildView(view);
      expect(region.show.bind(region, view)).to.not.throw();
    });

    it('should not throw an error if a view was detached from Region',function() {
      anotherRegion.show(view);
      anotherRegion.detachView(view);
      expect(region.show.bind(region, view)).to.not.throw();
    });
  });

  describe('when showing nested views', function() {
    let MyRegion;
    let MyView;
    let SubView;
    let innerRegionRenderSpy;
    let region;
    let attachHtmlSpy;

    beforeEach(function() {
      const sinon = this.sinon;

      MyRegion = Region.extend({
        el: '#region'
      });

      MyView = View.extend({
        regions: {
          subRegion: '.sub-region'
        },

        template: function() {
          return '<div class="sub-region"></div><div>some content</div>';
        },

        onRender: function() {
          this.getRegion('subRegion').show(new SubView());
        }
      });

      SubView = Backbone.View.extend({
        render: function() {
          $(this.el).html('some content');
        },

        initialize: function() {
          innerRegionRenderSpy = sinon.stub();
          this.on('render', innerRegionRenderSpy);
        }
      });

      _.extend(SubView.prototype, Events);

      this.setFixtures('<div id="region"></div>');
      region = new MyRegion();
      attachHtmlSpy = sinon.spy(region, 'attachHtml');
      region.show(new MyView());
    });

    it('should call inner region render before attaching to DOM', function() {
      expect(innerRegionRenderSpy).to.have.been.calledBefore(attachHtmlSpy);
    });
  });

  describe('when a view is already attached and shown in a region', function() {
    let myRegion;

    beforeEach(function() {
      this.setFixtures('<div id="region"><div id="view">Foo</div></div>');
      myRegion = new Region({
        el: '#region'
      });
      this.sinon.spy(myRegion, 'empty');

      myRegion.show(new View({ el: '#view' }));
    });

    it('should not empty the region', function() {
      expect(myRegion.empty).to.not.have.been.called;
    });
  });

  describe('when a view is already shown and showing another', function() {
    let MyRegion;
    let MyView;
    let view1;
    let view2;
    let region;

    beforeEach(function() {
      MyRegion = Region.extend({
        el: '#region'
      });

      MyView = Backbone.View.extend({
        render: function() {
          $(this.el).html('some content');
        },

        destroy: function() {}
      });

      _.extend(MyView.prototype, Events);

      this.setFixtures('<div id="region"></div><div id="pre-rendered">content</div>');

      view1 = new MyView();
      view2 = new MyView();
      region = new MyRegion();

      this.sinon.spy(view1, 'destroy');

      region.show(view1);
      region.show(view2);
    });

    it('should call "destroy" on the already open view', function() {
      expect(view1.destroy).to.have.been.called;
    });

    it('should call "empty" even if a new view is attached to the DOM', function() {

      this.sinon.spy(region, 'empty');
      const preRenderedView = new View({ el: '#pre-rendered' });

      region.show(preRenderedView);
      expect(region.empty).to.have.been.called;
    });

    it('should reference the new view as the current view', function() {
      expect(region.currentView).to.equal(view2);
    });

  });

  describe('when a view is already shown and showing the same one', function() {
    let MyRegion;
    let MyView;
    let view;
    let region;

    beforeEach(function() {
      MyRegion = Region.extend({
        el: '#region'
      });

      MyView = Backbone.View.extend({
        render: function() {
          $(this.el).html('some content');
        },
        destroy: function() {},
        attachHtml: function() {}
      });

      _.extend(MyView.prototype, Events);

      this.setFixtures('<div id="region"></div>');

      view = new MyView();
      region = new MyRegion();
      region.show(view);

      this.sinon.spy(view, 'destroy');
      this.sinon.spy(region, 'attachHtml');
      this.sinon.spy(view, 'render');
      region.show(view);
    });

    it('should not call "destroy" on the view', function() {
      expect(view.destroy).not.to.have.been.called;
    });

    it('should not call "attachHtml" on the view', function() {
      expect(region.attachHtml).not.to.have.been.calledWith(view);
    });

    it('should not call "render" on the view', function() {
      expect(view.render).not.to.have.been.called;
    });

  });

  describe('when a Mn view is already shown but destroyed externally', function() {
    let MyRegion;
    let MyView;
    let view;
    let region;


    beforeEach(function() {
      MyRegion = Region.extend({
        el: '#region'
      });

      MyView = View.extend({
        template: _.template('<div></div>'),
        open: function() {}
      });

      this.setFixtures('<div id="region"></div>');

      view = new MyView();
      region = new MyRegion();
      region.show(view);
      view.destroy();

      this.sinon.spy(view, 'destroy');
      this.sinon.spy(region, 'attachHtml');
      this.sinon.spy(view, 'render');
    });

    it('should not throw an error saying the views been destroyed if a destroyed view is passed in', function() {
      expect(function() {
        region.show(view);
      }).not.to.throw(new RegExp('View (cid: "' + view.cid +
          '") has already been destroyed and cannot be used.'));
    });

    describe('and destroyView is called', function() {
      beforeEach(function() {
        region.destroyView(view);
      });

      it('should not call view.destroy', function() {
        expect(view.destroy).to.have.not.been.called;
      })
    })

  });

  describe('when a view is already destroyed and showing another', function() {
    let MyRegion;
    let MyView;
    let view1;
    let view2;
    let region;

    beforeEach(function() {
      MyRegion = Region.extend({
        el: '#region'
      });

      MyView = View.extend({
        render: function() {
          $(this.el).html('some content');
        }
      });

      this.setFixtures('<div id="region"></div>');

      view1 = new MyView();
      view2 = new MyView();
      region = new MyRegion();

      this.sinon.spy(view1, 'destroy');
    });

    it('shouldnt call "destroy" on an already destroyed view', function() {
      region.show(view1);
      view1.destroy();
      region.show(view2);

      expect(view1.destroy.callCount).to.equal(1);
    });
  });

  describe('when calling empty', function() {
    let MyRegion;
    let MyView;
    let view;
    let region;

    beforeEach(function() {
      MyRegion = Region.extend({
        el: '#region'
      });

      this.setFixtures('<div id="region"></div>');
      MyView = Backbone.View.extend({
        render: function() {
          $(this.el).html('some content');
        },

        destroy: function() {}
      });

      _.extend(MyView.prototype, Events);

      region = new MyRegion();
      view = new MyView();
      this.sinon.spy(view, 'destroy');
      region.show(view);
    });

    describe('without arguments', function() {
      beforeEach(function() {
        region.empty();
      });
      it('should destroy view', function() {
        expect(view.destroy).to.have.been.called;
      });
    });
  });

  describe('when destroying the current view', function() {
    let MyRegion;
    let MyView;
    let view;
    let region;
    let isSwappingOnEmpty;

    beforeEach(function() {
      const sinon = this.sinon;

      MyRegion = Region.extend({
        el: '#region',
        onBeforeEmpty: sinon.stub(),
        onEmpty: sinon.spy(function() {
          isSwappingOnEmpty = this.isSwappingView();
        })
      });

      MyView = Backbone.View.extend({
        render: function() {
          $(this.el).html('some content');
        },

        destroy: function() {}
      });

      _.extend(MyView.prototype, Events);

      this.setFixtures('<div id="region"></div>');

      view = new MyView();
      sinon.spy(view, 'destroy');
      sinon.spy(view, '_removeElement');

      region = new MyRegion();
      sinon.spy(region, 'empty');
      region.show(view);
      region.empty();
    });

    it('should trigger a "before:empty" event with the view thats being destroyed', function() {
      expect(region.onBeforeEmpty)
        .to.have.been.calledOnce
        .and.to.have.been.calledWith(region, view)
        .and.to.have.been.calledOn(region);
    });

    it('should trigger a empty event', function() {
      expect(region.onEmpty)
        .to.have.been.calledOnce
        .and.to.have.been.calledWith(region, view)
        .and.to.have.been.calledOn(region);
    });

    it('should call "destroy" on the already show view', function() {
      expect(view.destroy).to.have.been.called;
    });

    it('should not call "_removeElement" directly, on the view', function() {
      expect(view._removeElement).not.to.have.been.called;
    });

    it('should delete the current view reference', function() {
      expect(region.currentView).to.be.undefined;
    });

    it('should return the region', function() {
      expect(region.empty).to.have.returned(region);
    });

    it('should return the region even when there was not a view to destroy', function() {
      // The first empty() should have removed the view, this empty() call would be when there isn't a view
      region.empty();
      expect(region.empty.thirdCall).to.have.returned(region);
    });

    it('should not have a view', function() {
      expect(region.hasView()).to.equal(false);
    });

    it('should not be swapping view', function() {
      expect(isSwappingOnEmpty).to.be.false;
    });
  });

  describe('when destroying the current view and it does not have a "destroy" method', function() {
    let MyRegion;
    let MyView;
    let view;
    let region;

    beforeEach(function() {
      MyRegion = Region.extend({
        el: '<div></div>'
      });

      MyView = Backbone.View.extend({
        render: function() {
          $(this.el).html('some content');
        }
      });
      _.extend(MyView.prototype, Events);

      view = new MyView();
      this.sinon.spy(view, '_removeElement');
      region = new MyRegion();
      region.show(view);
      region.empty();
    });

    it('should call "_removeElement" on the view', function() {
      expect(view._removeElement).to.have.been.called;
    });

    it('should set "_isDestroyed" on the view', function() {
      expect(view._isDestroyed).to.be.true;
    });

    describe('and then attempting to show the view again in the Region', function() {
      let showFunction;

      beforeEach(function() {
        showFunction = function() {
          region.show(view);
        };
      });

      it('should throw an error.', function() {
        const errorMessage = 'View (cid: "' + view.cid + '") has already been destroyed and cannot be used.';
        expect(showFunction).to.throw(errorMessage);
      });
    });
  });

  describe('when initializing a region and passing an "el" option', function() {
    let el;
    let region;

    beforeEach(function() {
      el = '#foo';
      region = new Region({
        el: el
      });
    });

    it('should manage the specified el', function() {
      expect(region.el).to.equal(el);
    });
  });

  describe('when creating a region instance with an initialize method', function() {
    let expectedOptions;
    let MyRegion;

    beforeEach(function() {
      expectedOptions = {foo: 'bar'};
      MyRegion = Region.extend({
        el: '#foo',
        initialize: function() {}
      });

      this.sinon.spy(MyRegion.prototype, 'initialize');

      new MyRegion(expectedOptions);
    });

    it('should call the initialize method with the options from the constructor', function() {
      expect(MyRegion.prototype.initialize).to.have.been.calledWith(expectedOptions);
    });
  });

  describe('when removing a region', function() {
    let itemView;
    let region;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div><div id="region2"></div>');

      itemView = new View();
      itemView.template = function() {
        return 'content';
      };
      itemView.addRegions({
        MyRegion: '#region',
        anotherRegion: '#region2'
      });

      region = itemView.getRegion('MyRegion');
      this.sinon.spy(region, 'empty');

      itemView.removeRegion('MyRegion');
    });

    it('should be removed from the view', function() {
      expect(itemView.getRegion('MyRegion')).to.be.undefined;
    });

    it('should call "empty" of the region', function() {
      expect(region.empty).to.have.been.called;
    });
  });

  describe('when getting a region', function() {
    let itemView;
    let region;

    beforeEach(function() {
      itemView = new View();
      itemView.render = this.sinon.stub();
      itemView.addRegions({
        MyRegion: '#region',
        anotherRegion: '#region2'
      });

      region = itemView._regions.MyRegion;
    });

    it('should return the region', function() {
      expect(itemView.getRegion('MyRegion')).to.equal(region);
    });

    it('should call render if getRegion is called without being rendered', function() {
      itemView.getRegion('whoCares');
      expect(itemView.render).to.be.calledOnce;
    });
  });

  describe('when resetting a region', function() {
    let region;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div>');

      region = new Region({
        el: '#region'
      });

      this.sinon.spy(region, 'empty');

      region.show(new View({ template: false }));

      this.sinon.spy(region, 'reset');
      region.reset();
    });

    it('should not hold on to the regions previous "el"', function() {
      expect(region.$el).not.to.exist;
    });

    it('should empty any existing view', function() {
      expect(region.empty).to.have.been.called;
    });

    it('should return the region', function() {
      expect(region.reset).to.have.returned(region);
    });
  });

  describe('when destroying a region', function() {
    let region;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div>');

      region = new Region({
        el: '#region'
      });

      this.sinon.spy(region, 'reset');

      this.sinon.spy(region, 'destroy');
      region.destroy();
    });

    it('should reset the region', function() {
      expect(region.reset).to.have.been.called;
    });

    it('should return the region', function() {
      expect(region.destroy).to.have.returned(region);
    });

    describe('when the region is already destroyed', function() {
      it('should not reset the region', function() {
        region.reset.resetHistory();
        region.destroy();
        expect(region.reset).to.not.have.been.called;
      });

      it('should return the region', function() {
        region.destroy.resetHistory();
        region.destroy();
        expect(region.destroy).to.have.returned(region);
      });
    });
  });

  describe('when destroying a Mn view in a region', function() {
    let beforeEmptySpy;
    let emptySpy;
    let onBeforeDestroy;
    let onDestroy;
    let MyView;
    let region;
    let view;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div>');
      beforeEmptySpy = new sinon.spy();
      emptySpy = new sinon.spy();
      onBeforeDestroy = this.sinon.stub();
      onDestroy = this.sinon.stub();

      region = new Region({
        el: '#region'
      });

      region.on('before:empty', beforeEmptySpy);
      region.on('empty', emptySpy);

      MyView = View.extend({
        template: _.template('')
      });

      view = new MyView();

      view.on('before:destroy', onBeforeDestroy);
      view.on('destroy', onDestroy);

      region.show(view);
      region.currentView.destroy();
    });

    it('should remove the view from the region after being destroyed', function() {
      expect(beforeEmptySpy).to.have.been.calledOnce.and.calledWith(region, view);
      expect(emptySpy).to.have.been.calledOnce.calledWith(region, view);
      expect(region.currentView).to.be.undefined;
    });

    it('view "before:destroy" event is triggered once', function() {
      expect(onBeforeDestroy).to.have.been.calledOnce;
    });

    it('view "destroy" event is triggered once', function() {
      expect(onDestroy).to.have.been.calledOnce;
    });
  });

  describe('when showing undefined in a region', function() {
    let insertUndefined;
    let region;

    beforeEach(function() {
      this.setFixtures('<div id="region"></div>');

      region = new Region({
        el: '#region'
      });

      insertUndefined = function() {
        region.show(undefined);
      }.bind(this);
    });

    it('should throw an error', function() {
      const errorMessage = 'The view passed is undefined and therefore invalid. You must pass a view instance to show.';
      expect(insertUndefined).to.throw(errorMessage);
    });
  });

  describe('when showing a Backbone.View child view', function() {
    let BbView;
    let region;
    let view;

    beforeEach(function() {
      BbView = Backbone.View.extend({
        onBeforeRender: this.sinon.stub(),
        onRender: this.sinon.stub(),
        onBeforeDestroy: this.sinon.stub(),
        onDestroy: this.sinon.stub()
      });
      _.extend(BbView.prototype, Events);

      region = new Region({
        el: $('<div></div>')
      });
      view = new BbView();
      region.show(view);
    });

    it('should fire before:render and render on the child view on show', function() {
      expect(view.onBeforeRender)
        .to.have.been.calledOnce
        .and.to.have.been.calledOn(view)
        .and.to.have.been.calledWith(view);
      expect(view.onRender)
        .to.have.been.calledOnce
        .and.to.have.been.calledOn(view)
        .and.to.have.been.calledWith(view);
    });

    describe('when emptying while containing the Backbone.View', function() {
      beforeEach(function() {
        region.empty();
      });

      it('should fire before:destroy and destroy on the child view on show', function() {
        expect(view.onBeforeDestroy)
          .to.have.been.calledOnce
          .and.to.have.been.calledOn(view)
          .and.to.have.been.calledWith(view);
        expect(view.onDestroy)
          .to.have.been.calledOnce
          .and.to.have.been.calledOn(view)
          .and.to.have.been.calledWith(view);
      });
    });
  });

  describe('when calling "_ensureElement"', function() {
    let region;

    beforeEach(function() {
      region = new Region({
        el: '#region'
      });
    });

    it('should prefer passed options over initial options', function() {
      region.allowMissingEl = false;

      expect(region._ensureElement({allowMissingEl: true})).to.be.false;
    });

    it('should fallback to initial options when not passed options', function() {
      region.allowMissingEl = false;

      expect(function() {
        region._ensureElement();
      }.bind(this)).to.throw;
    });
  });

  // This is a terrible example of an edge-case where something related to the view's destroy
  // may also want to empty the same region.
  describe('when emptying a region destroys a view that empties the same region', function() {
    let MyRegion;
    let region;
    let MyView;

    it('should only empty once', function() {
      this.setFixtures('<div id="region"></div>');

      MyRegion = Region.extend({
        el: '#region',
        onEmpty: this.sinon.stub(),
      });

      region = new MyRegion();
      MyView = View.extend({
        template: _.noop,
        onDestroy: function() {
          region.empty();
        }
      });
      region.show(new MyView());
      region.empty();

      expect(region.onEmpty).to.have.been.calledOnce;
    });
  });

  describe('when emptying a region with no view and preexisting html', function() {
    let MyRegion;
    let region;

    beforeEach(function() {
      MyRegion = Region.extend({
        el: '#region',
      });
    });

    it('should clear the region contents', function() {
      this.setFixtures('<div id="region">Preexisting HTML</div>');
      region = new MyRegion();
      region.empty();
      expect(region.$el.html()).to.eql('');
    });

    // In the future, hopefully allowMissingEl can default to true
    describe('when no el exists while passing allowMissingEl: false', function() {
      it('should throw an error', function() {
        region = new MyRegion();
        expect(function() {
          region.empty({ allowMissingEl: false });
        }).to.throw('An "el" must exist in DOM for this region ' + region.cid);
      });
    });
  });
});
