import { setProperty } from '../../utils/assign-in.js';

const MAX_ARRAY_INDEX = Number.MAX_SAFE_INTEGER;
const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

const eachRequestedKey = function(keys, iteratee) {
  if (keys == null) { return; }

  const candidateLength = keys.length;
  if (typeof candidateLength === 'number' && candidateLength >= 0 && candidateLength <= MAX_ARRAY_INDEX) {
    const length = keys.length;
    for (let index = 0; index < length; index++) {
      iteratee(keys[index]);
    }
    return;
  }

  const names = Object.keys(keys);
  for (const name of names) {
    iteratee(keys[name]);
  }
};

// Merge `keys` from `options` onto `this`
const mergeOptions = function(options, keys) {
  if (!options) { return; }

  eachRequestedKey(keys, (key) => {
    if (typeof key !== 'string' || !propertyIsEnumerable.call(options, key)) { return; }

    const option = options[key];
    if (option !== undefined) {
      setProperty(this, key, option);
    }
  });
};

export default mergeOptions;
