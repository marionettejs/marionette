import { MarionetteError, Region, View } from '../../index';

const childOperations = [
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
];

const requiredOperations = [
  ...childOperations,
  ['removeRegion', (view, name) => view.removeRegion(name)],
];

function expectMissingRegionError(view, name, operation) {
  expect(() => operation(view, name)).to.throw(MarionetteError).and.include({
    code: 'MN0020',
    name: 'RegionError',
  });
}

function expectInvalidRegionNameError(callback) {
  expect(callback).to.throw(MarionetteError).and.include({
    code: 'MN0032',
    name: 'RegionError',
    message: 'A Region name must be a non-empty string.',
  });
}

function expectInvalidOperation(view, operation) {
  expectInvalidRegionNameError(() => operation(view, null));
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

  it('rejects ownership and name conflicts with MN0030 before changing topology', function() {
    const firstOwner = new View();
    const secondOwner = new View();
    const ownedRegion = firstOwner.addRegion('first', new Region({ el: '.first' }));
    const existingRegion = secondOwner.addRegion('existing', new Region({ el: '.existing' }));

    const replacementRegion = new Region({ el: '.replacement' });

    try {
      expect(() => secondOwner.addRegion('second', ownedRegion))
        .to.throw(MarionetteError).and.include({
          code: 'MN0030',
          name: 'RegionError',
          message: 'A Region instance cannot be registered with more than one owner or name.',
        });
      expect(() => secondOwner.addRegion('existing', replacementRegion))
        .to.throw(MarionetteError).and.include({
          code: 'MN0030',
          name: 'RegionError',
          message: 'Region name "existing" is already registered.',
        });

      expect(firstOwner.getRegion('first')).to.equal(ownedRegion);
      expect(ownedRegion.getOwner()).to.equal(firstOwner);
      expect(ownedRegion.getName()).to.equal('first');
      expect(secondOwner.getRegion('existing')).to.equal(existingRegion);
      expect(secondOwner.hasRegion('second')).to.be.false;
      expect(secondOwner.regions.existing).to.equal(existingRegion);
      expect(secondOwner.regions).to.not.have.own.property('second');
    } finally {
      replacementRegion.destroy();
      firstOwner.destroy();
      secondOwner.destroy();
    }
  });

  it('treats the existing owner and name registration as an idempotent no-op', function() {
    const owner = new View();
    const ownedRegion = owner.addRegion('content', new Region({ el: '.content' }));
    const beforeAdd = this.sinon.spy();
    const add = this.sinon.spy();
    owner.on('before:add:region', beforeAdd);
    owner.on('add:region', add);

    try {
      expect(owner.addRegion('content', ownedRegion)).to.equal(ownedRegion);
      expect(owner.getRegion('content')).to.equal(ownedRegion);
      expect(ownedRegion.getOwner()).to.equal(owner);
      expect(ownedRegion.getName()).to.equal('content');
      expect(beforeAdd).to.not.have.been.called;
      expect(add).to.not.have.been.called;
    } finally {
      owner.destroy();
    }
  });

  it('keeps mixed batch events isolated from an identical registration no-op', function() {
    const owner = new View();
    const ownedRegion = owner.addRegion('content', new Region({ el: '.content' }));
    const sidebarRegion = new Region({ el: '.sidebar' });
    const beforeAdd = this.sinon.spy();
    const add = this.sinon.spy();
    owner.on('before:add:region', beforeAdd);
    owner.on('add:region', add);

    try {
      const regions = owner.addRegions({
        content: ownedRegion,
        sidebar: sidebarRegion,
      });

      expect(regions.content).to.equal(ownedRegion);
      expect(regions.sidebar).to.equal(sidebarRegion);
      expect(beforeAdd).to.have.been.calledOnceWith(owner, 'sidebar', sidebarRegion);
      expect(add).to.have.been.calledOnceWith(owner, 'sidebar', sidebarRegion);
    } finally {
      owner.destroy();
    }
  });

  it('rejects a plain definition for an occupied batch name before mutation', function() {
    const owner = new View();
    const ownedRegion = owner.addRegion('content', new Region({ el: '.content' }));
    const validRegion = new Region({ el: '.valid' });

    try {
      expect(() => owner.addRegions({
        valid: validRegion,
        content: '.replacement',
      }))
        .to.throw(MarionetteError).and.include({
          code: 'MN0030',
          name: 'RegionError',
          message: 'Region name "content" is already registered.',
        });
      expect(owner.getRegion('content')).to.equal(ownedRegion);
      expect(owner.regions.content).to.equal(ownedRegion);
      expect(owner.hasRegion('valid')).to.be.false;
      expect(owner.regions).to.not.have.own.property('valid');
    } finally {
      validRegion.destroy();
      owner.destroy();
    }
  });

  it('keeps a reentrant identical registration authoritative without a duplicate add event', function() {
    const owner = new View();
    const region = new Region({ el: '.content' });
    const add = this.sinon.spy();
    owner.on('add:region', add);
    owner.once('before:add:region', (currentOwner, name, currentRegion) => {
      expect(currentOwner.addRegion(name, currentRegion)).to.equal(currentRegion);
    });

    try {
      expect(owner.addRegion('content', region)).to.equal(region);
      expect(owner.getRegion('content')).to.equal(region);
      expect(region.getOwner()).to.equal(owner);
      expect(region.getName()).to.equal('content');
      expect(add).to.have.been.calledOnceWith(owner, 'content', region);
    } finally {
      owner.destroy();
    }
  });

  it('rejects duplicate Region instances in one registration batch with MN0030', function() {
    const duplicateRegion = new Region({ el: '.content' });

    try {
      expect(() => view.addRegions({ first: duplicateRegion, second: duplicateRegion }))
        .to.throw(MarionetteError).and.include({
          code: 'MN0030',
          name: 'RegionError',
          message: 'A Region instance cannot be registered under more than one name.',
        });
      expect(view.hasRegion('first')).to.be.false;
      expect(view.hasRegion('second')).to.be.false;
      expect(view.regions).to.not.have.own.property('first');
      expect(view.regions).to.not.have.own.property('second');
    } finally {
      duplicateRegion.destroy();
    }
  });

  it('rejects a Region adopted by another owner during before:add:region', function() {
    const firstOwner = new View();
    const secondOwner = new View();
    const contestedRegion = new Region({ el: '.content' });

    const firstOwnerAdd = this.sinon.spy();
    firstOwner.on('add:region', firstOwnerAdd);
    firstOwner.once('before:add:region', () => {
      secondOwner.addRegion('winner', contestedRegion);
    });

    try {
      expect(() => firstOwner.addRegion('contested', contestedRegion))
        .to.throw(MarionetteError).and.include({
          code: 'MN0030',
          name: 'RegionError',
        });
      expect(firstOwner.hasRegion('contested')).to.be.false;
      expect(firstOwner.regions).to.not.have.own.property('contested');
      expect(secondOwner.getRegion('winner')).to.equal(contestedRegion);
      expect(contestedRegion.getOwner()).to.equal(secondOwner);
      expect(contestedRegion.getName()).to.equal('winner');
      expect(firstOwnerAdd).to.not.have.been.called;
    } finally {
      firstOwner.destroy();
      secondOwner.destroy();
    }
  });

  it('keeps a same-View reentrant registration authoritative', function() {
    const owner = new View();
    const outerRegion = new Region({ el: '.outer' });
    const innerRegion = new Region({ el: '.inner' });

    owner.once('before:add:region', (currentOwner, name) => {
      currentOwner.addRegion(name, innerRegion);
    });

    try {
      expect(() => owner.addRegion('content', outerRegion))
        .to.throw(MarionetteError).and.include({
          code: 'MN0030',
          name: 'RegionError',
          message: 'Region name "content" is already registered.',
        });
      expect(owner.getRegion('content')).to.equal(innerRegion);
      expect(owner.regions.content).to.equal(innerRegion);
      expect(innerRegion.getOwner()).to.equal(owner);
      expect(innerRegion.getName()).to.equal('content');
      expect(outerRegion.getOwner()).to.be.undefined;
      expect(outerRegion.getName()).to.be.undefined;
    } finally {
      outerRegion.destroy();
      owner.destroy();
    }
  });

  it('keeps earlier registrations when a later batch entry conflicts reentrantly', function() {
    const firstOwner = new View();
    const secondOwner = new View();
    const firstRegion = new Region({ el: '.first' });
    const contestedRegion = new Region({ el: '.second' });
    const laterRegion = new Region({ el: '.third' });

    firstOwner.once('before:add:region', (owner, name) => {
      if (name === 'first') {
        secondOwner.addRegion('winner', contestedRegion);
      }
    });

    try {
      expect(() => firstOwner.addRegions({
        first: firstRegion,
        second: contestedRegion,
        third: laterRegion,
      })).to.throw(MarionetteError).and.include({
        code: 'MN0030',
        name: 'RegionError',
      });
      expect(firstRegion.isDestroyed()).to.be.false;
      expect(firstOwner.getRegion('first')).to.equal(firstRegion);
      expect(firstOwner.hasRegion('second')).to.be.false;
      expect(firstOwner.hasRegion('third')).to.be.false;
      expect(firstOwner.regions.first).to.equal(firstRegion);
      expect(firstOwner.regions).to.not.have.own.property('second');
      expect(firstOwner.regions).to.not.have.own.property('third');
      expect(secondOwner.getRegion('winner')).to.equal(contestedRegion);
      expect(contestedRegion.getOwner()).to.equal(secondOwner);
    } finally {
      laterRegion.destroy();
      firstOwner.destroy();
      secondOwner.destroy();
    }
  });

  it('keeps earlier registrations when a later batch definition is invalid', function() {
    const owner = new View();
    const firstRegion = new Region({ el: '.first' });
    const laterRegion = new Region({ el: '.third' });

    try {
      expect(() => owner.addRegions({
        first: firstRegion,
        invalid: undefined,
        third: laterRegion,
      })).to.throw(MarionetteError).and.include({
        code: 'MN0008',
        name: 'Error',
      });
      expect(owner.getRegion('first')).to.equal(firstRegion);
      expect(owner.regions.first).to.equal(firstRegion);
      expect(owner.hasRegion('invalid')).to.be.false;
      expect(owner.hasRegion('third')).to.be.false;
      expect(owner.regions).to.not.have.own.property('invalid');
      expect(owner.regions).to.not.have.own.property('third');
    } finally {
      laterRegion.destroy();
      owner.destroy();
    }
  });

  it('rejects a destroyed Region with MN0030', function() {
    const destroyedRegion = new Region({ el: '.content' });
    destroyedRegion.destroy();

    expect(() => view.addRegion('destroyed', destroyedRegion))
      .to.throw(MarionetteError).and.include({
        code: 'MN0030',
        name: 'RegionError',
        message: 'A destroying or destroyed Region cannot be registered.',
      });
    expect(view.hasRegion('destroyed')).to.be.false;
  });

  it('rejects a destroying Region with MN0030', function() {
    const destroyingRegion = new Region({ el: '.content' });

    destroyingRegion.once('before:destroy', currentRegion => {
      expect(() => view.addRegion('destroying', currentRegion))
        .to.throw(MarionetteError).and.include({
          code: 'MN0030',
          name: 'RegionError',
        });
      expect(view.hasRegion('destroying')).to.be.false;
      expect(view.regions).to.not.have.own.property('destroying');
    });

    destroyingRegion.destroy();
  });

  it('rejects an owned Region from another owner while destruction begins', function() {
    const firstOwner = new View();
    const secondOwner = new View();
    const destroyingRegion = firstOwner.addRegion('owned', new Region({ el: '.content' }));

    destroyingRegion.once('before:destroy', currentRegion => {
      expect(() => secondOwner.addRegion('destroying', currentRegion))
        .to.throw(MarionetteError).and.include({
          code: 'MN0030',
          name: 'RegionError',
        });
      expect(secondOwner.hasRegion('destroying')).to.be.false;
    });

    try {
      destroyingRegion.destroy();
      expect(firstOwner.hasRegion('owned')).to.be.false;
    } finally {
      firstOwner.destroy();
      secondOwner.destroy();
    }
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

  it('rejects invalid Region names without coercion across named operations', function() {
    const toPrimitive = this.sinon.stub().returns('content');
    const objectName = { [Symbol.toPrimitive]: toPrimitive };
    const invalidNames = ['', undefined, null, 0, ['content'], objectName, Symbol('content')];
    const operations = [
      ['addRegion', name => view.addRegion(name, '.content')],
      ['getRegion', name => view.getRegion(name)],
      ['hasRegion', name => view.hasRegion(name)],
      ...requiredOperations.map(([method, operation]) => [method, name => operation(view, name)]),
    ];

    for (const name of invalidNames) {
      for (const [, operation] of operations) {
        expectInvalidRegionNameError(() => operation(name));
      }
    }

    expect(toPrimitive).to.not.have.been.called;
    expect(view.getRegion('content')).to.be.instanceOf(Region);
  });

  it('rejects invalid child Region names before rendering', function() {
    this.sinon.spy(view, 'render');

    for (const [, operation] of childOperations) {
      expectInvalidOperation(view, operation);
    }

    expect(view.render).to.not.have.been.called;
    expect(view.isRendered()).to.be.false;
  });

  it('rejects an empty declarative Region name before changing the batch', function() {
    const validRegion = new Region({ el: '.content' });

    try {
      expectInvalidRegionNameError(() => view.addRegions({
        valid: validRegion,
        '': '@ui.missing',
      }));
      expect(view.hasRegion('valid')).to.be.false;
      expect(validRegion.getOwner()).to.be.undefined;
    } finally {
      validRegion.destroy();
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
