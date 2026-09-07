export type Merge<Left, Right> = [Extract<keyof Left, keyof Right>] extends [never]
  ? Left & Right : Omit<Left, keyof Right> & Right;

// Unknown constructor results cannot promise an instance. An explicit generic
// receiver return preserves descendants; void/primitive returns declare ordinary construction.
type Returned<Result, Normal> = Result extends object ? Result : Normal;
export type Constructed<Props, Normal> = Props extends { constructor: infer Constructor }
  ? Constructor extends (...args: never[]) => unknown
    ? unknown extends ReturnType<Constructor> ? unknown
      : Constructor extends <Receiver extends ThisParameterType<Constructor> & object>(
          this: Receiver, ...args: Parameters<Constructor>
        ) => Receiver ? Normal : Returned<ReturnType<Constructor>, Normal>
    : Normal
  : Normal;

export interface CallableParent {
  (...args: never[]): unknown;
  prototype: object;
}
