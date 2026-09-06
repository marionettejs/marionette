import { nothing, render } from 'lit-html';
import type { RenderRootNode, RootPart } from 'lit-html';

interface LitView {
  el: Element;
  isAttached(): boolean;
  isDestroyed(): boolean;
  setElement(element: Element): unknown;
  destroy(options?: unknown): unknown;
  on(name: string, callback: () => void): unknown;
  off(name: string, callback: () => void): unknown;
}

interface LitViewClass {
  prototype: LitView;
  setRenderer(renderer: (this: LitView, template: (data: unknown) => unknown, data: unknown) => void): unknown;
}

interface LitContents {
  part: RootPart;
  end: Comment;
  attach(): void;
  detach(): void;
}

const contents = new WeakMap<LitView, LitContents>();
const installed = new WeakSet<object>();

function clearPart(current: LitContents): void {
  const parent = current.end.parentNode as RenderRootNode;
  try {
    render(nothing, parent, { renderBefore: current.end });
  } finally {
    // The adapter owns the root contents, including Lit's markers.
    parent.replaceChildren();
  }
}

function clearContents(view: LitView): void {
  const current = contents.get(view);
  if (!current) { return; }

  contents.delete(view);
  view.off('attach', current.attach);
  view.off('detach', current.detach);
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

function renderLitHtml(this: LitView, template: (data: unknown) => unknown, data: unknown): void {
  const value = template(data);
  let current = contents.get(this);

  if (!current) {
    const end = this.el.ownerDocument.createComment('');
    this.el.replaceChildren(end);
    const part = render(nothing, this.el as RenderRootNode, {
      host: this, isConnected: this.isAttached(), renderBefore: end
    });
    current = {
      part, end,
      attach: () => part.setConnected(true),
      detach: () => part.setConnected(false)
    };
    contents.set(this, current);
    this.on('attach', current.attach);
    this.on('detach', current.detach);
  }

  render(value, this.el as RenderRootNode, { renderBefore: current.end });
}

// Lit directives own resources, so install their lifetime with the renderer.
// Call on a View subclass before creating its instances.
export default function setLitHtmlRenderer<Class extends LitViewClass>(ViewClass: Class): Class {
  if (installed.has(ViewClass)) { return ViewClass; }

  const prototype = ViewClass.prototype as LitView & { _rollbackView(error: unknown): void };
  const { setElement, destroy, _rollbackView } = prototype;
  ViewClass.prototype.setElement = function(element) {
    const previous = this.el;
    const result = setElement.call(this, element);
    if (this.el !== previous) { clearContents(this); }
    return result;
  };
  ViewClass.prototype.destroy = function(options) {
    let result;
    try {
      result = destroy.call(this, options);
    } catch (error) {
      if (this.isDestroyed()) {
        try {
          clearContents(this);
        } catch {
          // Preserve the destroy error when directive cleanup also fails.
        }
      }
      throw error;
    }
    if (this.isDestroyed()) { clearContents(this); }
    return result;
  };
  prototype._rollbackView = function(error) {
    try {
      return _rollbackView.call(this, error);
    } finally {
      try {
        clearContents(this);
      } catch {
        // Construction rollback preserves the original construction error.
      }
    }
  };
  ViewClass.setRenderer(renderLitHtml);
  installed.add(ViewClass);
  return ViewClass;
}
