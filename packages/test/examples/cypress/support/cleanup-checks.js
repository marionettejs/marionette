const checks = [];

// Specs register observable assertions after the adapter's real teardown hook.
export function afterMountCleanup(check) { checks.push(check); }
export function checkMountCleanup() {
  for (const check of checks.splice(0)) { check(); }
}
