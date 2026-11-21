import type { Derive } from "../core/types";

type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type Extended<T, R> = Simplify<Omit<T, keyof R> & R>;

export function extend<T extends object, R extends Record<string, unknown>>(
  fields: { [K in keyof R]: (data: T) => R[K] },
): Derive<T, Extended<T, R>>;
export function extend<T extends object, R extends object>(
  fn: (data: T) => R,
): Derive<T, Extended<T, R>>;
export function extend<T extends object>(
  arg: ((data: T) => object) | Record<string, (data: T) => unknown>,
): Derive<T, object> {
  if (typeof arg === "function") return (data) => ({ ...data, ...arg(data) });

  const fields = Object.entries(arg);

  return (data) => {
    const result = { ...data } as Record<string, unknown>;

    for (const [key, field] of fields) result[key] = field(data);

    return result;
  };
}
