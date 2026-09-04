export function isCoreRuntimeArtifact(path) {
  return typeof path === 'string' && !path.startsWith('packages/');
}
