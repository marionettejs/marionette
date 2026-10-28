import { nothing, render } from 'lit-html';
import type { RenderRootNode, RootPart } from 'lit-html';

interface LitContents {
  part: RootPart;
  end: Comment;
}

const contents = new WeakMap<Element, LitContents>();
// Adoption can notify attachment before the first content part exists.
const attached = new WeakSet<Element>();

export default {
  setContents(el: Element, value: unknown): void {
    let current = contents.get(el);

    if (!current) {
      const end = el.ownerDocument.createComment('');
      el.replaceChildren(end);
      // Retain the part before user directives run so teardown can disconnect
      // subscriptions even if the first content render throws.
      const part = render(nothing, el as RenderRootNode, {
        isConnected: attached.has(el), renderBefore: end
      });
      current = { part, end };
      contents.set(el, current);
    }

    render(value, el as RenderRootNode, { renderBefore: current.end });
  },

  notifyAttach(el: Element): void {
    attached.add(el);
    contents.get(el)?.part.setConnected(true);
  },

  notifyDetach(el: Element): void {
    attached.delete(el);
    contents.get(el)?.part.setConnected(false);
  }
};
