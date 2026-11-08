import {html, svg, mathml, render, nothing, noChange, type HTMLTemplateResult, type RenderOptions} from '@mnjs/html';
import HtmlDomApi from '@mnjs/html/marionette';
import {AsyncDirective, directive} from '@mnjs/html/async-directive';
import {PartType, type PartInfo} from '@mnjs/html/directive';
import {repeat} from '@mnjs/html/directives/repeat.js';
import {until} from '@mnjs/html/directives/until.js';
import {createMarionette, type DomApiContract} from 'marionette';
const result: HTMLTemplateResult = html`<p>${'value'}</p>`;
const options: RenderOptions = {creationScope: document, renderBefore: null, isConnected: false};
render(result, document.body, options).setConnected(true);
render(html`${svg`<circle></circle>`}${mathml`<mn>2</mn>`}${nothing}${noChange}`,document.body);
class Subscription extends AsyncDirective { render(value:string) { return this.isConnected ? value : nothing; } }
const sub = directive(Subscription);
render(html`${sub('hello')}${repeat([1,2],x=>x,x=>html`${x}`)}${until(Promise.resolve('ready'),'wait')}`,document.body);
const adapter: Partial<DomApiContract> = HtmlDomApi;
const mn = createMarionette(); mn.setDomApi(adapter);
new mn.View({template:()=>html`<p>View</p>`}).render();
const part: PartInfo = {type:PartType.CHILD}; void part;
// @ts-expect-error EventPart was intentionally removed.
PartType.EVENT;
render(result, document.body, {host:{}}); // ref callback context, not event handlers
// @ts-expect-error directives retain argument type-checking.
sub(4);
// @ts-expect-error development policy hooks do not exist in the default build.
render.setSanitizer(() => value => value);
render.setSanitizer?.(() => value => value);
