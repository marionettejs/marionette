

// Whether or not we're in debug mode or not. debug mode helps you
// get around the issues of lack of warnings when events are mis-typed.
let shouldDebug = false;

function setDebug(setShouldDebug = true) {
  shouldDebug = setShouldDebug;
}

// Format debug text.
function debugText(warning, eventName, channelName) {
  return warning + (channelName ? ` on the ${ channelName } channel` : '') +
    `: "${ eventName }"`;
}

// This is the method that's called when an unregistered event was called.
// By default, it logs warning to the console. By overriding this you could
// make it throw an Error, for instance. This would make firing a nonexistent event
// have the same consequence as firing a nonexistent method on an Object.
function debugLog(warning, eventName, channelName) {
  if (shouldDebug && console && console.warn) {
    console.warn(debugText(warning, eventName, channelName));
  }
}

// Log information about the channel and event
function log(channelName, eventName, ...args) {
  if (typeof console === 'undefined') { return; }
  console.log(`[${ channelName }] "${ eventName }"`, args);
}

export {
  setDebug,
  debugLog,
  log,
};
