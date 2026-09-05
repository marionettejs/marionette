import { setProperty } from '../../utils/assign-in.js';
import MarionetteError from '../error.js';

const propertyIsEnumerable = Object.prototype.propertyIsEnumerable;

// Merge `keys` from `options` onto `this`
const mergeOptions = function(options, keys) {
  if (options == null) { return; }

  if (!Array.isArray(keys)) {
    throw new MarionetteError({
      code: 'MN0033',
      message: 'The mergeOptions keys argument must be an array.',
      url: 'common.html#mergeoptions'
    });
  }

  const length = keys.length;
  for (let index = 0; index < length; index++) {
    const key = keys[index];
    if (typeof key !== 'string' || !propertyIsEnumerable.call(options, key)) { continue; }

    const option = options[key];
    if (option !== undefined) {
      setProperty(this, key, option);
    }
  }
};

export default mergeOptions;
