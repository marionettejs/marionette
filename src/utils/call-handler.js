// An optimized way to execute callbacks.
export default function callHandler(callback, context, args = []) {
  switch (args.length) {
    case 0: return callback.call(context);
    case 1: return callback.call(context, args[0]);
    case 2: return callback.call(context, args[0], args[1]);
    case 3: return callback.call(context, args[0], args[1], args[2]);
    default: return callback.apply(context, args);
  }
}
