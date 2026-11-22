import type { Call, CheckedTransform, Context, Transform } from "../core/types";

export function compose<T, Params = unknown>(): Transform<T, Params>;
export function compose<T, A extends T, Params = unknown>(
  a: CheckedTransform<T, A, Params>,
): Transform<T, Params>;
export function compose<T, A extends T, B extends T, Params = unknown>(
  a: CheckedTransform<T, A, Params>,
  b: CheckedTransform<T, B, Params>,
): Transform<T, Params>;
export function compose<
  T,
  A extends T,
  B extends T,
  C extends T,
  Params = unknown,
>(
  a: CheckedTransform<T, A, Params>,
  b: CheckedTransform<T, B, Params>,
  c: CheckedTransform<T, C, Params>,
): Transform<T, Params>;
export function compose<
  T,
  A extends T,
  B extends T,
  C extends T,
  D extends T,
  Params = unknown,
>(
  a: CheckedTransform<T, A, Params>,
  b: CheckedTransform<T, B, Params>,
  c: CheckedTransform<T, C, Params>,
  d: CheckedTransform<T, D, Params>,
): Transform<T, Params>;
export function compose<
  T,
  A extends T,
  B extends T,
  C extends T,
  D extends T,
  E extends T,
  Params = unknown,
>(
  a: CheckedTransform<T, A, Params>,
  b: CheckedTransform<T, B, Params>,
  c: CheckedTransform<T, C, Params>,
  d: CheckedTransform<T, D, Params>,
  e: CheckedTransform<T, E, Params>,
): Transform<T, Params>;
export function compose<
  T,
  A extends T,
  B extends T,
  C extends T,
  D extends T,
  E extends T,
  F extends T,
  Params = unknown,
>(
  a: CheckedTransform<T, A, Params>,
  b: CheckedTransform<T, B, Params>,
  c: CheckedTransform<T, C, Params>,
  d: CheckedTransform<T, D, Params>,
  e: CheckedTransform<T, E, Params>,
  f: CheckedTransform<T, F, Params>,
): Transform<T, Params>;
export function compose<
  T,
  A extends T,
  B extends T,
  C extends T,
  D extends T,
  E extends T,
  F extends T,
  G extends T,
  Params = unknown,
>(
  a: CheckedTransform<T, A, Params>,
  b: CheckedTransform<T, B, Params>,
  c: CheckedTransform<T, C, Params>,
  d: CheckedTransform<T, D, Params>,
  e: CheckedTransform<T, E, Params>,
  f: CheckedTransform<T, F, Params>,
  g: CheckedTransform<T, G, Params>,
): Transform<T, Params>;
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
  Params = unknown,
>(
  a: CheckedTransform<T, A, Params>,
  b: CheckedTransform<T, B, Params>,
  c: CheckedTransform<T, C, Params>,
  d: CheckedTransform<T, D, Params>,
  e: CheckedTransform<T, E, Params>,
  f: CheckedTransform<T, F, Params>,
  g: CheckedTransform<T, G, Params>,
  h: CheckedTransform<T, H, Params>,
): Transform<T, Params>;
export function compose<T, Params>(
  ...transforms: Transform<T, Params>[]
): Transform<T, Params> {
  const steps = transforms as Call<T, T, Params>[];

  return ((data: T, context?: Context<Params>) =>
    steps.reduce((value, step) => step(value, context), data)) as Transform<
    T,
    Params
  >;
}
