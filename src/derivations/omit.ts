import type { Derive } from "../core/types";

export const omit = <T extends object, K extends keyof T & string>(
  ...keys: K[]
): Derive<T, Omit<T, K>> => {
  const omitted = new Set<string>(keys);

  return (data) => {
    const result: Record<PropertyKey, unknown> = {};
    const source = data as Record<PropertyKey, unknown>;

    for (const key in source) {
      if (Object.hasOwn(source, key) && !omitted.has(key)) {
        result[key] = source[key];
      }
    }

    for (const symbol of Object.getOwnPropertySymbols(source)) {
      if (Object.prototype.propertyIsEnumerable.call(source, symbol)) {
        result[symbol] = source[symbol];
      }
    }

    return result as Omit<T, K>;
  };
};
