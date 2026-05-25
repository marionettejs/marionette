declare const JQueryDomApi: {
  findEl(el: Element | Document, selector: string): any;
  detachEl(el: Element): void;
  setContents(el: Element, html: string): void;
  appendContents(el: Element | DocumentFragment, contents: Element | DocumentFragment | string): void;
  detachContents(el: Element): void;
};

export default JQueryDomApi;
