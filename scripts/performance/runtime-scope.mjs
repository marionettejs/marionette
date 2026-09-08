export function isCoreRuntimeArtifact(path) {
  return typeof path === 'string' && !path.startsWith('packages/');
}

export function isDocumentationArtifact(path) {
  return path.startsWith('dist/docs/') || path.startsWith('dist/agent-skill/');
}
