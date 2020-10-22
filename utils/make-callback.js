// If callback is not a function return the callback and flag it for removal
export default function makeCallback(callback) {
  if (typeof callback === 'function') {
    return callback;
  }
  const result = function() { return callback; };
  result._callback = callback;
  return result;
}
