const eslintToolingArtifacts = new Set([
  'dist/eslint/index.cjs',
  'dist/eslint/index.js'
]);

export function isCoreRuntimeArtifact(path) {
  return typeof path === 'string' && !path.startsWith('packages/');
}

export function isDocumentationArtifact(path) {
  return path.startsWith('dist/docs/') || path.startsWith('dist/agent-skill/');
}

export function isToolingArtifact(path) {
  return eslintToolingArtifacts.has(path);
}

export function isToolingExport(packageName, subpath, runtimePaths) {
  return packageName === 'marionette' && subpath === './eslint' &&
    runtimePaths.length === eslintToolingArtifacts.size &&
    runtimePaths.every(path => eslintToolingArtifacts.has(path));
}
