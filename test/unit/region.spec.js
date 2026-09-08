import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import _ from 'underscore';
import $ from 'jquery';
import Events from '../../packages/utils/src/events.ts';
import Region from '../../src/modules/region';
import View from '../../src/modules/view';
import CollectionView from '../../src/modules/collection-view';

describe('region', function() {
  'use strict';

  describe('when creating a new region and no configuration has been provided', function() {
    it('allows construction without an el', function() {
      expect(function() {
        return new Region();
      }).to.not.throw();
    });
  });

  describe('when passing an el DOM reference in directly', function() {
    let el;
    let customRegion;
    let optionRegion;

    beforeEach(function() {
      setFixtures('<div id="region"></div>');
      el = $('#region')[0];

      customRegion = new (Region.extend({
        el: el
      }))();

      optionRegion = new Region({el: el});

    });

    it('should not have been replaced', function() {
      expect(customRegion.isReplaced()).to.be.false;
    });

    it('should work when el is passed in as an option', function() {
      expect(optionRegion.el).to.equal(el);
    });

    it('should work when el is set in the region extend', function() {
      expect(customRegion.el).to.equal(el);
    });

    it('should not have a view', function() {
      expect(customRegion.hasView()).to.equal(false);
      expect(optionRegion.hasView()).to.equal(false);
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

      MyView = View.extend({
        template: () => 'some content'
      });
      myView = new MyView();

      setFixtures('<div id="region"></div>');
    });

    describe('when showing a view', function() {
      describe('when allowMissingEl is not set', function() {
        let region;

        beforeEach(function() {
          region = new MyRegion();
        });

        it('should throw an exception saying an "el" doesnt exist in DOM', function(testContext) {
          expect(function() {
            region.show(new MyView());
          }.bind(testContext)).to.throw('An "el" must exist in DOM for this region ' + region.cid)
            .with.property('code', 'MN0005');
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

        it('should not throw an exception', function(testContext) {
          expect(function() {
            region.show(new MyView());
          }.bind(testContext)).not.to.throw();
        });

        it('should not have a view', function() {
          expect(region.hasView()).to.be.false;
        });

        it('should not render the view', function() {
          vi.spyOn(myView, 'render');
          region.show(myView);
          expect(myView.render).not.toHaveBeenCalled();
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
      setFixtures('<div id="region1"></div><div id="region2"></div>');
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

    it('should set the el', function() {
      region.show(new TestView());
      region._setElement(twoEl);
      expect(region.el).to.equal(twoEl);
    });

    it('should throw an error if the `el` is not specified', function() {
      expect(region._setElement.bind(region)).to.throw();
    });

    describe('when setting the `el` to the same element', function() {
      it('should not requery the el', function() {
        vi.spyOn(region, 'getEl');
        expect(region._setElement(oneEl)).to.equal(region);
        expect(region.getEl).not.toHaveBeenCalled();
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

  describe('when showing an initial view', function() {
    let MyView;
    let showOptions;
    let isSwappingOnShow;
    let view;
    let region;

    beforeEach(function() {

      const MyRegion = Region.extend({
        el: '#region',
        onBeforeShow: vi.fn(),
        onShow: vi.fn(function() {
          isSwappingOnShow = this.isSwappingView();
        }),
        onBeforeEmpty: vi.fn(),
        onEmpty: vi.fn(),
      });

      MyView = View.extend({
        events: {
          'click': 'onClick'
        },
        template: () => 'some content',
        destroy: function() {},
        onBeforeRender: function() {},
        onRender: vi.fn(),
        onBeforeAttach: vi.fn(),
        onAttach: vi.fn(),
        onDomRefresh: vi.fn(),
        onClick: vi.fn()
      });

      _.extend(MyView.prototype, Events);

      vi.spyOn(MyView.prototype, 'onBeforeRender').mockImplementation(() => undefined).mockImplementation(() => { return region.currentView; });

      setFixtures('<div id="region"></div>');
      view = new MyView();
      region = new MyRegion();

      vi.spyOn(region, 'show');

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
      expect(view.onRender).toHaveBeenCalled();
    });

    it('should have a view', function() {
      expect(region.hasView()).to.equal(true);
    });

    it('should set el', function() {
      expect(region.el).to.equal(document.getElementById('region'));
    });

    it('should append the rendered HTML to the managers "el"', function() {
      expect($(region.el).html()).toContain(view.el.innerHTML);
    });

    it('should pass the proper arguments to the region "onShow"', function() {
      expect(region.onShow.mock.calls.map(args => args.slice(0, 3))).toContainEqual([region, view, showOptions]);
    });

    it('should pass the proper arguments to the region "onBeforeShow"', function() {
      expect(region.onBeforeShow.mock.calls.map(args => args.slice(0, 3))).toContainEqual([region, view, showOptions]);
    });

    it('should not be swapping view', function() {
      expect(isSwappingOnShow).to.be.false;
    });

    it('should have the currentView set before rendering', function() {
      expect(view.onBeforeRender).toHaveReturnedWith(view);
    });

    describe('region and view event ordering', function() {
      it('triggers before:show before before:render', function() {
        expect(region.onBeforeShow).toHaveBeenCalledBefore(view.onBeforeRender);
        expect(view.onBeforeRender).toHaveBeenCalledBefore(view.onRender);
        expect(view.onRender).toHaveBeenCalledBefore(view.onBeforeAttach);
        expect(view.onBeforeAttach).toHaveBeenCalledBefore(view.onAttach);
        expect(view.onAttach).toHaveBeenCalledBefore(view.onDomRefresh);
        expect(view.onDomRefresh).toHaveBeenCalledBefore(region.onShow);
        expect(region.onShow).toHaveBeenCalled();
      });
    });

    it('should return the region', function() {
      expect(region.show).toHaveReturnedWith(region);
    });

    describe('and then showing a different view', function() {
      let view2;
      let otherOptions;

      beforeEach(function() {
        view = region.currentView;

        region.onEmpty.mockClear();
        region.onBeforeEmpty.mockClear();

        view2 = new MyView();
        otherOptions = {
          bar: 'foo'
        };
        region.show(view2, otherOptions);
      });

      it('should trigger empty once', function() {
        expect(region.onEmpty).toHaveBeenCalledTimes(1);
        expect(region.onBeforeEmpty).toHaveBeenCalledTimes(1);
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
        vi.spyOn(region, '_restoreEl');
        // empty region to clean existing view
        region.empty();
        $parentEl = $(region.el.parentNode);
        regionHtml = $parentEl.html();
        region.replaceElement = true;
        region.show(view);
      });

      it('should append the view HTML to the parent "el"', function() {
        expect($parentEl.html()).toContain(view.el.innerHTML);
      });

      it('should remove the region\'s "el" from the DOM', function() {
        expect($parentEl.html()).not.toContain(regionHtml);
      });

      it('should call _restoreEl', function() {
        expect(region._restoreEl).toHaveBeenCalled();
      });

      it('should not restore if the "currentView" has been deleted from the region', function() {
        delete region.currentView;
        region._restoreEl();
        expect(region.currentView).to.be.undefined;
      });

      it('should not restore if the "currentView.el" has been removed from the DOM', function() {
        view.el.remove();
        region._restoreEl();
        expect(region.currentView.el.parentNode).is.null;
      });

      describe('and then emptying the region', function() {
        beforeEach(function() {
          region.empty();
        });

        it('should remove the view from the parent', function() {
          expect($parentEl.html()).not.toContain(view.el.innerHTML);
        });

        it('should restore the region\'s "el" to the DOM', function() {
          expect($parentEl.html()).toContain('<div id="region"></div>');
        });
      });

      describe('and the view is detaching from region', function() {
        beforeEach(function() {
          region.detachView();
        });

        it('should remove the view from the parent', function() {
          expect($parentEl.html()).not.toContain(view.el.innerHTML);
        });

        it('should restore the region\'s "el" to the DOM', function() {
          expect($parentEl.html()).toContain('<div id="region"></div>');
        });

        it('should call _restoreEl', function() {
          expect(region._restoreEl).toHaveBeenCalled();
        });
      });

      describe('and showing another view', function() {
        let MyView2;
        let view2;

        beforeEach(function() {
          MyView2 = View.extend({
            template: _.template('some different content'),
            onAttach: vi.fn()
          });

          view2 = new MyView2();
          region.show(view2, { replaceElement: true });
        });

        it('should append the view HTML to the parent "el"', function() {
          expect($parentEl.html()).toContain(view2.el.innerHTML);
        });

        it('should trigger attach events', function() {
          expect(view2.onAttach).toHaveBeenCalledTimes(1);
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
        viewDestroyStub = vi.fn();
        view.on('destroy', viewDestroyStub);

        viewDetachStub = vi.fn();
        view.on('detach', viewDetachStub);

        regionEmptyStub = vi.fn();
        region.on('empty', regionEmptyStub);

        vi.spyOn(region, 'removeView');

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
        expect(viewDestroyStub).not.toHaveBeenCalled();
      });

      it('should have triggered detach on the view', function() {
        expect(viewDetachStub).toHaveBeenCalled();
      });

      it('should have triggered empty on the region', function() {
        expect(regionEmptyStub).toHaveBeenCalled();
      });

      it('should not have a parent', function() {
        expect(detachedView).to.not.have.property('_parent');
      });

      it('should not call removeView', function() {
        expect(region.removeView).not.toHaveBeenCalled();
      });

    });
  });

  describe('when showing an attached view', function() {
    let testView;
    let region;
    let anotherRegion;
    let collectionView;

    beforeEach(function() {
      setFixtures('<div id="reg1"></div><div id="reg2"></div><div id="cv"></div><div id="view">content</div>')
      region = new Region({ el: '#reg1' });
      anotherRegion = new Region({ el: '#reg2' });
      collectionView = new CollectionView({ el: document.getElementById('cv') });
      testView = new View({ el: document.getElementById('view') });
    });

    it('should throw an error if view is attached in another region', function() {
      anotherRegion.show(testView);
      expect(region.show.bind(region, testView)).to.throw().with.property('code', 'MN0003');
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
      setFixtures('<div id="region"></div><div id="another-region"></div>');
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

      SubView = View.extend({
        template: () => 'some content',

        initialize: function() {
          innerRegionRenderSpy = vi.fn();
          this.on('render', innerRegionRenderSpy);
        }
      });

      _.extend(SubView.prototype, Events);

      setFixtures('<div id="region"></div>');
      region = new MyRegion();
      attachHtmlSpy = vi.spyOn(region, 'attachHtml');
      region.show(new MyView());
    });

    it('should call inner region render before attaching to DOM', function() {
      expect(innerRegionRenderSpy).toHaveBeenCalledBefore(attachHtmlSpy);
    });
  });

  describe('when a view is already attached and shown in a region', function() {
    let myRegion;

    beforeEach(function() {
      setFixtures('<div id="region"><div id="view">Foo</div></div>');
      myRegion = new Region({
        el: '#region'
      });
      vi.spyOn(myRegion, 'empty');

      myRegion.show(new View({ el: document.getElementById('view') }));
    });

    it('should not empty the region', function() {
      expect(myRegion.empty).not.toHaveBeenCalled();
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

      MyView = View.extend({
        template: () => 'some content',

        destroy: function() {}
      });

      _.extend(MyView.prototype, Events);

      setFixtures('<div id="region"></div><div id="pre-rendered">content</div>');

      view1 = new MyView();
      view2 = new MyView();
      region = new MyRegion();

      vi.spyOn(view1, 'destroy');

      region.show(view1);
      region.show(view2);
    });

    it('should call "destroy" on the already open view', function() {
      expect(view1.destroy).toHaveBeenCalled();
    });

    it('should call "empty" even if a new view is attached to the DOM', function() {

      vi.spyOn(region, 'empty');
      const preRenderedView = new View({ el: document.getElementById('pre-rendered') });

      region.show(preRenderedView);
      expect(region.empty).toHaveBeenCalled();
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

      MyView = View.extend({
        template: () => 'some content',
        destroy: function() {},
        attachHtml: function() {}
      });

      _.extend(MyView.prototype, Events);

      setFixtures('<div id="region"></div>');

      view = new MyView();
      region = new MyRegion();
      region.show(view);

      vi.spyOn(view, 'destroy');
      vi.spyOn(region, 'attachHtml');
      vi.spyOn(view, 'render');
      region.show(view);
    });

    it('should not call "destroy" on the view', function() {
      expect(view.destroy).not.toHaveBeenCalled();
    });

    it('should not call "attachHtml" on the view', function() {
      expect(region.attachHtml.mock.calls.map(args => args.slice(0, 1))).not.toContainEqual([view]);
    });

    it('should not call "render" on the view', function() {
      expect(view.render).not.toHaveBeenCalled();
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

      setFixtures('<div id="region"></div>');

      view = new MyView();
      region = new MyRegion();
      region.show(view);
      view.destroy();

      vi.spyOn(view, 'destroy');
      vi.spyOn(region, 'attachHtml');
      vi.spyOn(view, 'render');
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
        expect(view.destroy).not.toHaveBeenCalled();
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
        template: () => 'some content'
      });

      setFixtures('<div id="region"></div>');

      view1 = new MyView();
      view2 = new MyView();
      region = new MyRegion();

      vi.spyOn(view1, 'destroy');
    });

    it('shouldnt call "destroy" on an already destroyed view', function() {
      region.show(view1);
      view1.destroy();
      region.show(view2);

      expect(view1.destroy.mock.calls.length).to.equal(1);
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

      setFixtures('<div id="region"></div>');
      MyView = View.extend({
        template: () => 'some content',

        destroy: function() {}
      });

      _.extend(MyView.prototype, Events);

      region = new MyRegion();
      view = new MyView();
      vi.spyOn(view, 'destroy');
      region.show(view);
    });

    describe('without arguments', function() {
      beforeEach(function() {
        region.empty();
      });
      it('should destroy view', function() {
        expect(view.destroy).toHaveBeenCalled();
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

      MyRegion = Region.extend({
        el: '#region',
        onBeforeEmpty: vi.fn(),
        onEmpty: vi.fn(function() {
          isSwappingOnEmpty = this.isSwappingView();
        })
      });

      MyView = View.extend({
        template: () => 'some content',

        destroy: function() {}
      });

      _.extend(MyView.prototype, Events);

      setFixtures('<div id="region"></div>');

      view = new MyView();
      vi.spyOn(view, 'destroy');

      region = new MyRegion();
      vi.spyOn(region, 'empty');
      region.show(view);
      region.empty();
    });

    it('should trigger a "before:empty" event with the view thats being destroyed', function() {
      expect(region.onBeforeEmpty).toHaveBeenCalledTimes(1);
      expect(region.onBeforeEmpty.mock.calls.map(args => args.slice(0, 2))).toContainEqual([region, view]);
      expect(region.onBeforeEmpty.mock.contexts).toContain(region);
    });

    it('should trigger a empty event', function() {
      expect(region.onEmpty).toHaveBeenCalledTimes(1);
      expect(region.onEmpty.mock.calls.map(args => args.slice(0, 2))).toContainEqual([region, view]);
      expect(region.onEmpty.mock.contexts).toContain(region);
    });

    it('should call "destroy" on the already show view', function() {
      expect(view.destroy).toHaveBeenCalled();
    });

    it('should delete the current view reference', function() {
      expect(region.currentView).to.be.undefined;
    });

    it('should return the region', function() {
      expect(region.empty).toHaveReturnedWith(region);
    });

    it('should return the region even when there was not a view to destroy', function() {
      // The first empty() should have removed the view, this empty() call would be when there isn't a view
      region.empty();
      expect(region.empty.mock.results[2].value).to.equal(region);
    });

    it('should not have a view', function() {
      expect(region.hasView()).to.equal(false);
    });

    it('should not be swapping view', function() {
      expect(isSwappingOnEmpty).to.be.false;
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

    it('defers selector resolution until the first DOM operation', function() {
      setFixtures('<div id="foo"></div>');
      const lifecycle = [];
      const DeferredRegion = Region.extend({
        getEl(selector) {
          lifecycle.push(['getEl', selector]);
          return Region.prototype.getEl.call(this, selector);
        },
        initialize() {
          lifecycle.push(['initialize', this.el]);
        }
      });

      const deferredRegion = new DeferredRegion({ el: '#foo' });

      expect(lifecycle).to.deep.equal([['initialize', '#foo']]);
      expect(deferredRegion.el).to.equal('#foo');
      expect(deferredRegion.empty()).to.equal(deferredRegion);
      expect(lifecycle).to.deep.equal([
        ['initialize', '#foo'],
        ['getEl', '#foo']
      ]);
      expect(deferredRegion.el).to.equal(document.getElementById('foo'));
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

      vi.spyOn(MyRegion.prototype, 'initialize');

      new MyRegion(expectedOptions);
    });

    it('should call the initialize method with the options from the constructor', function() {
      expect(MyRegion.prototype.initialize.mock.calls.map(args => args.slice(0, 1))).toContainEqual([expectedOptions]);
    });
  });

  describe('when removing a region', function() {
    let ownerView;
    let region;

    beforeEach(function() {
      setFixtures('<div id="region"></div><div id="region2"></div>');

      ownerView = new View();
      ownerView.template = function() {
        return 'content';
      };
      ownerView.addRegions({
        MyRegion: '#region',
        anotherRegion: '#region2'
      });

      region = ownerView.getRegion('MyRegion');
      vi.spyOn(region, 'empty');

      ownerView.removeRegion('MyRegion');
    });

    it('should be removed from the view', function() {
      expect(ownerView.getRegion('MyRegion')).to.be.undefined;
    });

    it('should call "empty" of the region', function() {
      expect(region.empty).toHaveBeenCalled();
    });
  });

  describe('when resetting a region', function() {
    let region;

    beforeEach(function() {
      setFixtures('<div id="region"></div>');

      region = new Region({
        el: '#region'
      });

      vi.spyOn(region, 'empty');

      region.show(new View({ template: false }));

      vi.spyOn(region, 'reset');
      region.reset();
    });

    it('should not hold on to the regions previous "el"', function() {
      expect(region.el).to.equal('#region');
    });

    it('should empty any existing view', function() {
      expect(region.empty).toHaveBeenCalled();
    });

    it('should return the region', function() {
      expect(region.reset).toHaveReturnedWith(region);
    });
  });

  describe('when destroying a region', function() {
    let region;

    beforeEach(function() {
      setFixtures('<div id="region"></div>');

      region = new Region({
        el: '#region'
      });

      vi.spyOn(region, 'reset');

      vi.spyOn(region, 'destroy');
      region.destroy();
    });

    it('should reset the region', function() {
      expect(region.reset).toHaveBeenCalled();
    });

    it('should return the region', function() {
      expect(region.destroy).toHaveReturnedWith(region);
    });

    describe('when the region is already destroyed', function() {
      it('should not reset the region', function() {
        region.reset.mockClear();
        region.destroy();
        expect(region.reset).not.toHaveBeenCalled();
      });

      it('should return the region', function() {
        region.destroy.mockClear();
        region.destroy();
        expect(region.destroy).toHaveReturnedWith(region);
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
      setFixtures('<div id="region"></div>');
      beforeEmptySpy = vi.fn();
      emptySpy = vi.fn();
      onBeforeDestroy = vi.fn();
      onDestroy = vi.fn();

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
      expect(beforeEmptySpy).toHaveBeenCalledTimes(1);
      expect(beforeEmptySpy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([region, view]);
      expect(emptySpy).toHaveBeenCalledTimes(1);
      expect(emptySpy.mock.calls.map(args => args.slice(0, 2))).toContainEqual([region, view]);
      expect(region.currentView).to.be.undefined;
    });

    it('view "before:destroy" event is triggered once', function() {
      expect(onBeforeDestroy).toHaveBeenCalledTimes(1);
    });

    it('view "destroy" event is triggered once', function() {
      expect(onDestroy).toHaveBeenCalledTimes(1);
    });
  });

  describe('when showing a Marionette View child view', function() {
    let OtherView;
    let region;
    let view;

    beforeEach(function() {
      OtherView = View.extend({
        template: () => '',
        onBeforeRender: vi.fn(),
        onRender: vi.fn(),
        onBeforeDestroy: vi.fn(),
        onDestroy: vi.fn()
      });
      _.extend(OtherView.prototype, Events);

      region = new Region({
        el: document.createElement('div')
      });
      view = new OtherView();
      region.show(view);
    });

    it('should fire before:render and render on the child view on show', function() {
      expect(view.onBeforeRender).toHaveBeenCalledTimes(1);
      expect(view.onBeforeRender.mock.contexts).toContain(view);
      expect(view.onBeforeRender.mock.calls.map(args => args.slice(0, 1))).toContainEqual([view]);
      expect(view.onRender).toHaveBeenCalledTimes(1);
      expect(view.onRender.mock.contexts).toContain(view);
      expect(view.onRender.mock.calls.map(args => args.slice(0, 1))).toContainEqual([view]);
    });

    describe('when emptying while containing the Marionette View', function() {
      beforeEach(function() {
        region.empty();
      });

      it('should fire before:destroy and destroy on the child view on show', function() {
        expect(view.onBeforeDestroy).toHaveBeenCalledTimes(1);
        expect(view.onBeforeDestroy.mock.contexts).toContain(view);
        expect(view.onBeforeDestroy.mock.calls.map(args => args.slice(0, 1))).toContainEqual([view]);
        expect(view.onDestroy).toHaveBeenCalledTimes(1);
        expect(view.onDestroy.mock.contexts).toContain(view);
        expect(view.onDestroy.mock.calls.map(args => args.slice(0, 1))).toContainEqual([view]);
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

    it('should fallback to initial options when not passed options', function(testContext) {
      region.allowMissingEl = false;

      expect(function() {
        region._ensureElement();
      }.bind(testContext)).to.throw;
    });
  });

  // This is a terrible example of an edge-case where something related to the view's destroy
  // may also want to empty the same region.
  describe('when emptying a region destroys a view that empties the same region', function() {
    let MyRegion;
    let region;
    let MyView;

    it('should only empty once', function() {
      setFixtures('<div id="region"></div>');

      MyRegion = Region.extend({
        el: '#region',
        onEmpty: vi.fn(),
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

      expect(region.onEmpty).toHaveBeenCalledTimes(1);
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
      setFixtures('<div id="region">Preexisting HTML</div>');
      region = new MyRegion();
      region.empty();
      expect(region.el.innerHTML).to.eql('');
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
