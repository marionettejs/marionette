export function publishDraftRelease({ editArgs, ensureTag, run, verifyAssets = () => {} }) {
  verifyAssets();
  ensureTag();
  run(editArgs);
}
