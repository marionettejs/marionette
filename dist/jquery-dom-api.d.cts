import 'jquery';

declare const JQueryDomApi: {
  findEl<TElement extends Element = HTMLElement>(
    el: Element | Document,
    selector: string,
  ): JQuery<TElement>;
  detachEl(el: Element): void;
  setContents(el: Element, html: string): void;
  appendContents(
    el: Element | DocumentFragment,
    contents: Element | DocumentFragment | string,
  ): void;
  detachContents(el: Element): void;
};

export = JQueryDomApi;
