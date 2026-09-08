import { vi, describe, it, expect, beforeEach } from 'vitest';
import '../../setup/backbone.js';
import _ from 'underscore';
import Backbone from 'backbone';
import { CollectionView } from 'marionette';
import { View } from 'marionette';

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
    it('should set the container to the el', function() {
      const myCollectionView = new MyCollectionView({ collection });
      myCollectionView.render();

      expect(myCollectionView.container).to.equal(myCollectionView.el);
    });
  });

  describe('when childViewContainer is defined', function() {
    [
      { name: 'nested container', childViewContainer: '#foo', label: '' },
      { name: 'root container', label: '' },
      { name: 'nested container with text', childViewContainer: '#foo', label: 'Keep' },
      { name: 'nested container with a control', childViewContainer: '#foo', label: '<li><button>Add</button></li>' },
      { name: 'nested container with whitespace', childViewContainer: '#foo', label: '\n' },
      { name: 'nested container with a nonbreaking space', childViewContainer: '#foo', label: '&nbsp;' },
      { name: 'nested container with a comment', childViewContainer: '#foo', label: '<!-- keep -->' }
    ].forEach(({ name, childViewContainer, label }) => {
      it(`preserves the template around a ${name} when resetting without monitoring`, function() {
        const UnmonitoredList = MyCollectionView.extend({ monitorViewEvents: false });
        const myCollectionView = new UnmonitoredList({
          collection,
          template: () => `<input value="original"><ul id="foo">${label}</ul>`,
          childViewContainer
        }).render();
        const input = myCollectionView.el.querySelector('input');
        const list = myCollectionView.el.querySelector('#foo');
        const labelNode = label && list.firstChild;
        const container = myCollectionView.container;
        const previousChildren = myCollectionView.children.toArray();
        const detachContents = vi.spyOn(myCollectionView.Dom, 'detachContents');
        input.value = 'edited';
        if (label.startsWith('<li>')) { previousChildren[0].el.after(labelNode); }

        collection.reset([{ foo: 'after' }]);

        expect(myCollectionView.el.querySelector('input')).to.equal(input);
        expect(input.value).to.equal('edited');
        expect(myCollectionView.el.querySelector('#foo')).to.equal(list);
        expect(myCollectionView.children.first().el.parentNode).to.equal(container);
        expect(myCollectionView.children.first().el.textContent).to.equal('after');
        if (label.trim()) { expect(list.firstChild).to.equal(labelNode); }
        expect(previousChildren.every(view => view.isDestroyed())).toBe(true);
        if (childViewContainer && !label.trim()) {
          expect(detachContents).toHaveBeenCalledTimes(1);
          expect(detachContents).toHaveBeenCalledWith(container);
        } else {
          expect(detachContents).not.toHaveBeenCalled();
        }
        if (label && !label.trim()) { expect(labelNode.parentNode).toBeNull(); }

        collection.reset([]);
        expect(myCollectionView.el.querySelector('input')).to.equal(input);
        expect(myCollectionView.el.querySelector('#foo')).to.equal(list);
        expect(myCollectionView.children.length).to.equal(0);
        if (label.trim()) { expect(list.firstChild).to.equal(labelNode); }
        myCollectionView.destroy();
      });
    });

    it('preserves unmanaged content when children are mounted by custom attachHtml', function() {
      const external = document.createElement('section');
      const UnmonitoredList = MyCollectionView.extend({
        monitorViewEvents: false,
        template: () => '<button>Keep</button>',
        attachHtml(els) { external.append(els); }
      });
      collection.reset([{ foo: 'before' }]);
      const myCollectionView = new UnmonitoredList({ collection }).render();
      const button = myCollectionView.el.firstChild;
      const previous = myCollectionView.children.first();

      collection.reset([{ foo: 'after' }]);

      expect(myCollectionView.el.firstChild).to.equal(button);
      expect(external.textContent).to.equal('after');
      expect(previous.isDestroyed()).toBe(true);
      myCollectionView.destroy();
      expect(external.childNodes.length).to.equal(0);
    });

    describe('when a selector within the el', function() {
      it('should should put the children within the found container', function() {
        const myCollectionView = new MyCollectionView({
          collection,
          template,
          childViewContainer: '#foo'
        });
        myCollectionView.render();

        expect(myCollectionView.container.textContent).to.equal('barbaz');
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
          .to.throw('The specified "childViewContainer" was not found: #bar')
          .with.property('code', 'MN0013');
      });
    });

    describe('when a function', function() {
      it('should should put the children within the found container', function() {
        const myCollectionView = new MyCollectionView({
          collection,
          template,
          childViewContainer: _.constant('#foo')
        });
        myCollectionView.render();

        expect(myCollectionView.container.textContent).to.equal('barbaz');
      });
    });
  });
});
