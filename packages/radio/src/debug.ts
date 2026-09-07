function createDebug() {
  let shouldDebug = false;
  const hooks = { debugLog: warn, log: logActivity };

  function setDebug(setShouldDebug = true) {
    shouldDebug = setShouldDebug;
  }

  function debugLog(warning: string, eventName: string, channelName?: string) {
    if (shouldDebug) {
      hooks.debugLog(warning, eventName, channelName);
    }
  }

  function log(channelName: string, eventName: string, ...args: unknown[]) {
    hooks.log(channelName, eventName, ...args);
  }

  return { hooks, setDebug, debugLog, log };
}

function warn(warning: string, eventName: string, channelName?: string) {
  console.warn(warning + (channelName ? ` on the ${ channelName } channel` : '') +
    `: "${ eventName }"`);
}

function logActivity(channelName: string, eventName: string, ...args: unknown[]) {
  console.log(`[${ channelName }] "${ eventName }"`, args);
}

const defaultDebug = createDebug();
const { setDebug, debugLog, log } = defaultDebug;

export { createDebug, defaultDebug, setDebug, debugLog, log };
