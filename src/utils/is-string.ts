const getObjectTag = Function.call.bind(Object.prototype.toString);

export default function isString(value: unknown): boolean {
  return getObjectTag(value) === '[object String]';
}
