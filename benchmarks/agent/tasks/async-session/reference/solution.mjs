import 'marionette';
export function createSession(acquire, onMessage) {
  let generation = 0;
  let current;
  let unsubscribe;
  let destroyed = false;
  const stop = () => {
    generation++;
    if (unsubscribe) {
      const release = unsubscribe;
      unsubscribe = undefined;
      release();
    }
    if (current) {
      const provider = current;
      current = undefined;
      provider.close();
    }
  };
  return {
    async start() {
      if (destroyed) {
        return false;
      }
      stop();
      const token = generation;
      const provider = await acquire();
      if (destroyed || token !== generation) {
        provider.close();
        return false;
      }
      current = provider;
      const release = provider.subscribe(onMessage);
      if (destroyed || token !== generation) {
        release();
        return false;
      }
      unsubscribe = release;
      return true;
    },
    stop,
    destroy() {
      destroyed = true;
      stop();
    }
  };
}
