import type { CheckedTransform, Context, Transform } from "../core/types";

type Apply<T> = (value: T, context?: Context<unknown>) => T;

const remap = <T>(
  data: T[],
  transform: Apply<T>,
  from: number,
  first: T,
  context?: Context<unknown>,
) =>
  data.map((value, i) => {
    if (i < from) return value;
    if (i === from) return first;

    return transform(value, context);
  });

export const each = <T, R extends T = T, Params = unknown>(
  transform: CheckedTransform<T, R, Params>,
): Transform<T[], Params> => {
  const apply = transform as Apply<T>;

  return ((data: T[], context?: Context<unknown>) => {
    for (let i = 0; i < data.length; i++) {
      if (!(i in data)) continue;

      const value = data[i] as T;
      const next = apply(value, context);

      if (!Object.is(next, value)) {
        return remap(data, apply, i, next, context);
      }
    }

    return data;
  }) as Transform<T[], Params>;
};
