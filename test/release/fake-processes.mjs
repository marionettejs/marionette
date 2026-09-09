// Preloaded only in CLI test subprocesses. Remote executable boundaries always
// launch the local fake, including on Windows where PATH shebangs are unsupported.
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { fileURLToPath } from 'node:url';

const spawnSync = childProcess.spawnSync;
// This preload is confined to isolated fake-registry subprocesses. Exercise
// every configured retry without waiting for real registry propagation.
const nativeSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (callback, delay, ...args) => nativeSetTimeout(callback, delay === 5000 ? 0 : delay, ...args);
const fake = fileURLToPath(new URL('./fake-external.mjs', import.meta.url));
childProcess.spawnSync = function(command, args, options = {}) {
  if (command === 'gh' || (command === 'git' && !['status', 'rev-parse', 'show'].includes(args[0]))) {
    return spawnSync(process.execPath, [fake, ...args], {
      ...options, env: { ...(options.env || process.env), RELEASE_TEST_TOOL: command },
    });
  }
  return spawnSync(command, args, options);
};
syncBuiltinESMExports();
