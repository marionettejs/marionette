import { View, createMarionette } from 'marionette';
import { html } from 'lit-html';
import MorphdomDomApi = require('@mnjs/adapters/dom/morphdom');
import LitDomApi = require('@mnjs/adapters/dom/lit-html');

const MorphView = View.extend({
  template: () => '<p>morphdom</p>',
  label: 'morphdom'
});
const morphClass: typeof MorphView = MorphView.setDomApi(MorphdomDomApi);
const morphView = new morphClass();
const label: string = morphView.label;
morphView.render().destroy();

const runtime = createMarionette();
const LitView = runtime.View.extend({ template: () => html`<p>lit</p>` });
const litClass: typeof LitView = LitView.setDomApi(LitDomApi);
const litView = new litClass();
litView.render().destroy();

class NativeView extends View {
  template = () => html`<p>native</p>`;
}
const nativeClass: typeof NativeView = NativeView.setDomApi(LitDomApi);
new nativeClass().render().destroy();

MorphdomDomApi.setContents(document.createElement('div'), undefined);
LitDomApi.setContents(document.createElement('div'), html`<p>direct</p>`);
LitDomApi.notifyAttach(document.createElement('div'));
LitDomApi.notifyDetach(document.createElement('div'));
// @ts-expect-error Morphdom takes HTML, not Lit template results.
MorphdomDomApi.setContents(document.createElement('div'), html`<p>invalid</p>`);
// @ts-expect-error DOM adapters receive an Element, not a View.
LitDomApi.notifyDetach(litView);
// @ts-expect-error An adapter is an object, not a class installer.
LitDomApi(LitView);

void label;
