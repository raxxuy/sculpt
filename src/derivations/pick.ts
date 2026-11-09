import type { Derive } from "../core/types";

export const pick =
  <T extends object, K extends keyof T & string>(
    ...keys: K[]
  ): Derive<T, Pick<T, K>> =>
  (data) => {
    const result = {} as Pick<T, K>;

    for (const key of keys) {
      if (key in data) result[key] = data[key];
    }

    return result;
  };
