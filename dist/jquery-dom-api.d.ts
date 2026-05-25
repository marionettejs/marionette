declare const JQueryDomApi: {
  findEl(el: Element, selector: string): any;
  detachEl(el: Element): void;
  setContents(el: Element, html: string): void;
  appendContents(el: Element, contents: Element | DocumentFragment | string): void;
  detachContents(el: Element): void;
  wrapEl(el: Element): any;
};

export default JQueryDomApi;
