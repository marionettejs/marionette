import 'marionette';
export function createSession(acquire, onMessage) {
  let generation = 0;
  let current;
  let unsubscribe;
  let destroyed = false;
  const stop = () => {
    generation++;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = undefined;
    }
    if (current) {
      current.close();
      current = undefined;
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
      unsubscribe = provider.subscribe(onMessage);
      return true;
    },
    stop,
    destroy() {
      destroyed = true;
      stop();
    }
  };
}
