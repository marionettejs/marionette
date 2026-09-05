// Broad option types and unresolved numeric property aliases cannot prove absence.
type Read<Source, Key extends PropertyKey> = unknown extends Source ? unknown :
  Source extends null | undefined ? undefined : Source extends object ?
    keyof Source extends never ? unknown : Key extends keyof Source ? Source[Key] |
      (string extends keyof Source ? undefined : number extends keyof Source ? undefined :
        symbol extends keyof Source ? undefined : never) :
      number extends keyof Source ? unknown : Key extends number | `${number}` ? unknown : undefined
    : unknown;
type GetOptionResult<Receiver, Name> = Name extends '' | 0 | 0n | false | null | undefined ? undefined :
  Name extends PropertyKey ? Name extends keyof Receiver | keyof NonNullable<Read<Receiver, 'options'>>
    ? Exclude<Read<Read<Receiver, 'options'>, Name>, undefined> |
      (undefined extends Read<Read<Receiver, 'options'>, Name> ? Read<Receiver, Name> : never)
    : unknown : never;

// The implementation reads arbitrary properties without caching option getters.
type OptionContext = Record<PropertyKey, unknown> & { options?: Record<PropertyKey, unknown> };

// Marionette.getOption
// --------------------

// Retrieve an object, function or other value from the
// object or its `options`, with `options` taking precedence.
function getOption(optionName?: '' | 0 | 0n | false | null): undefined;
function getOption<Receiver extends object, Name extends PropertyKey | 0n | false | null | undefined>(
  this: Receiver, optionName: Name
): GetOptionResult<Receiver, Name>;
function getOption(this: object, optionName: PropertyKey | 0n | false | null | undefined): unknown;
function getOption(this: unknown, optionName?: PropertyKey | 0n | false | null): unknown {
  if (!optionName) { return; }
  const context = this as OptionContext;
  if (context.options && (context.options[optionName] !== undefined)) {
    return context.options[optionName];
  } else {
    return context[optionName];
  }
}

export default getOption;
