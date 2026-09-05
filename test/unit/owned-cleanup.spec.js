import Application from '../../src/modules/application';
import MnObject from '../../src/modules/object';
import Radio from '../../src/modules/radio';
import Region from '../../src/modules/region';
import Events from '../../src/mixins/events';

const ObservableSource = function(attributes = {}) {
  this.attributes = { ...attributes };
};

Object.assign(ObservableSource.prototype, Events, {
  destroy() {
    this._isDestroyed = true;
    this.off();
  },
  isDestroyed() { return !!this._isDestroyed; },
  set(key, value) {
    this.attributes[key] = value;
    this.trigger(`change:${ key }`, this, value);
  }
});

const TestStateApi = {
  subscribe(source, eventName, callback, context) {
    source.on(eventName, callback, context);
    return () => source.off(eventName, callback, context);
  },
  disposeOwned(source) { source.destroy(); }
};

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
      const state = new ObservableSource({ ready: false });
      const destroyState = this.sinon.spy(state, 'destroy');
      const Owner = OwnerClass.extend({
        channelName,
        createState() { return state; },
        radioEvents: { ping: 'onPing' },
        radioRequests: { status: 'getStatus' },
        stateEvents: { 'change:ready': 'onReady' },
        getStatus() { return 'ready'; },
        onPing,
        onReady
      });
      Owner.setStateApi(TestStateApi);
      const owner = new Owner();
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
      expect(destroyState).to.have.been.calledOnce;
      expect(destroyRadio).to.have.been.calledOnce;
      expect(destroyOwnedState).to.have.been.calledOnce;
    });

    it(`${ name } preserves owned cleanup timing around public destroy`, async function() {
      const channelName = `cleanup-timing-${ name }`;
      const state = new ObservableSource();
      const lifecycle = [];
      const Owner = OwnerClass.extend({
        channelName,
        createState() { return state; },
        initialize() { this.getState(); },
        radioRequests: { status: 'getStatus' },
        getStatus() { return 'ready'; },
        onBeforeDestroy() {
          lifecycle.push([
            'onBeforeDestroy',
            this.isDestroyed(),
            state.isDestroyed(),
            Radio.request(channelName, 'status')
          ]);
        },
        onDestroy() {
          lifecycle.push([
            'onDestroy',
            this.isDestroyed(),
            state.isDestroyed(),
            Radio.request(channelName, 'status')
          ]);
        }
      });
      Owner.setStateApi(TestStateApi);
      const owner = new Owner();

      owner.on('before:destroy', currentOwner => {
        lifecycle.push([
          'before:destroy',
          currentOwner.isDestroyed(),
          state.isDestroyed(),
          Radio.request(channelName, 'status')
        ]);
      });
      owner.listenTo(owner, 'destroy', currentOwner => {
        lifecycle.push([
          'destroy',
          currentOwner.isDestroyed(),
          state.isDestroyed(),
          Radio.request(channelName, 'status')
        ]);
      });

      await destroy(owner);

      expect(lifecycle).to.deep.equal([
        ['onBeforeDestroy', false, false, 'ready'],
        ['before:destroy', false, false, 'ready'],
        ['onDestroy', true, true, undefined],
        ['destroy', true, true, undefined]
      ]);
    });

    it(`${ name } attempts remaining cleanup after owned cleanup throws`, async function() {
      const cleanupError = new Error('state cleanup failed');
      const channelName = `normal-cleanup-error-${ name }`;
      const state = new ObservableSource();
      const onDestroy = this.sinon.spy();
      const Owner = OwnerClass.extend({
        channelName,
        createState() { return state; },
        initialize() { this.getState(); },
        radioRequests: { status: 'getStatus' },
        getStatus() { return 'ready'; },
        _destroyState() {
          OwnerClass.prototype._destroyState.apply(this, arguments);
          throw cleanupError;
        }
      });
      Owner.setStateApi(TestStateApi);
      const owner = new Owner();
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
      expect(Radio.request(channelName, 'status')).to.be.undefined;
      expect(onDestroy).to.have.been.calledOnceWith(owner, undefined);
    });

    if (OwnerClass === Application) {
      it('Application attempts remaining cleanup after an owned Region finishes with an error', async function() {
        const cleanupError = new Error('region cleanup failed');
        const channelName = 'normal-region-cleanup-error';
        const state = new ObservableSource();
        const onDestroy = this.sinon.spy();
        let ownedRegion;
        const ThrowingRegion = Region.extend({
          initialize() { ownedRegion = this; },
          destroy() {
            Region.prototype.destroy.apply(this, arguments);
            throw cleanupError;
          }
        });
        const TestApplication = Application.extend({
          channelName,
          createState() { return state; },
          initialize() { this.getState(); },
          region: { el: document.createElement('div') },
          regionClass: ThrowingRegion,
          radioRequests: { status: 'getStatus' },
          getStatus() { return 'ready'; }
        });
        TestApplication.setStateApi(TestStateApi);
        const application = new TestApplication();
        application.on('destroy', onDestroy);

        let thrownError;
        try {
          await application.destroy();
        } catch (error) {
          thrownError = error;
        }

        expect(thrownError).to.equal(cleanupError);
        expect(application.isDestroyed()).to.be.true;
        expect(ownedRegion.isDestroyed()).to.be.true;
        expect(state.isDestroyed()).to.be.true;
        expect(Radio.request(channelName, 'status')).to.be.undefined;
        expect(onDestroy).to.have.been.calledOnceWith(application, undefined);
      });

      it('Application retains a live owned Region and retries rejected destruction', async function() {
        const rejection = new Error('region rejected destruction');
        const channelName = 'rejected-region-cleanup';
        const state = new ObservableSource();
        const onDestroy = this.sinon.spy();
        const onBeforeRegionDestroy = this.sinon.stub();
        onBeforeRegionDestroy.onFirstCall().throws(rejection);
        let ownedRegion;
        const RejectingRegion = Region.extend({
          initialize() { ownedRegion = this; },
          onBeforeDestroy: onBeforeRegionDestroy
        });
        const TestApplication = Application.extend({
          channelName,
          createState() { return state; },
          initialize() { this.getState(); },
          region: { el: document.createElement('div') },
          regionClass: RejectingRegion,
          radioRequests: { status: 'getStatus' },
          getStatus() { return 'ready'; }
        });
        TestApplication.setStateApi(TestStateApi);
        const application = new TestApplication();
        application.on('destroy', onDestroy);

        let thrownError;
        try {
          await application.destroy();
        } catch (error) {
          thrownError = error;
        }

        expect(thrownError).to.equal(rejection);
        expect(application.isDestroyed()).to.be.false;
        expect(application.getRegion()).to.equal(ownedRegion);
        expect(ownedRegion.isDestroyed()).to.be.false;
        expect(state.isDestroyed()).to.be.false;
        expect(application.getState()).to.equal(state);
        expect(Radio.request(channelName, 'status')).to.equal('ready');
        expect(onDestroy).to.not.have.been.called;

        expect(await application.destroy()).to.be.true;
        expect(application.isDestroyed()).to.be.true;
        expect(ownedRegion.isDestroyed()).to.be.true;
        expect(state.isDestroyed()).to.be.true;
        expect(Radio.request(channelName, 'status')).to.be.undefined;
        expect(onDestroy).to.have.been.calledOnceWith(application, undefined);
      });
    }

    for (const failure of ['_initRadio', '_initState', 'initialize', 'stateEvents']) {
      it(`${ name } rolls back owned resources when ${ failure } fails`, function() {
        const constructionError = new Error(`${ failure } failed`);
        const channelName = `constructor-cleanup-${ name }-${ failure }`;
        const onPing = this.sinon.spy();
        const getStatus = this.sinon.stub().returns('ready');
        const getFunctionReply = this.sinon.stub().returns('function');
        const state = new ObservableSource();
        let failedOwner;
        let ownedRegion;
        const TrackingRegion = Region.extend({
          initialize() { ownedRegion = this; }
        });
        const definition = {
          channelName,
          createState() { return state; },
          radioEvents: { ping: 'onPing' },
          radioRequests: { status: 'getStatus' },
          getStatus,
          onPing,
          initialize() {
            failedOwner = this;
            this.getState();
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
            this.getState();
            OwnerClass.prototype._initRadio.apply(this, arguments);
            throw constructionError;
          };
        }

        if (failure === '_initState') {
          definition._initState = function() {
            failedOwner = this;
            OwnerClass.prototype._initState.apply(this, arguments);
            this.getState();
            throw constructionError;
          };
        }

        const BrokenOwner = OwnerClass.extend(definition);
        BrokenOwner.setStateApi(TestStateApi);

        expect(() => new BrokenOwner()).to.throw(constructionError);
        Radio.trigger(channelName, 'ping');

        expect(onPing).to.not.have.been.called;
        expect(getStatus).to.not.have.been.called;
        expect(getFunctionReply).to.not.have.been.called;
        expect(Radio.request(channelName, 'status')).to.be.undefined;
        expect(Radio.request(channelName, 'constant')).to.be.undefined;
        expect(Radio.request(channelName, 'function')).to.be.undefined;
        expect(failedOwner).to.exist;

        expect(state.isDestroyed()).to.be.true;

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
      const state = new ObservableSource();
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
        createState() { return state; },
        radioEvents: { ping: 'onPing' },
        radioRequests: { status: 'getStatus' },
        getStatus() { return 'ready'; },
        onPing,
        initialize() {
          this.getState();
          throw constructionError;
        },
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
      BrokenOwner.setStateApi(TestStateApi);

      expect(() => new BrokenOwner()).to.throw(constructionError);
      Radio.trigger(channelName, 'ping');

      expect(onPing).to.not.have.been.called;
      expect(Radio.request(channelName, 'status')).to.be.undefined;
      expect(state.isDestroyed()).to.be.true;
      if (OwnerClass === Application) {
        expect(ownedRegion.isDestroyed()).to.be.true;
      }
    });
  }
});
