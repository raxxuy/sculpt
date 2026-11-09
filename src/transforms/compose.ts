import type { CheckedTransform, Transform } from "../core/types";

export function compose<T>(): Transform<T>;
export function compose<T, A extends T>(
  a: CheckedTransform<T, A>,
): Transform<T>;
export function compose<T, A extends T, B extends T>(
  a: CheckedTransform<T, A>,
  b: CheckedTransform<T, B>,
): Transform<T>;
export function compose<T, A extends T, B extends T, C extends T>(
  a: CheckedTransform<T, A>,
  b: CheckedTransform<T, B>,
  c: CheckedTransform<T, C>,
): Transform<T>;
export function compose<T, A extends T, B extends T, C extends T, D extends T>(
  a: CheckedTransform<T, A>,
  b: CheckedTransform<T, B>,
  c: CheckedTransform<T, C>,
  d: CheckedTransform<T, D>,
): Transform<T>;
export function compose<
  T,
  A extends T,
  B extends T,
  C extends T,
  D extends T,
  E extends T,
>(
  a: CheckedTransform<T, A>,
  b: CheckedTransform<T, B>,
  c: CheckedTransform<T, C>,
  d: CheckedTransform<T, D>,
  e: CheckedTransform<T, E>,
): Transform<T>;
export function compose<
  T,
  A extends T,
  B extends T,
  C extends T,
  D extends T,
  E extends T,
  F extends T,
>(
  a: CheckedTransform<T, A>,
  b: CheckedTransform<T, B>,
  c: CheckedTransform<T, C>,
  d: CheckedTransform<T, D>,
  e: CheckedTransform<T, E>,
  f: CheckedTransform<T, F>,
): Transform<T>;
export function compose<
  T,
  A extends T,
  B extends T,
  C extends T,
  D extends T,
  E extends T,
  F extends T,
  G extends T,
>(
  a: CheckedTransform<T, A>,
  b: CheckedTransform<T, B>,
  c: CheckedTransform<T, C>,
  d: CheckedTransform<T, D>,
  e: CheckedTransform<T, E>,
  f: CheckedTransform<T, F>,
  g: CheckedTransform<T, G>,
): Transform<T>;
export function compose<
  T,
  A extends T,
  B extends T,
  C extends T,
  D extends T,
  E extends T,
  F extends T,
  G extends T,
  H extends T,
>(
  a: CheckedTransform<T, A>,
  b: CheckedTransform<T, B>,
  c: CheckedTransform<T, C>,
  d: CheckedTransform<T, D>,
  e: CheckedTransform<T, E>,
  f: CheckedTransform<T, F>,
  g: CheckedTransform<T, G>,
  h: CheckedTransform<T, H>,
): Transform<T>;
export function compose<T>(...transforms: Transform<T>[]): Transform<T> {
  return (data) => {
    let value = data;

    for (const transform of transforms) {
      value = transform(value);
    }

    return value;
  };
}
