import morphdom from 'morphdom';

// The CommonJS package declares an ESM default instead of its callable export.
const morph = morphdom as unknown as typeof import('morphdom').default;

// Morph the contents, leaving the View's root and delegated events in place.
function renderMorphdom<Data>(
  this: { el: Element }, template: (data: Data) => string, data: Data
): void {
  const contents = this.el.cloneNode(false) as Element;
  contents.innerHTML = template(data);
  morph(this.el, contents, { childrenOnly: true });
}

interface MorphdomViewClass {
  setRenderer(renderer: typeof renderMorphdom): unknown;
}

// Morphdom needs only the renderer; preserve the class's existing DomApi.
export default function setMorphdomRenderer<Class extends MorphdomViewClass>(ViewClass: Class): Class {
  ViewClass.setRenderer(renderMorphdom);
  return ViewClass;
}
