import { CollectionView, View } from '../../src/index.ts';

function setup(kind, options) {
  const child = new View({ template: false });
  const parent = kind === 'View' ?
    new View({ template: () => '<section></section>', regions: { content: 'section' }, ...options }).render() :
    new CollectionView({ ...options }).render();
  if (kind === 'View') { parent.showChildView('content', child); } else { parent.addChildView(child); }
  return { parent, child };
}

for (const kind of ['View', 'CollectionView']) {
  describe(`${kind} child event map ownership`, function() {
    it('ignores inherited entries in event and trigger maps', function() {
      const inheritedHandler = sinon.spy();
      const { parent, child } = setup(kind, {
        childViewEvents: Object.create({ inherited: inheritedHandler }),
        childViewTriggers: Object.create({ inherited: 'unexpected' }),
      });
      const unexpected = sinon.spy();
      parent.on('unexpected', unexpected);
      try {
        for (const name of ['constructor', 'toString', '__proto__', 'inherited']) {
          expect(() => child.trigger(name, 'payload')).not.to.throw();
        }
        expect(inheritedHandler).not.to.have.been.called;
        expect(unexpected).not.to.have.been.called;
      } finally { parent.destroy(); }
    });

    it('dispatches explicitly owned special-name mappings with the parent receiver', function() {
      const handler = sinon.spy();
      const events = { ['__proto__']: handler, constructor: handler };
      const { parent, child } = setup(kind, {
        childViewEvents: events,
        childViewTriggers: { ['__proto__']: 'mapped', constructor: 'mapped' },
      });
      const mapped = sinon.spy();
      parent.on('mapped', mapped);
      try {
        child.trigger('__proto__', 'first');
        child.trigger('constructor', 'second');
        expect(handler).to.have.been.calledTwice;
        expect(handler.firstCall).to.have.been.calledOn(parent);
        expect(handler.firstCall).to.have.been.calledWithExactly('first');
        expect(mapped).to.have.been.calledTwice;
        expect(mapped.secondCall).to.have.been.calledWithExactly('second');
      } finally { parent.destroy(); }
    });
  });
}
