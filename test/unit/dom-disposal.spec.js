import { View, CollectionView } from '../../src/index.ts';

for (const Base of [View, CollectionView]) {
  describe(`${Base === View ? 'View' : 'CollectionView'} DOM disposal`, function() {
    it('releases only replaced and terminal roots, including an unrendered root', function() {
      const disposeContents = this.sinon.spy();
      const Child = Base.extend();
      Child.setDomApi({ disposeContents });
      const view = new Child();
      const previous = view.el;
      expect(disposeContents).not.to.have.been.called;
      view.setElement(previous);
      expect(disposeContents).not.to.have.been.called;
      const next = document.createElement('section');
      view.setElement(next);
      expect(disposeContents).to.have.been.calledOnce.and.calledWith(previous);
      view.destroy();
      view.destroy();
      expect(disposeContents).to.have.been.calledTwice;
      expect(disposeContents.lastCall.args).to.deep.equal([next]);
    });

    it('keeps content through cancelled destruction and disposes after destroy handlers', function() {
      const log = [];
      const failure = new Error('cancelled');
      const Child = Base.extend({
        onDestroy() { log.push('destroy'); }
      });
      Child.setDomApi({ disposeContents(el) { log.push('dispose'); el.replaceChildren(); } });
      const view = new Child();
      view.el.textContent = 'owned contents';
      const cancel = () => { throw failure; };
      view.on('before:destroy', cancel);
      expect(() => view.destroy()).to.throw(failure);
      expect(log).to.deep.equal([]);
      expect(view.el.textContent).to.equal('owned contents');
      view.off('before:destroy', cancel);
      view.destroy();
      expect(log).to.deep.equal(['destroy', 'dispose']);
      expect(view.el.childNodes.length).to.equal(0);
    });

    it('cleans the abandoned root after delegation fails and preserves that error', function() {
      const failure = new Error('delegation failed');
      const released = [];
      const Child = Base.extend();
      Child.setDomApi({ disposeContents(el) { released.push(el); throw new Error('cleanup failed'); } });
      const view = new Child();
      const old = view.el;
      const next = document.createElement('section');
      view.delegateEvents = () => { throw failure; };
      expect(() => view.setElement(next)).to.throw(failure);
      expect(view.el).to.equal(next);
      expect(released).to.deep.equal([old]);
    });

    it('preserves setup errors on a root that was not replaced', function() {
      const failure = new Error('delegation failed');
      const Child = Base.extend();
      const disposeContents = this.sinon.spy();
      Child.setDomApi({ disposeContents });
      const view = new Child();
      view.delegateEvents = () => { throw failure; };
      expect(() => view.setElement(view.el)).to.throw(failure);
      expect(disposeContents).not.to.have.been.called;
    });

    it('disposes a root on construction rollback while preserving the initialization error', function() {
      const failure = new Error('initialization failed');
      const el = document.createElement('article');
      const disposeContents = this.sinon.stub().throws(new Error('cleanup failed'));
      const Child = Base.extend({ initialize() { throw failure; } });
      Child.setDomApi({ disposeContents });
      expect(() => new Child({ el })).to.throw(failure);
      expect(disposeContents).to.have.been.calledOnce.and.calledWith(el);
    });
  });
}
