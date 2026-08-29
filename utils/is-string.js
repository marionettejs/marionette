const getObjectTag = Function.call.bind(Object.prototype.toString);

export default function isString(value) {
  return getObjectTag(value) === '[object String]';
}
