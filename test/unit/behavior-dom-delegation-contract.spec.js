import Behavior from '../../src/modules/behavior';
import CollectionView from '../../src/modules/collection-view';
import View from '../../src/modules/view';

describe('Behavior DOM delegation contract', function() {
  [
    ['View', View],
    ['CollectionView', CollectionView],
  ].forEach(([hostName, Host]) => {
    it(`keeps DOM access scoped to the current ${hostName} element`, function() {
      const firstHost = document.createElement('section');
      const secondHost = document.createElement('section');
      firstHost.innerHTML = '<button class="action first">First</button>';
      secondHost.innerHTML = '<button class="action second">Second</button>';
      let behavior;

      const TestBehavior = Behavior.extend({
        initialize() {
          behavior = this;
        },
      });
      const TestHost = Host.extend({
        behaviors: [TestBehavior],
      });
      const host = new TestHost({ el: firstHost });

      expect(behavior.el).to.equal(firstHost);
      expect(behavior).to.not.have.property('$el');
      expect(behavior.$('.action')[0]).to.equal(firstHost.querySelector('.first'));

      host.setElement(secondHost);

      expect(behavior.el).to.equal(secondHost);
      expect(behavior.el).to.equal(host.el);
      expect(behavior.$('.action')).to.have.length(1);
      expect(behavior.$('.action')[0]).to.equal(secondHost.querySelector('.second'));
      expect(behavior.$('.action')[0]).to.not.equal(firstHost.querySelector('.first'));

      host.destroy();
    });

    it(`moves one delegated handler with repeated ${hostName} element changes and removes it on destroy`, function() {
      const firstHost = document.createElement('section');
      const secondHost = document.createElement('section');
      firstHost.innerHTML = '<button class="action first">First</button>';
      secondHost.innerHTML = '<button class="action second">Second</button>';
      const onAction = this.sinon.spy();

      const TestBehavior = Behavior.extend({
        events: {
          'click .action': 'onAction',
        },
        onAction,
      });
      const TestHost = Host.extend({
        behaviors: [TestBehavior],
      });
      const host = new TestHost({ el: firstHost });
      const firstAction = firstHost.querySelector('.first');
      const secondAction = secondHost.querySelector('.second');

      firstAction.click();
      expect(onAction).to.have.been.calledOnce;

      host.setElement(secondHost);
      firstAction.click();
      secondAction.click();
      expect(onAction).to.have.been.calledTwice;

      host.setElement(secondHost);
      secondAction.click();
      expect(onAction).to.have.been.calledThrice;

      host.setElement(firstHost);
      secondAction.click();
      firstAction.click();
      expect(onAction).to.have.callCount(4);

      host.destroy();
      firstAction.click();
      expect(onAction).to.have.callCount(4);
    });
  });
});
