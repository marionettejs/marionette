import morphdom from 'morphdom';

// The CommonJS package declares an ESM default instead of its callable export.
const morph = morphdom as unknown as typeof import('morphdom').default;

// Install empty contents directly; diff subsequent updates within the same root.
function setContents(el: Element, html: string | null | undefined): void {
  if (!el.hasChildNodes()) {
    el.innerHTML = html ?? '';
    return;
  }

  const contents = el.cloneNode(false) as Element;
  contents.innerHTML = html ?? '';
  morph(el, contents, { childrenOnly: true });
}

interface MorphdomViewClass {
  setDomApi(api: { setContents: typeof setContents }): unknown;
}

export default function setMorphdomRenderer<Class extends MorphdomViewClass>(ViewClass: Class): Class {
  ViewClass.setDomApi({ setContents });
  return ViewClass;
}
