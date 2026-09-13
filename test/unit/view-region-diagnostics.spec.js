import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MarionetteError, Region, View } from 'marionette';

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
  expectInvalidRegionNameError(() => operation(view, ''));
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

  it('rejects ownership and name conflicts with MN0030 before changing ownership', function() {
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
      expect(secondOwner.hasRegion('second')).toBe(false);
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

    try {
      expect(owner.addRegion('content', ownedRegion)).to.equal(ownedRegion);
      expect(owner.getRegion('content')).to.equal(ownedRegion);
      expect(ownedRegion.getOwner()).to.equal(owner);
      expect(ownedRegion.getName()).to.equal('content');
    } finally {
      owner.destroy();
    }
  });

  it('preserves existing ownership when adding a mixed batch of Regions', function() {
    const owner = new View();
    const ownedRegion = owner.addRegion('content', new Region({ el: '.content' }));
    const sidebarRegion = new Region({ el: '.sidebar' });

    try {
      const regions = owner.addRegions({
        content: ownedRegion,
        sidebar: sidebarRegion,
      });

      expect(regions.content).to.equal(ownedRegion);
      expect(regions.sidebar).to.equal(sidebarRegion);
      expect(ownedRegion.getOwner()).to.equal(owner);
      expect(ownedRegion.getName()).to.equal('content');
      expect(sidebarRegion.getOwner()).to.equal(owner);
      expect(sidebarRegion.getName()).to.equal('sidebar');
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
      expect(owner.hasRegion('valid')).toBe(false);
      expect(owner.regions).to.not.have.own.property('valid');
    } finally {
      validRegion.destroy();
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
      expect(view.hasRegion('first')).toBe(false);
      expect(view.hasRegion('second')).toBe(false);
      expect(view.regions).to.not.have.own.property('first');
      expect(view.regions).to.not.have.own.property('second');
    } finally {
      duplicateRegion.destroy();
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
    expect(view.hasRegion('destroyed')).toBe(false);
  });

  it('rejects a destroying Region with MN0030', function() {
    const destroyingRegion = new Region({ el: '.content' });

    destroyingRegion.once('before:destroy', currentRegion => {
      expect(() => view.addRegion('destroying', currentRegion))
        .to.throw(MarionetteError).and.include({
          code: 'MN0030',
          name: 'RegionError',
        });
      expect(view.hasRegion('destroying')).toBe(false);
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
      expect(secondOwner.hasRegion('destroying')).toBe(false);
    });

    try {
      destroyingRegion.destroy();
      expect(firstOwner.hasRegion('owned')).toBe(false);
    } finally {
      firstOwner.destroy();
      secondOwner.destroy();
    }
  });

  it('keeps Region lookup optional and distinguishes a known empty Region', function() {
    expect(view.getRegion('missing')).toBeUndefined();
    expect(view.hasRegion('missing')).toBe(false);
    expect(view.getChildView('content')).toBeUndefined();
    expect(view.detachChildView('content')).toBeUndefined();
  });

  it('treats inherited object property names as missing across optional and required operations', function() {
    expect(view.getRegion('toString')).toBeUndefined();
    expect(view.hasRegion('toString')).toBe(false);

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
      expect(ownRegionView.hasRegion('toString')).toBe(true);
      expect(ownRegionView.getChildView('toString')).toBeUndefined();
      expect(ownRegionView.detachChildView('toString')).toBeUndefined();
      expect(ownRegionView.showChildView('toString', childView)).to.equal(childView);
      expect(ownRegionView.getChildView('toString')).to.equal(childView);
      expect(ownRegionView.detachChildView('toString')).to.equal(childView);
      expect(ownRegionView.showChildView('toString', childView)).to.equal(childView);
      expect(ownRegionView.removeRegion('toString')).to.equal(region);
      expect(childView.isDestroyed()).toBe(true);
      expect(ownRegionView.getRegion('toString')).toBeUndefined();
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
      expect(ownRegionView.hasRegion('__proto__')).toBe(true);
      expect(ownRegionView.removeRegion('__proto__')).to.equal(region);
      expect(ownRegionView.getRegion('__proto__')).toBeUndefined();
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
      expect(firstChild.isDestroyed()).toBe(true);
      expect(region.isDestroyed()).toBe(false);

      region.show(secondChild);
      expect(protoView.removeRegions()).to.have.own.property('__proto__', region);
      expect(region.isDestroyed()).toBe(true);
      expect(secondChild.isDestroyed()).toBe(true);
    } finally {
      firstChild.destroy();
      secondChild.destroy();
      protoView.destroy();
    }
  });

  it('rejects empty Region names across named operations', function() {
    const invalidNames = [''];
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

    expect(view.getRegion('content')).to.be.instanceOf(Region);
  });

  it('rejects empty child Region names before rendering', function() {
    vi.spyOn(view, 'render');

    for (const [, operation] of childOperations) {
      expectInvalidOperation(view, operation);
    }

    expect(view.render).not.toHaveBeenCalled();
    expect(view.isRendered()).toBe(false);
  });

  it('rejects an empty declarative Region name before changing the batch', function() {
    const validRegion = new Region({ el: '.content' });

    try {
      expectInvalidRegionNameError(() => view.addRegions({
        valid: validRegion,
        '': '@ui.missing',
      }));
      expect(view.hasRegion('valid')).toBe(false);
      expect(validRegion.getOwner()).toBeUndefined();
    } finally {
      validRegion.destroy();
    }
  });

  it('keeps required child operations routed through getRegion overrides', function() {
    const operations = requiredOperations.slice(0, 3);

    for (const [, operation] of operations) {
      const getRegion = vi.spyOn(view, 'getRegion').mockImplementation(() => undefined).mockReturnValue(undefined);

      expectMissingRegionError(view, 'alias', operation);
      expect(getRegion).toHaveBeenCalledTimes(1);
      expect(getRegion.mock.calls.map(args => args.slice(0, 1))).toContainEqual(['alias']);
      getRegion.mockRestore();
    }
  });
});
