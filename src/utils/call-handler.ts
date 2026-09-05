// An optimized way to execute callbacks.
export default function callHandler<Context, Args extends unknown[], Result>(
  callback: (this: Context, ...args: Args) => Result, context: Context, args: Args
): Result;
// Forwarded arguments carry no static information about their contents.
export default function callHandler<Context, Result>(
  callback: (this: Context, ...args: never[]) => Result, context: Context, args: IArguments
): Result;
export default function callHandler<Context, Result>(
  callback: (this: Context) => Result, context: Context
): Result;
export default function callHandler(callback: Function, context: unknown, args: unknown[] | IArguments = []): unknown {
  switch (args.length) {
    case 0: return callback.call(context);
    case 1: return callback.call(context, args[0]);
    case 2: return callback.call(context, args[0], args[1]);
    case 3: return callback.call(context, args[0], args[1], args[2]);
    default: return callback.apply(context, args);
  }
}
