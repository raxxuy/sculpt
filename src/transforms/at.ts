/** biome-ignore-all lint/suspicious/noExplicitAny: paths are checked by Path<T>, values are untyped at runtime */
import type { CheckedTransform, Context, Transform } from "../core/types";

type Path<T> = T extends readonly unknown[]
  ? never
  : T extends object
    ? { [K in keyof T & string]: K | `${K}.${Path<T[K]>}` }[keyof T & string]
    : never;

type PathValue<T, P extends string> = P extends `${infer K}.${infer R}`
  ? K extends keyof T
    ? PathValue<T[K], R>
    : never
  : P extends keyof T
    ? T[P]
    : never;

const update = (
  data: any,
  keys: string[],
  fn: Transform<any>,
  depth: number,
  context?: Context<any>,
): any => {
  const key = keys[depth] as string;
  const current = data[key];
  const value =
    depth < keys.length - 1
      ? update(current, keys, fn, depth + 1, context)
      : fn(current, context);

  if (Object.is(value, current)) return data;

  const copy = Array.isArray(data) ? [...data] : { ...data };

  copy[key] = value;

  return copy;
};

export const at = <
  T,
  P extends Path<T>,
  R extends PathValue<T, P> = PathValue<T, P>,
  Params = unknown,
>(
  path: P | readonly P[],
  transform: CheckedTransform<PathValue<T, P>, R, Params>,
): Transform<T, Params> => {
  const targets = (typeof path === "string" ? [path] : path).map((p) =>
    p.split("."),
  );

  return ((data: T, context?: Context<Params>) =>
    targets.reduce(
      (value, keys) =>
        update(value, keys, transform as Transform<any>, 0, context),
      data,
    )) as Transform<T, Params>;
};
