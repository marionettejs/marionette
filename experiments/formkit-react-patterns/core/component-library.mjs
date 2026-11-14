// Match official Vue/React factory precedence while keeping factories portable.
export function resolveComponentLibrary(node, components = {}, library) {
  return { ...components, ...node?.props?.definition?.library, ...library };
}
