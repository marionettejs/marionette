export function decideNpmActions(npmStates) {
  const conflict = npmStates.find(({ state }) => state === 'conflict');
  if (conflict) {
    throw new Error(`${conflict.packageName} exists with different integrity.`);
  }

  return npmStates.map(({ packageEvidence, state }) => ({
    name: `${packageEvidence.id}_npm_action`,
    value: state === 'available' ? 'publish' : 'skip',
  }));
}
