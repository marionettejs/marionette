import { vi, describe, it, expect, beforeEach } from 'vitest';
import { setFixtures } from '../setup/fixtures.js';
import _ from 'underscore';
import { View, Region } from 'marionette';

describe('onAttach', function() {
  const expectTriggerMethod = (method, target, retval, before = null) => {
    expect(method).toHaveBeenCalledTimes(1);
    expect(method.mock.contexts).toContain(target);
    expect(method).toHaveBeenCalledWith(target);
    expect(method).toHaveReturnedWith(retval);
    if (before) {
      expect(method).toHaveBeenCalledBefore(before);
    }
  };

  const extendAttachMethods = superConstructor => target => _.assign(target, {
    constructor: function(options) {
      superConstructor.call(this, options);
      vi.spyOn(this, 'onAttach');
      vi.spyOn(this, 'onBeforeAttach');
      vi.spyOn(this, 'onDetach');
      vi.spyOn(this, 'onBeforeDetach');
      vi.spyOn(this, 'onDestroy');
    },
    onAttach() {
      return this.isAttached();
    },
    onBeforeAttach() {
      return this.isAttached();
    },
    onDetach() {
      return this.isAttached();
    },
    onBeforeDetach() {
      return this.isAttached();
    },
    onDestroy() {
      return this.isAttached();
    }
  });

  let TestView;
  let region; // A Region to show our View within

  beforeEach(function() {
    TestView = View.extend(extendAttachMethods(View)({
      template: _.template('<header></header><main></main><footer></footer>'),
      regions: {
        header: 'header',
        main: 'main',
        footer: 'footer'
      }
    }));
    // A Region to show our View within
    setFixtures('<div id="region"></div>');
    const regionEl = document.getElementById('region');
    region = new Region({el: regionEl});
  });

  describe('when showing a view into a region of a view without events monitored', function() {
    let layoutView;
    let view;

    beforeEach(function() {
      const LayoutView = View.extend({
        monitorViewEvents: false,
        el: document.getElementById('region'),
        template: _.template('<div id="child"></div>'),
        regions: {
          child: '#child'
        }
      });

      layoutView = new LayoutView();
      layoutView.render();

      view = new TestView();
      layoutView.showChildView('child', view);
    });

    it('should not trigger onBeforeAttach on the view', function() {
      expect(view.onBeforeAttach).not.toHaveBeenCalled();
    });

    it('should not trigger onAttach on the view', function() {
      expect(view.onAttach).not.toHaveBeenCalled();
    });

    describe('when destroying the view', function() {
      beforeEach(function() {
        layoutView.getRegion('child').destroyView(view);
      });

      it('should not trigger onBeforeDetach on the view', function() {
        expect(view.onBeforeDetach).not.toHaveBeenCalled();
      });

      it('should not trigger onDetach on the view', function() {
        expect(view.onDetach).not.toHaveBeenCalled();
      });
    });

    describe('when detaching the view', function() {
      beforeEach(function() {
        layoutView.getRegion('child').detachView();
      });

      it('should not trigger onBeforeDetach on the view', function() {
        expect(view.onBeforeDetach).not.toHaveBeenCalled();
      });

      it('should not trigger onDetach on the view', function() {
        expect(view.onDetach).not.toHaveBeenCalled();
      });
    });
  });

  describe('when showing a view into a region not attached to the document', function() {
    let detachedRegion;
    let view;

    beforeEach(function() {
      view = new TestView();
      detachedRegion = new Region({el: document.createElement('div')});
      detachedRegion.show(view);
    });

    it('should not call onAttach/onBeforeAttach methods on the view', function() {
      expect(view.onAttach).not.toHaveBeenCalled();
      expect(view.onBeforeAttach).not.toHaveBeenCalled();
    });

    describe('when removing a view from a region not attached to the document', function() {
      beforeEach(function() {
        detachedRegion.empty();
      });

      it('should not call onDetach/onBeforeDetach methods on the view', function() {
        expect(view.onDetach).not.toHaveBeenCalled();
        expect(view.onBeforeDetach).not.toHaveBeenCalled();
      });
    });
  });

  describe('when showing a view into a region attached to the document', function() {
    let view;

    beforeEach(function() {
      view = new TestView();
      region.show(view);
    });

    it('should call onBeforeAttach on the view', function() {
      expectTriggerMethod(view.onBeforeAttach, view, false, view.onAttach);
    });

    it('should call onAttach on the view', function() {
      expectTriggerMethod(view.onAttach, view, true);
    });

    describe('when destroying a view from a region attached to the document', function() {
      beforeEach(function() {
        region.empty();
      });

      it('should call onBeforeDetach on the view', function() {
        expectTriggerMethod(view.onBeforeDetach, view, true, view.onDetach);
      });

      it('should call onDetach on the view', function() {
        expectTriggerMethod(view.onDetach, view, false);
      });

      it('should call onDetach before destroying view', function() {
        expect(view.onDestroy).toHaveBeenCalledAfter(view.onDetach);
      });
    });

    describe('when detaching a view from a region attached to the document', function() {
      beforeEach(function() {
        region.empty({preventDestroy: true});
      });

      it('should call onBeforeDetach on the view', function() {
        expectTriggerMethod(view.onBeforeDetach, view, true, view.onDetach);
      });

      it('should call onDetach on the view', function() {
        expectTriggerMethod(view.onDetach, view, false);
      });
    });
  });

  describe('when the parent view is initially detached', function() {
    describe('When showing a View with a single level of nested views', function() {
      let mainView;
      let footerView;

      beforeEach(function() {
        const ParentView = TestView.extend({
          onRender: function() {
            mainView = new TestView();
            footerView = new TestView();
            this.showChildView('main', mainView);
            this.showChildView('footer', footerView);
          }
        });

        const parentView = new ParentView();
        region.show(parentView);
      });

      it('should trigger onBeforeAttach & onAttach on the mainView', function() {
        expectTriggerMethod(mainView.onBeforeAttach, mainView, false, mainView.onAttach);
        expectTriggerMethod(mainView.onAttach, mainView, true);
      });

      it('should trigger onBeforeAttach & onAttach on the footerView', function() {
        expectTriggerMethod(footerView.onBeforeAttach, footerView, false, footerView.onAttach);
        expectTriggerMethod(footerView.onAttach, footerView, true);
      });

      describe('When destroying a View with a single level of nested view', function() {
        beforeEach(function() {
          region.empty();
        });

        it('should call onBeforeDetach & onDetach on the mainView', function() {
          expectTriggerMethod(mainView.onBeforeDetach, mainView, true, mainView.onDetach);
          expectTriggerMethod(mainView.onDetach, mainView, false);
        });

        it('should call onBeforeDetach & onDetach on the footerView', function() {
          expectTriggerMethod(footerView.onBeforeDetach, footerView, true, footerView.onDetach);
          expectTriggerMethod(footerView.onDetach, footerView, false);
        });
      });
    });

    describe('When showing a View with a single level of nested views in onAttach', function() {
      let mainView;
      let footerView;

      beforeEach(function() {
        const ParentView = TestView.extend({
          onAttach: function() {
            mainView = new TestView();
            footerView = new TestView();
            this.showChildView('main', mainView);
            this.showChildView('footer', footerView);
          }
        });

        const parentView = new ParentView();
        region.show(parentView);
      });

      it('should trigger onBeforeAttach & onAttach on the mainView', function() {
        expectTriggerMethod(mainView.onBeforeAttach, mainView, false, mainView.onAttach);
        expectTriggerMethod(mainView.onAttach, mainView, true);
      });

      it('should trigger onBeforeAttach & onAttach on the footerView', function() {
        expectTriggerMethod(footerView.onBeforeAttach, footerView, false, footerView.onAttach);
        expectTriggerMethod(footerView.onAttach, footerView, true);
      });
    });

    describe('When showing a View with two levels of nested views', function() {
      let grandparentView;
      let parentView;
      let childView;

      beforeEach(function() {
        const GrandparentView = TestView.extend({
          onRender: function() {
            parentView = new ParentView();
            this.showChildView('main', parentView);
          }
        });

        const ParentView = TestView.extend({
          onRender: function() {
            childView = new TestView();
            this.showChildView('main', childView);
          }
        });

        grandparentView = new GrandparentView();
        region.show(grandparentView);
      });

      it('should trigger onBeforeAttach & onAttach on the grandparent view', function() {
        expect(grandparentView.onAttach).toHaveBeenCalledTimes(1);
        expect(grandparentView.onBeforeAttach).toHaveBeenCalledTimes(1);
      });

      it('should trigger onBeforeAttach & onAttach on the parent view', function() {
        expect(parentView.onBeforeAttach).toHaveBeenCalledTimes(1);
        expect(parentView.onAttach).toHaveBeenCalledTimes(1);
      });

      it('should trigger onBeforeAttach & onAttach on the child view', function() {
        expectTriggerMethod(childView.onBeforeAttach, childView, false, childView.onAttach);
        expectTriggerMethod(childView.onAttach, childView, true);
      });

      describe('When destroying a View with two levels of nested views', function() {
        beforeEach(function() {
          region.empty();
        });

        it('should trigger onBeforeDetach & onDetach on the grandparent view', function() {
          expect(grandparentView.onDetach).toHaveBeenCalledTimes(1);
          expect(grandparentView.onBeforeDetach).toHaveBeenCalledTimes(1);
        });

        it('should trigger onBeforeDetach & onDetach on the parent view', function() {
          expect(parentView.onBeforeDetach).toHaveBeenCalledTimes(1);
          expect(parentView.onDetach).toHaveBeenCalledTimes(1);
        });

        it('should trigger onBeforeDetach & onDetach on the child view', function() {
          expectTriggerMethod(childView.onBeforeDetach, childView, true, childView.onDetach);
          expectTriggerMethod(childView.onDetach, childView, false);
        });
      });
    });
  });

  describe('when the parent view is initially attached', function() {
    describe('When showing a View with a single level of nested views', function() {
      let mainView;
      let footerView;

      beforeEach(function() {
        const parentView = new TestView();
        region.show(parentView);

        mainView = new TestView();
        footerView = new TestView();
        parentView.showChildView('main', mainView);
        parentView.showChildView('footer', footerView);
      });

      it('should trigger onBeforeAttach & onAttach on the mainView', function() {
        expectTriggerMethod(mainView.onBeforeAttach, mainView, false, mainView.onAttach);
        expectTriggerMethod(mainView.onAttach, mainView, true);
      });

      it('should trigger onBeforeAttach & onAttach on the footerView', function() {
        expectTriggerMethod(footerView.onBeforeAttach, footerView, false, footerView.onAttach);
        expectTriggerMethod(footerView.onAttach, footerView, true);
      });
    });

    describe('When showing a View with two levels of nested views', function() {
      let grandparentView;
      let parentView;
      let childView;

      beforeEach(function() {
        const ParentView = TestView.extend({
          onRender: function() {
            childView = new TestView();
            this.showChildView('main', childView);
          }
        });

        grandparentView = new TestView();
        region.show(grandparentView);

        parentView = new ParentView();
        grandparentView.showChildView('main', parentView);
      });

      it('should trigger onBeforeAttach & onAttach on the grandparent view', function() {
        expect(grandparentView.onAttach).toHaveBeenCalledTimes(1);
        expect(grandparentView.onBeforeAttach).toHaveBeenCalledTimes(1);
      });

      it('should trigger onBeforeAttach & onAttach on the parent view', function() {
        expect(parentView.onBeforeAttach).toHaveBeenCalledTimes(1);
        expect(parentView.onAttach).toHaveBeenCalledTimes(1);
      });

      it('should trigger onBeforeAttach & onAttach on the child view', function() {
        expectTriggerMethod(childView.onBeforeAttach, childView, false, childView.onAttach);
        expectTriggerMethod(childView.onAttach, childView, true);
      });
    });
  });

});
