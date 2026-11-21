import type { Derive } from "../core/types";
import { omit } from "./omit";

export type Renamed<T, M> = {
  [K in keyof T as K extends keyof M
    ? M[K] & string
    : K extends M[keyof M]
      ? never
      : K]: T[K];
};

export const rename = <
  T extends object,
  const M extends { [K in keyof T & string]?: string },
>(
  map: M & Record<Exclude<keyof M, keyof T>, never>,
): Derive<T, Renamed<T, M>> => {
  const entries = Object.entries(map) as [string, string][];
  const without = omit<Record<string, unknown>, string>(...Object.keys(map));

  return (data) => {
    const source = data as Record<string, unknown>;
    const result = without(source) as Record<string, unknown>;

    for (const [from, to] of entries) {
      if (Object.hasOwn(source, from)) result[to] = source[from];
    }

    return result as Renamed<T, M>;
  };
};
