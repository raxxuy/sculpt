import type { CheckedTransform, Transform } from "../core/types";

export const each =
  <T, R extends T = T>(transform: CheckedTransform<T, R>): Transform<T[]> =>
  (data) =>
    data.map((value) => transform(value));
