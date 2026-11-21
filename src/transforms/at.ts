/** biome-ignore-all lint/suspicious/noExplicitAny: paths are checked by Path<T>, values are untyped at runtime */
import type { CheckedTransform, Transform } from "../core/types";

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
): any => {
  const key = keys[depth] as string;
  const value =
    depth < keys.length - 1
      ? update(data[key], keys, fn, depth + 1)
      : fn(data[key]);
  const copy = Array.isArray(data) ? [...data] : { ...data };

  copy[key] = value;

  return copy;
};

export const at = <
  T,
  P extends Path<T>,
  R extends PathValue<T, P> = PathValue<T, P>,
>(
  path: P | readonly P[],
  transform: CheckedTransform<PathValue<T, P>, R>,
): Transform<T> => {
  const targets = (typeof path === "string" ? [path] : path).map((p) =>
    p.split("."),
  );

  return (data) =>
    targets.reduce(
      (value, keys) => update(value, keys, transform as Transform<any>, 0),
      data,
    );
};
