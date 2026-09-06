import { nothing, render } from 'lit-html';
import type { RenderRootNode, RootPart } from 'lit-html';

interface LitContents {
  part: RootPart;
  end: Comment;
}

const contents = new WeakMap<Element, LitContents>();

export default {
  setContents(el: Element, value: unknown): void {
    let current = contents.get(el);

    if (!current) {
      const end = el.ownerDocument.createComment('');
      el.replaceChildren(end);
      // Retain the part before user directives run so teardown can disconnect
      // subscriptions even if the first content render throws.
      const part = render(nothing, el as RenderRootNode, {
        isConnected: el.isConnected, renderBefore: end
      });
      current = { part, end };
      contents.set(el, current);
    }

    render(value, el as RenderRootNode, { renderBefore: current.end });
  },

  onAttach(el: Element): void {
    contents.get(el)?.part.setConnected(true);
  },

  onDetach(el: Element): void {
    contents.get(el)?.part.setConnected(false);
  }
};
