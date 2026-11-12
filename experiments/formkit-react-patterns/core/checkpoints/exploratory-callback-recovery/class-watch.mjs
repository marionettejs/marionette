// Synchronous terminal-safe variant of FormKit observer.watch's public primitive
// sequence. Unlike upstream watch, do not touch a proxy revoked by a callback.
import { applyListeners, diffDeps, isKilled } from '@formkit/observer';
const terminal = Symbol('terminal class observation');
export function assertClassAlive(observer) { if (isKilled(observer)) throw terminal; }
export function watchClass(observer, block) {
  const run = () => {
    if (isKilled(observer)) return;
    const old = observer.observe();
    try { block(observer); } catch (error) { if (error === terminal) return; throw error; }
    if (isKilled(observer)) return;
    applyListeners(observer, diffDeps(old, observer.stopObserve()), run);
  };
  run();
}
