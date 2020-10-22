// Static setter for the renderer
export function setRenderer(renderer) {
  this.prototype._renderHtml = renderer;
  return this;
}
