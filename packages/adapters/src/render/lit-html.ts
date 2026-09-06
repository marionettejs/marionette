import { nothing, render } from 'lit-html';
import type { RenderRootNode, RootPart } from 'lit-html';

interface LitView {
  isAttached(): boolean;
  on(name: string, callback: () => void): unknown;
  off(name: string, callback: () => void): unknown;
}

interface LitViewClass {
  setDomApi(api: { setContents: typeof setContents; disposeContents: typeof disposeContents }): unknown;
}

interface LitContents {
  view?: LitView;
  part: RootPart;
  end: Comment;
  attach(): void;
  detach(): void;
}

const contents = new WeakMap<Element, LitContents>();

function clearPart(current: LitContents): void {
  const parent = current.end.parentNode as RenderRootNode;
  try {
    render(nothing, parent, { renderBefore: current.end });
  } finally {
    // The adapter owns the root contents, including Lit's markers.
    parent.replaceChildren();
  }
}

function disposeContents(el: Element): void {
  const current = contents.get(el);
  if (!current) { return; }

  contents.delete(el);
  const { view } = current;
  view?.off('attach', current.attach);
  view?.off('detach', current.detach);
  try {
    current.part.setConnected(false);
  } catch (error) {
    try {
      clearPart(current);
    } catch {
      // A later directive cleanup must not replace the first failure.
    }
    throw error;
  }
  clearPart(current);
}

function setContents(el: Element, value: unknown, view?: LitView): void {
  let current = contents.get(el);

  if (!current) {
    const end = el.ownerDocument.createComment('');
    el.replaceChildren(end);
    const part = render(nothing, el as RenderRootNode, {
      host: view, isConnected: view ? view.isAttached() : el.isConnected, renderBefore: end
    });
    current = {
      view, part, end,
      attach: () => part.setConnected(true),
      detach: () => part.setConnected(false)
    };
    contents.set(el, current);
    view?.on('attach', current.attach);
    view?.on('detach', current.detach);
  }

  render(value, el as RenderRootNode, { renderBefore: current.end });
}

// Configure rendering and DOM disposal through the public class APIs.
export default function setLitHtmlRenderer<Class extends LitViewClass>(ViewClass: Class): Class {
  ViewClass.setDomApi({ setContents, disposeContents });
  return ViewClass;
}
