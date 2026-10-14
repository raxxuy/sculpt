import type { CheckedTransform, Transform } from "../core/types";

export type Compose = {
  <T>(): Transform<T>;

  <T, R extends T[]>(
    ...transforms: {
      [K in keyof R]: CheckedTransform<T, R[K]>;
    }
  ): Transform<T>;
};

export const compose: Compose =
  <T>(...transforms: Transform<T>[]): Transform<T> =>
  (data) => {
    let value = data;

    for (const transform of transforms) {
      value = transform(value);
    }

    return value;
  };
