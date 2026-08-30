import Behavior from '../../modules/behavior';
import CollectionView from '../../modules/collection-view';
import View from '../../modules/view';
import MarionetteError from '../../utils/error';

function state(view) {
  return {
    attached: view.isAttached(),
    destroyed: view.isDestroyed(),
    rendered: view.isRendered(),
  };
}

const viewTypes = [
  { Class: View, name: 'View' },
  { Class: CollectionView, name: 'CollectionView' },
];

describe('#setElement', function() {
  for (const { Class, name } of viewTypes) {
    it(`ignores ${name} element replacement as soon as destruction begins`, function() {
      const original = document.createElement('div');
      const view = new Class({ el: original, template: false });
      const tagRead = this.sinon.spy(() => { throw new Error('element inspected'); });
      const malformed = Object.create(null, {
        [Symbol.toStringTag]: { get: tagRead },
      });
      let result;
      view.on('before:destroy', () => {
        result = view.setElement(malformed);
      });

      expect(view.destroy()).to.equal(view);

      expect(result).to.equal(view);
      expect(tagRead).to.not.have.been.called;
      expect(view.el).to.equal(original);
      expect(view.isDestroyed()).to.be.true;
    });

    it(`ignores repeated ${name} element replacement after destruction before observable work`, function() {
      const viewAction = this.sinon.spy();
      const behaviorAction = this.sinon.spy();
      const HostBehavior = Behavior.extend({
        events: { 'click .action': 'onAction' },
        onAction: behaviorAction,
      });
      const original = document.createElement('div');
      original.innerHTML = '<button class="action">Original</button>';
      const originalAction = original.querySelector('.action');
      const view = new Class({
        behaviors: [HostBehavior],
        el: original,
        events: { 'click .action': viewAction },
        template: false,
        ui: { action: '.action' },
      });
      view.destroy();
      expect(view.destroy()).to.equal(view);

      const sentinel = document.createElement('span');
      sentinel.textContent = 'Unmanaged content';
      original.append(sentinel);
      const replacement = document.createElement('div');
      replacement.innerHTML = '<button class="action">Replacement</button>';
      const originalHtml = original.innerHTML;
      const replacementHtml = replacement.innerHTML;
      const destroyedState = state(view);
      const tagRead = this.sinon.spy(() => { throw new Error('element inspected'); });
      const malformed = Object.create(null, {
        [Symbol.toStringTag]: { get: tagRead },
      });

      expect(view.setElement()).to.equal(view);

      for (const element of [view.el, malformed, malformed, '#missing', replacement]) {
        expect(view.setElement(element)).to.equal(view);
      }

      expect(tagRead).to.not.have.been.called;
      expect(view.el).to.equal(original);
      expect(original.innerHTML).to.equal(originalHtml);
      expect(original.lastChild).to.equal(sentinel);
      expect(replacement.innerHTML).to.equal(replacementHtml);
      expect(state(view)).to.deep.equal(destroyedState);
      expect(() => view.getUI('action')).to.throw(MarionetteError).and.include({ code: 'MN0023' });

      originalAction.click();
      replacement.querySelector('.action').click();
      expect(viewAction).to.not.have.been.called;
      expect(behaviorAction).to.not.have.been.called;
    });

    it(`leaves a ${name} setElement override in control until it delegates`, function() {
      const replacement = document.createElement('div');
      const CustomView = Class.extend({
        setElement(element) {
          if (this.isDestroyed()) { return element; }
          return Class.prototype.setElement.call(this, element);
        },
      });
      const custom = new CustomView();
      custom.destroy();

      expect(custom.setElement(replacement)).to.equal(replacement);

      const DelegatingView = Class.extend({
        setElement(element) {
          return Class.prototype.setElement.call(this, element);
        },
      });
      const delegating = new DelegatingView();
      delegating.destroy();

      expect(delegating.setElement(replacement)).to.equal(delegating);
    });
  }
});
