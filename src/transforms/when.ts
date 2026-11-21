import type { CheckedTransform, Transform } from "../core/types";

export const when =
  <T, R extends T>(
    predicate: (data: T) => boolean,
    transform: CheckedTransform<T, R>,
  ): Transform<T> =>
  (data) =>
    predicate(data) ? transform(data) : data;
