import type { Context, Derive, Fn } from "../core/types";

type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type Extended<T, R> = Simplify<Omit<T, keyof R> & R>;

export function extend<
  T extends object,
  R extends Record<string, unknown>,
  Params = unknown,
>(
  fields: {
    [K in keyof R]: Fn<T, R[K], Params>;
  },
): Derive<T, Extended<T, R>, Params>;
export function extend<T extends object, R extends object, Params = unknown>(
  fn: Fn<T, R, Params>,
): Derive<T, Extended<T, R>, Params>;
export function extend<T extends object, Params>(
  arg: Fn<T, object, Params> | Record<string, Fn<T, unknown, Params>>,
): Derive<T, object, Params> {
  type Field = (data: T, context?: Context<Params>) => unknown;

  if (typeof arg === "function") {
    const fn = arg as Field;

    return ((data: T, context?: Context<Params>) => ({
      ...data,
      ...(fn(data, context) as object),
    })) as Derive<T, object, Params>;
  }

  const fields = Object.entries(arg) as [string, Field][];

  return ((data: T, context?: Context<Params>) => {
    const result = { ...data } as Record<string, unknown>;

    for (const [key, field] of fields) result[key] = field(data, context);

    return result;
  }) as Derive<T, object, Params>;
}
