export function publishDraftRelease({ editArgs, ensureTag, run }) {
  ensureTag();
  run(editArgs);
}
