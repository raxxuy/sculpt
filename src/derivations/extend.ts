import type { Derive } from "../core/types";

type Simplify<T> = { [K in keyof T]: T[K] } & {};

export type Extended<T, R> = Simplify<Omit<T, keyof R> & R>;

export const extend = <T extends object, R extends Record<string, unknown>>(
  fields: { [K in keyof R]: (data: T) => R[K] },
): Derive<T, Extended<T, R>> => {
  const keys = Object.keys(fields) as (keyof R & string)[];
  const fns = keys.map((key) => fields[key]);

  return (data) => {
    const result = { ...data } as Record<string, unknown>;

    for (let i = 0; i < keys.length; i++) {
      result[keys[i] as string] = (fns[i] as (data: T) => unknown)(data);
    }

    return result as Extended<T, R>;
  };
};
