import { MarionetteError, Region, View } from '../../index';

const requiredOperations = [
  ['showChildView', (view, name) => {
    const childView = new View();

    try {
      view.showChildView(name, childView);
    } finally {
      childView.destroy();
    }
  }],
  ['detachChildView', (view, name) => view.detachChildView(name)],
  ['getChildView', (view, name) => view.getChildView(name)],
  ['removeRegion', (view, name) => view.removeRegion(name)],
];

function expectMissingRegionError(view, name, operation) {
  expect(() => operation(view, name)).to.throw(MarionetteError).and.include({
    code: 'MN0020',
    name: 'RegionError',
  });
}

describe('View named Region diagnostics', function() {
  let view;

  beforeEach(function() {
    view = new View({
      regions: {
        content: '.content',
      },
      template() {
        return '<div class="content"></div>';
      },
    });
  });

  afterEach(function() {
    view.destroy();
  });

  requiredOperations.forEach(([method, operation]) => {
    it(`${method} rejects a missing named Region with MN0020`, function() {
      expectMissingRegionError(view, 'missing', operation);
    });
  });

  it('keeps Region lookup optional and distinguishes a known empty Region', function() {
    expect(view.getRegion('missing')).to.be.undefined;
    expect(view.hasRegion('missing')).to.be.false;
    expect(view.getChildView('content')).to.be.undefined;
    expect(view.detachChildView('content')).to.be.undefined;
  });

  it('treats inherited object property names as missing across optional and required operations', function() {
    expect(view.getRegion('toString')).to.be.undefined;
    expect(view.hasRegion('toString')).to.be.false;

    for (const [, operation] of requiredOperations) {
      expectMissingRegionError(view, 'toString', operation);
    }
  });

  it('supports an own-defined Region named toString', function() {
    const ownRegionView = new View({
      regions: {
        toString: '.content',
      },
      template() {
        return '<div class="content"></div>';
      },
    });
    const childView = new View({
      template() {
        return '<span></span>';
      },
    });

    try {
      const region = ownRegionView.getRegion('toString');
      expect(region).to.be.instanceOf(Region);
      expect(ownRegionView.hasRegion('toString')).to.be.true;
      expect(ownRegionView.getChildView('toString')).to.be.undefined;
      expect(ownRegionView.detachChildView('toString')).to.be.undefined;
      expect(ownRegionView.showChildView('toString', childView)).to.equal(childView);
      expect(ownRegionView.getChildView('toString')).to.equal(childView);
      expect(ownRegionView.detachChildView('toString')).to.equal(childView);
      expect(ownRegionView.showChildView('toString', childView)).to.equal(childView);
      expect(ownRegionView.removeRegion('toString')).to.equal(region);
      expect(childView.isDestroyed()).to.be.true;
      expect(ownRegionView.getRegion('toString')).to.be.undefined;
    } finally {
      childView.destroy();
      ownRegionView.destroy();
    }
  });

  it('supports a declarative own Region named __proto__', function() {
    const ownRegionView = new View({
      regions: {
        ['__proto__']: '.content',
      },
      template() {
        return '<div class="content"></div>';
      },
    });

    try {
      const region = ownRegionView.getRegion('__proto__');
      expect(region).to.be.instanceOf(Region);
      expect(ownRegionView.hasRegion('__proto__')).to.be.true;
      expect(ownRegionView.removeRegion('__proto__')).to.equal(region);
      expect(ownRegionView.getRegion('__proto__')).to.be.undefined;
    } finally {
      ownRegionView.destroy();
    }
  });

  it('iterates Region declaration maps by own enumerable string keys', function() {
    const inheritedDefinitions = {};
    Object.defineProperty(inheritedDefinitions, 'inherited', {
      enumerable: true,
      get() {
        throw new Error('inherited Region definition was read');
      },
    });
    const definitions = Object.create(inheritedDefinitions);
    Object.defineProperties(definitions, {
      content: {
        configurable: true,
        enumerable: true,
        value: '.content',
        writable: true,
      },
      length: {
        configurable: true,
        enumerable: true,
        value: '.length',
        writable: true,
      },
      hidden: {
        get() {
          throw new Error('non-enumerable Region definition was read');
        },
      },
      [Symbol('ignored')]: {
        enumerable: true,
        get() {
          throw new Error('symbol Region definition was read');
        },
      },
    });
    const mapView = new View({
      regions: definitions,
      template() {
        return '<div class="content"></div><div class="length"></div>';
      },
    });

    try {
      const regions = mapView.getRegions();

      expect(Object.keys(regions)).to.deep.equal(['content', 'length']);
      expect(regions.content).to.be.instanceOf(Region);
      expect(regions.length).to.be.instanceOf(Region);
      expect(Object.getOwnPropertySymbols(regions)).to.deep.equal([]);
    } finally {
      mapView.destroy();
    }
  });

  it('preserves a dynamic __proto__ Region through snapshots and lifecycle operations', function() {
    const protoView = new View({
      template() {
        return '<div class="content"></div>';
      },
    });
    const firstChild = new View({ template: () => '<span></span>' });
    const secondChild = new View({ template: () => '<span></span>' });

    try {
      protoView.render();
      const region = protoView.addRegion('__proto__', '.content');
      region.show(firstChild);

      const snapshot = protoView.getRegions();
      expect(Object.getPrototypeOf(snapshot)).to.equal(Object.prototype);
      expect(snapshot).to.have.own.property('__proto__', region);
      expect(protoView.emptyRegions()).to.have.own.property('__proto__', region);
      expect(firstChild.isDestroyed()).to.be.true;
      expect(region.isDestroyed()).to.be.false;

      region.show(secondChild);
      expect(protoView.removeRegions()).to.have.own.property('__proto__', region);
      expect(region.isDestroyed()).to.be.true;
      expect(secondChild.isDestroyed()).to.be.true;
    } finally {
      firstChild.destroy();
      secondChild.destroy();
      protoView.destroy();
    }
  });

  it('preserves ordinary property-key coercion for own Region names', function() {
    const coercionView = new View({
      regions: {
        'array,name': '.content',
      },
      template() {
        return '<div class="content"></div>';
      },
    });

    try {
      expect(coercionView.getRegion(['array', 'name'])).to.be.instanceOf(Region);
      expect(coercionView.hasRegion(['array', 'name'])).to.be.true;
    } finally {
      coercionView.destroy();
    }
  });

  it('coerces a Region name once during lookup', function() {
    const toPrimitive = this.sinon.stub();
    toPrimitive.onFirstCall().returns('content');
    toPrimitive.returns('missing');
    const name = {
      [Symbol.toPrimitive]: toPrimitive,
    };

    expect(view.getRegion(name)).to.be.instanceOf(Region);
    expect(toPrimitive).to.have.been.calledOnce;
  });

  it('does not coerce a failed required lookup again for its diagnostic', function() {
    for (const [, operation] of requiredOperations) {
      const toPrimitive = this.sinon.stub();
      toPrimitive.onFirstCall().returns('first-key');
      toPrimitive.returns('different-key');
      const name = {
        [Symbol.toPrimitive]: toPrimitive,
      };
      let error;

      try {
        operation(view, name);
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).to.be.instanceOf(MarionetteError).and.include({
        code: 'MN0020',
        name: 'RegionError',
      });
      expect(error.message).not.to.include('different-key');
      expect(toPrimitive).to.have.been.calledOnce;
    }
  });

  it('formats a missing Symbol name in every required-operation diagnostic', function() {
    const name = Symbol('missing');
    expect(view.getRegion(name)).to.be.undefined;
    expect(view.hasRegion(name)).to.be.false;

    for (const [, operation] of requiredOperations) {
      let error;
      try {
        operation(view, name);
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).to.be.instanceOf(MarionetteError).and.include({
        code: 'MN0020',
        name: 'RegionError',
      });
      expect(error.message).to.include(String(name));
    }
  });

  it('uses a stable diagnostic for a Region name without string coercion', function() {
    const name = Object.create(null);
    expect(view.getRegion(name)).to.be.undefined;
    expect(view.hasRegion(name)).to.be.false;

    for (const [, operation] of requiredOperations) {
      let error;
      try {
        operation(view, name);
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).to.be.instanceOf(MarionetteError).and.include({
        code: 'MN0020',
        name: 'RegionError',
      });
      expect(error.message).to.equal('Region does not exist.');
    }
  });

  it('keeps required child operations routed through getRegion overrides', function() {
    const operations = requiredOperations.slice(0, 3);

    for (const [, operation] of operations) {
      const getRegion = this.sinon.stub(view, 'getRegion').returns(undefined);

      expectMissingRegionError(view, 'alias', operation);
      expect(getRegion).to.have.been.calledOnceWith('alias');
      getRegion.restore();
    }
  });

  it('does not emit removal lifecycle events for a missing named Region', function() {
    const beforeRemove = this.sinon.spy();
    const remove = this.sinon.spy();
    view.on('before:remove:region', beforeRemove);
    view.on('remove:region', remove);

    expect(() => view.removeRegion('missing')).to.throw(MarionetteError);

    expect(beforeRemove).not.to.have.been.called;
    expect(remove).not.to.have.been.called;
  });
});
