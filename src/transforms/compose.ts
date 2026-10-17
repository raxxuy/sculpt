import type { Transform } from "../core/types";

export const compose =
  <T>(...transforms: Transform<T>[]): Transform<T> =>
  (data) => {
    let value = data;

    for (const transform of transforms) {
      value = transform(value);
    }

    return value;
  };
