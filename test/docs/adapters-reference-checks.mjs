// Outcomes for the actual optional-adapter reference examples.
export const assertions = {
  'packages-adapters-1': `
assert.equal(view.el.textContent, 'Archive');
assert.equal(BackboneApi.key(model), model.cid);
assert.equal(BackboneApi.serialize(model), model.attributes);
const collection = new Backbone.Collection([model]);
assert.deepEqual(BackboneApi.models(collection), [model]);
assert.notEqual(BackboneApi.models(collection), collection.models);
const delivered = [];
const dispose = BackboneApi.subscribe(model, 'change:label', (...args) => delivered.push(args));
model.set('label', 'Next');
assert.equal(delivered.length, 1);
assert.equal(delivered[0][0], model);
assert.equal(delivered[0][1], 'Next');
dispose(); dispose();
view.destroy();
model.set('label', 'After destruction');
assert.equal(delivered.length, 1);
assert.equal(view.el.textContent, 'Next');
assert.equal(model.get('label'), 'After destruction');
`,
  'packages-adapters-2': `
assert.equal(view.el.textContent, 'Archive');
assert.equal(ActorApi.key(actor), actor);
assert.equal(ActorApi.serialize(actor), actor.getSnapshot().context);
assert.equal(ActorApi.has(actor, 'label'), true);
assert.equal(ActorApi.get(actor, 'missing'), undefined);
view.destroy();
actor.send({ type: 'rename', label: 'Still active' });
assert.equal(actor.getSnapshot().context.label, 'Still active');
assert.equal(view.el.textContent, 'Archive');
actor.stop();
`,
  'packages-adapters-3': `
const litRoot = lit.el;
const litParagraph = lit.el.querySelector('p');
lit.message = 'Updated';
lit.render();
assert.equal(lit.el, litRoot);
assert.equal(lit.el.querySelector('p'), litParagraph);
assert.equal(litParagraph.textContent, 'Updated');
const morphRoot = morph.el;
const morphParagraph = morph.el.querySelector('p');
morph.template = () => '<p id="message">Updated</p>';
morph.render();
assert.equal(morph.el, morphRoot);
assert.equal(morph.el.querySelector('p'), morphParagraph);
assert.equal(morphParagraph.textContent, 'Updated');
lit.destroy(); morph.destroy();
`,
  'packages-adapters-4': `
assert.ok(button instanceof $);
assert.equal(button.attr('aria-label'), 'Open details');
let calls = 0;
button.on('click', () => calls++);
JQueryDomApi.detachContents(view.el);
assert.equal(view.el.childNodes.length, 0);
button.trigger('click');
assert.equal(calls, 1);
JQueryDomApi.appendContents(view.el, button);
assert.equal(view.el.firstChild, button[0]);
button.off();
view.destroy();
`,
  'packages-adapters-5': `
assert.equal(buttons.length, 1);
assert.equal(buttons[0].tagName, 'BUTTON');
assert.equal(typeof actorApi.subscribe, 'function');
assert.equal(typeof actorApi.models, 'undefined');
`
};
