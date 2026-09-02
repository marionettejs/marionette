

function createDebug() {
  // Debug mode warns about overwritten or unhandled requests.
  let shouldDebug = false;

  function setDebug(setShouldDebug = true) {
    shouldDebug = setShouldDebug;
  }

  function debugLog(warning, eventName, channelName) {
    if (shouldDebug && console && console.warn) {
      console.warn(debugText(warning, eventName, channelName));
    }
  }

  return { debugLog, setDebug };
}

// Format debug text.
function debugText(warning, eventName, channelName) {
  return warning + (channelName ? ` on the ${ channelName } channel` : '') +
    `: "${ eventName }"`;
}

const { debugLog, setDebug } = createDebug();

// Log information about the channel and event
function log(channelName, eventName, ...args) {
  /* v8 ignore next: the supported test/runtime environments provide console */
  if (typeof console === 'undefined') { return; }
  console.log(`[${ channelName }] "${ eventName }"`, args);
}

export {
  createDebug,
  setDebug,
  debugLog,
  log,
};
