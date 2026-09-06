import { View, createMarionette } from 'marionette';
import { html } from 'lit-html';
import setMorphdomRenderer = require('@marionette/adapters/render/morphdom');
import setLitHtmlRenderer = require('@marionette/adapters/render/lit-html');

const MorphView = View.extend({
  template: () => '<p>morphdom</p>',
  label: 'morphdom'
});
const morphClass: typeof MorphView = setMorphdomRenderer(MorphView);
const morphView = new morphClass();
const label: string = morphView.label;
morphView.render().destroy();

const runtime = createMarionette();
const LitView = runtime.View.extend({ template: () => html`<p>lit</p>` });
const litClass: typeof LitView = setLitHtmlRenderer(LitView);
const litView = new litClass();
litView.render().setElement(document.createElement('article')).destroy();

class NativeView extends View {
  template = () => html`<p>native</p>`;
}
const nativeClass: typeof NativeView = setLitHtmlRenderer(NativeView);
new nativeClass().render().destroy();

// @ts-expect-error An installer takes a View class, not an instance.
setMorphdomRenderer(morphView);
// @ts-expect-error Lit also needs the DOM API setter.
setLitHtmlRenderer({ setRenderer() {} });

void label;
