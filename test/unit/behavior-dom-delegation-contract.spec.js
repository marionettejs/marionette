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

      expect(behavior.el).to.equal(host.el);
      expect(behavior.$('.action')[0]).to.not.equal(secondHost.querySelector('.second'));

      host.destroy();
    });

    it(`keeps one handler through ${hostName} redelegation and removes it on destroy`, function() {
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

      host.delegateEvents();
      firstAction.click();
      secondAction.click();
      expect(onAction).to.have.been.calledTwice;

      host.delegateEvents();
      firstAction.click();
      expect(onAction).to.have.been.calledThrice;

      host.delegateEvents();
      secondAction.click();
      firstAction.click();
      expect(onAction).to.have.callCount(4);

      host.destroy();
      firstAction.click();
      expect(onAction).to.have.callCount(4);
    });
  });
});
