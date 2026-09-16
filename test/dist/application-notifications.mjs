import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const [packageRoot, format] = process.argv.slice(2);
const require = createRequire(pathToFileURL(resolve(packageRoot, 'package.json')));
const packageJson = require('./package.json');
const { Application } = format === 'CommonJS' ? require('marionette') :
  await import(pathToFileURL(resolve(packageRoot, packageJson.exports['.'].import.default)));

// This subprocess owns its host rejection handler; the parent runner is untouched.
const unhandled = [];
const observe = (reason, promise) => unhandled.push({ reason, promise });
process.on('unhandledRejection', observe);
try {
  for (const operation of ['start', 'stop', 'destroy']) {
    const suffix = operation[0].toUpperCase() + operation.slice(1);
    const before = `onBefore${suffix}`;
    const event = `before:${operation}`;
    for (const kind of ['method', 'listener']) {
      const app = new Application();
      const error = new Error(`${format}:${operation}:${kind}`);
      let notification;
      const reject = () => { notification = Promise.reject(error); return notification; };
      try {
        if (operation === 'stop') { await app.start(); }
        if (kind === 'method') { app[before] = reject; } else { app.on(event, reject); }
        assert.equal(await app[operation](), true, 'notification rejection is not a readiness failure');
        await setImmediate();
        assert.deepEqual(unhandled.splice(0), [{ reason: error, promise: notification }],
          'notification rejection is left to the host, not silently swallowed');
        assert.equal(app.isRunning(), operation === 'start');
        assert.equal(app.isDestroyed(), operation === 'destroy');
      } finally {
        app[before] = undefined;
        app.off(event, reject);
        await app.destroy();
      }
    }

    const app = new Application();
    const prepare = `prepare${suffix}`;
    const error = new Error(`${format}:${operation}:preparation`);
    try {
      if (operation === 'stop') { await app.start(); }
      app[prepare] = () => Promise.reject(error);
      await assert.rejects(app[operation](), reason => reason === error);
      await setImmediate();
      assert.deepEqual(unhandled, [], 'preparation rejection belongs to the operation promise');
      assert.equal(app.isRunning(), operation === 'stop');
      assert.equal(app.isDestroyed(), false);
    } finally {
      app[prepare] = undefined;
      await app.destroy();
    }
  }
} finally {
  process.off('unhandledRejection', observe);
}
console.log(`${format}: Application notification and preparation rejection boundaries passed`);
