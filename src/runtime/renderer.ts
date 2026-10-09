export type Renderer<Receiver = unknown, Template = unknown, Data = unknown, Output = unknown> =
  (this: Receiver, template: Template, data: Data) => Output;

interface RendererClass {
  prototype: { _renderHtml?: Renderer<never, never, never> };
}

// Static setter for the renderer
export function setRenderer<Receiver extends { prototype: object }>(
  this: Receiver, renderer?: Renderer<never, never, never>
): Receiver;
export function setRenderer<Receiver extends RendererClass>(
  this: Receiver, renderer?: Renderer<never, never, never>
): Receiver {
  this.prototype._renderHtml = renderer;
  return this;
}
