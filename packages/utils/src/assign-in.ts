type Signatures<Target> =
  (Target extends (...args: infer Args) => infer Result ? (this: ThisParameterType<Target>, ...args: Args) => Result : unknown) &
  (Target extends new (...args: infer Args) => infer Instance ? new(...args: Args) => Instance : unknown);
type AssignTarget<Target, Source> = [Extract<keyof Target, keyof Source>] extends [never]
  ? Target : Omit<Target, keyof Source> & Signatures<Target>;
type AssignSource<Target, Source> = AssignTarget<Target, Source> & {
  [Key in keyof Source]: {} extends Pick<Source, Key>
    ? Source[Key] | (Key extends keyof Target ? Target[Key] : never) : Source[Key];
};

type Assigned<Target, Sources extends readonly unknown[]> = Sources extends readonly [infer Source, ...infer Rest]
  ? Assigned<Source extends object ? AssignSource<Target, Pick<Source, Extract<keyof Source, string | number>>> : Target, Rest>
  : Target;

export function setProperty(target: unknown, key: unknown, value: unknown) {
  if (key === '__proto__') {
    Object.defineProperty(target, key as PropertyKey, {
      configurable: true,
      enumerable: true,
      value,
      writable: true
    });
  } else {
    (target as Record<PropertyKey, unknown>)[key as PropertyKey] = value;
  }
}

function assign<Target extends object>(target: Target, sources: readonly unknown[], ownOnly: boolean): Target {
  for (const source of sources) {
    const type = typeof source;
    if (source == null || type !== 'object' && type !== 'function') { continue; }

    for (const key in source) {
      if (ownOnly && !Object.hasOwn(source, key)) { continue; }
      setProperty(target, key, (source as Record<string, unknown>)[key]);
    }
  }

  return target;
}

export function assignOwn<Target extends object, Sources extends readonly unknown[]>(target: Target, ...sources: Sources): Assigned<Target, Sources> {
  return assign(target, sources, true) as Assigned<Target, Sources>;
}

export default function assignIn<Target extends object, Sources extends readonly unknown[]>(target: Target, ...sources: Sources): Assigned<Target, Sources> {
  return assign(target, sources, false) as Assigned<Target, Sources>;
}
