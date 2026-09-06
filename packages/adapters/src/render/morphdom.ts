import morphdom from 'morphdom';

// The CommonJS package declares an ESM default instead of its callable export.
const morph = morphdom as unknown as typeof import('morphdom').default;

// Replace an empty root directly; morph subsequent updates within the same root.
export default {
  setContents(el: Element, html: string | null | undefined): void {
    if (!el.hasChildNodes()) {
      el.innerHTML = html ?? '';
      return;
    }

    const contents = el.cloneNode(false) as Element;
    contents.innerHTML = html ?? '';
    morph(el, contents, { childrenOnly: true });
  }
};
