import type { CheckedTransform, Transform } from "../core/types";

const remap = <T>(data: T[], transform: Transform<T>, from: number, first: T) =>
  data.map((value, i) => {
    if (i < from) return value;
    if (i === from) return first;

    return transform(value);
  });

export const each =
  <T, R extends T = T>(transform: CheckedTransform<T, R>): Transform<T[]> =>
  (data) => {
    for (let i = 0; i < data.length; i++) {
      if (!(i in data)) continue;

      const value = data[i] as T;
      const next = transform(value);

      if (!Object.is(next, value)) return remap(data, transform, i, next);
    }

    return data;
  };
