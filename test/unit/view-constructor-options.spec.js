import Backbone from 'backbone';
import CollectionView from '../../src/modules/collection-view';
import View from '../../src/modules/view';

const viewTypes = [
  ['View', View],
  ['CollectionView', CollectionView]
];

describe.each(viewTypes)('%s constructor options', function(name, ViewType) {
  it('remain observable in preinitialize and win conflicting hook assignments', function() {
    const optionEl = document.createElement('article');
    const preinitializeEl = document.createElement('aside');
    const model = new Backbone.Model();
    const collection = new Backbone.Collection();
    const attributes = { title: 'constructor' };
    const optionHandler = this.sinon.stub();
    const preinitializeHandler = this.sinon.stub();
    const events = { click: optionHandler };
    let observedOptions;
    let observedValues;

    const TestView = ViewType.extend({
      preinitialize(options) {
        observedOptions = options;
        observedValues = {
          model: this.model,
          collection: this.collection,
          el: this.el,
          id: this.id,
          attributes: this.attributes,
          className: this.className,
          tagName: this.tagName,
          events: this.events
        };

        this.model = new Backbone.Model();
        this.collection = new Backbone.Collection();
        this.el = preinitializeEl;
        this.id = 'preinitialize-id';
        this.attributes = { title: 'preinitialize' };
        this.className = 'preinitialize-class';
        this.tagName = 'aside';
        this.events = { click: preinitializeHandler };
      }
    });
    const options = {
      model,
      collection,
      el: optionEl,
      id: 'constructor-id',
      attributes,
      className: 'constructor-class',
      tagName: 'article',
      events
    };

    const view = new TestView(options);

    expect(observedOptions).to.equal(options);
    expect(observedValues).to.deep.equal(options);
    expect(view.model).to.equal(model);
    expect(view.collection).to.equal(collection);
    expect(view.el).to.equal(optionEl);
    expect(view.id).to.equal(options.id);
    expect(view.attributes).to.equal(attributes);
    expect(view.className).to.equal(options.className);
    expect(view.tagName).to.equal(options.tagName);
    expect(view.events).to.equal(events);

    optionEl.dispatchEvent(new Event('click'));
    expect(optionHandler).to.have.been.calledOnce;
    expect(preinitializeHandler).to.not.have.been.called;
  });
});
