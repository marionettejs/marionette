import Application from '../../modules/application';
import MnObject from '../../modules/object';
import Radio from '../../modules/radio';
import Region from '../../modules/region';
import State from '../../modules/state';

const ownerDefinitions = [
  { name: 'MnObject', OwnerClass: MnObject },
  { name: 'Application', OwnerClass: Application }
];

async function destroy(owner) {
  await owner.destroy();
}

describe('MnObject and Application owned cleanup', function() {
  afterEach(function() {
    Radio.reset();
  });

  for (const { name, OwnerClass } of ownerDefinitions) {
    it(`${ name } cleanup cannot be disabled with off()`, async function() {
      const channelName = `owned-cleanup-${ name }`;
      const onPing = this.sinon.spy();
      const onReady = this.sinon.spy();
      const state = new State({ ready: false });
      const destroyState = this.sinon.spy(state, 'destroy');
      const Owner = OwnerClass.extend({
        channelName,
        radioEvents: { ping: 'onPing' },
        radioRequests: { status: 'getStatus' },
        stateEvents: { 'change:ready': 'onReady' },
        getStatus() { return 'ready'; },
        onPing,
        onReady
      });
      const owner = new Owner({ state });
      const destroyRadio = this.sinon.spy(owner, '_destroyRadio');
      const destroyOwnedState = this.sinon.spy(owner, '_destroyState');

      owner.off();
      Radio.trigger(channelName, 'ping');
      state.set('ready', true);

      expect(onPing).to.have.been.calledOnce;
      expect(onReady).to.have.been.calledOnce;
      expect(Radio.request(channelName, 'status')).to.equal('ready');

      await destroy(owner);
      await destroy(owner);
      Radio.trigger(channelName, 'ping');
      state.set('ready', false);

      expect(onPing).to.have.been.calledOnce;
      expect(onReady).to.have.been.calledOnce;
      expect(Radio.request(channelName, 'status')).to.be.undefined;
      expect(state.isDestroyed()).to.be.true;
      expect(state._owner).to.be.undefined;
      expect(destroyState).to.have.been.calledOnce;
      expect(destroyRadio).to.have.been.calledOnce;
      expect(destroyOwnedState).to.have.been.calledOnce;
    });

    it(`${ name } preserves owned cleanup timing around public destroy`, async function() {
      const channelName = `cleanup-timing-${ name }`;
      const state = new State();
      const lifecycle = [];
      const Owner = OwnerClass.extend({
        channelName,
        radioRequests: { status: 'getStatus' },
        getStatus() { return 'ready'; }
      });
      const owner = new Owner({ state });

      owner.on('before:destroy', currentOwner => {
        lifecycle.push([
          'before:destroy',
          currentOwner.isDestroyed(),
          state.isDestroyed(),
          Radio.request(channelName, 'status')
        ]);
      });
      owner.on('destroy', currentOwner => {
        lifecycle.push([
          'destroy',
          currentOwner.isDestroyed(),
          state.isDestroyed(),
          Radio.request(channelName, 'status')
        ]);
      });

      await destroy(owner);

      expect(lifecycle).to.deep.equal([
        ['before:destroy', false, false, 'ready'],
        ['destroy', true, true, undefined]
      ]);
    });

    it(`${ name } attempts remaining cleanup after owned cleanup throws`, async function() {
      const cleanupError = new Error('state cleanup failed');
      const channelName = `normal-cleanup-error-${ name }`;
      const state = new State();
      const onDestroy = this.sinon.spy();
      const Owner = OwnerClass.extend({
        channelName,
        radioRequests: { status: 'getStatus' },
        getStatus() { return 'ready'; },
        _destroyState() {
          OwnerClass.prototype._destroyState.apply(this, arguments);
          throw cleanupError;
        }
      });
      const owner = new Owner({ state });
      owner.on('destroy', onDestroy);

      let thrownError;
      try {
        await destroy(owner);
      } catch (error) {
        thrownError = error;
      }

      expect(thrownError).to.equal(cleanupError);
      expect(owner.isDestroyed()).to.be.true;
      expect(state.isDestroyed()).to.be.true;
      expect(state._owner).to.be.undefined;
      expect(Radio.request(channelName, 'status')).to.be.undefined;
      expect(onDestroy).to.have.been.calledOnceWith(owner, undefined);
    });

    for (const failure of ['_initRadio', '_initState', 'initialize', 'stateEvents']) {
      it(`${ name } rolls back owned resources when ${ failure } fails`, function() {
        const constructionError = new Error(`${ failure } failed`);
        const channelName = `constructor-cleanup-${ name }-${ failure }`;
        const onPing = this.sinon.spy();
        const getStatus = this.sinon.stub().returns('ready');
        const getFunctionReply = this.sinon.stub().returns('function');
        const state = new State();
        let failedOwner;
        let ownedRegion;
        const TrackingRegion = Region.extend({
          initialize() { ownedRegion = this; }
        });
        const definition = {
          channelName,
          radioEvents: { ping: 'onPing' },
          radioRequests: { status: 'getStatus' },
          getStatus,
          onPing,
          initialize() {
            failedOwner = this;
            this.getChannel().reply('constant', 'constant', this);
            this.getChannel().reply('function', getFunctionReply, this);
            if (failure === 'initialize') { throw constructionError; }
          },
          stateEvents() {
            if (failure === 'stateEvents') { throw constructionError; }
          }
        };

        if (OwnerClass === Application) {
          definition.region = { el: document.createElement('div') };
          definition.regionClass = TrackingRegion;
        }

        if (failure === '_initRadio') {
          definition._initRadio = function() {
            failedOwner = this;
            OwnerClass.prototype._initRadio.apply(this, arguments);
            throw constructionError;
          };
        }

        if (failure === '_initState') {
          definition._initState = function() {
            failedOwner = this;
            OwnerClass.prototype._initState.apply(this, arguments);
            throw constructionError;
          };
        }

        const BrokenOwner = OwnerClass.extend(definition);

        expect(() => new BrokenOwner({ state })).to.throw(constructionError);
        Radio.trigger(channelName, 'ping');

        expect(onPing).to.not.have.been.called;
        expect(getStatus).to.not.have.been.called;
        expect(getFunctionReply).to.not.have.been.called;
        expect(Radio.request(channelName, 'status')).to.be.undefined;
        expect(Radio.request(channelName, 'constant')).to.be.undefined;
        expect(Radio.request(channelName, 'function')).to.be.undefined;
        expect(failedOwner).to.exist;

        if (failure === '_initRadio') {
          expect(state.isDestroyed()).to.be.false;
        } else {
          expect(state.isDestroyed()).to.be.true;
          expect(state._owner).to.be.undefined;
        }

        if (OwnerClass === Application) {
          expect(ownedRegion.isDestroyed()).to.be.true;
          expect(failedOwner.getRegion()).to.be.undefined;
        }
      });
    }

    it(`${ name } preserves construction errors while attempting every cleanup`, function() {
      const constructionError = new Error('initialize failed');
      const cleanupError = new Error('state cleanup failed');
      const channelName = `cleanup-error-${ name }`;
      const state = new State();
      const onPing = this.sinon.spy();
      let ownedRegion;
      const ThrowingRegion = Region.extend({
        initialize() { ownedRegion = this; },
        destroy() {
          Region.prototype.destroy.apply(this, arguments);
          throw new Error('region cleanup failed');
        }
      });
      const definition = {
        channelName,
        radioEvents: { ping: 'onPing' },
        radioRequests: { status: 'getStatus' },
        getStatus() { return 'ready'; },
        onPing,
        initialize() { throw constructionError; },
        _destroyState() {
          OwnerClass.prototype._destroyState.apply(this, arguments);
          throw cleanupError;
        }
      };

      if (OwnerClass === Application) {
        definition.region = { el: document.createElement('div') };
        definition.regionClass = ThrowingRegion;
      }

      const BrokenOwner = OwnerClass.extend(definition);

      expect(() => new BrokenOwner({ state })).to.throw(constructionError);
      Radio.trigger(channelName, 'ping');

      expect(onPing).to.not.have.been.called;
      expect(Radio.request(channelName, 'status')).to.be.undefined;
      expect(state.isDestroyed()).to.be.true;
      expect(state._owner).to.be.undefined;
      if (OwnerClass === Application) {
        expect(ownedRegion.isDestroyed()).to.be.true;
      }
    });
  }
});
