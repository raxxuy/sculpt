import type { CheckedTransform, Transform } from "../core/types";

export const eachWhen = <T, R extends T = T>(
  predicate: (data: T) => boolean,
  transform: CheckedTransform<T, R>,
): Transform<T[]> => {
  return (data) =>
    data.map((value) => (predicate(value) ? transform(value) : value));
};
