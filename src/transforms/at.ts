/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
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
  index: number,
): any => {
  const key = keys[index] as string;
  const value =
    index < keys.length - 1
      ? update(data[key], keys, fn, index + 1)
      : fn(data[key]);

  return Array.isArray(data)
    ? Object.assign([...data], { [key]: value })
    : { ...data, [key]: value };
};

export const at = <
  T,
  P extends Path<T>,
  R extends PathValue<T, P> = PathValue<T, P>,
>(
  path: P | readonly P[],
  transform: CheckedTransform<PathValue<T, P>, R>,
): Transform<T> => {
  const paths: readonly P[] = typeof path === "string" ? [path] : path;
  const targets = paths.map((p) => p.split("."));

  return (data) =>
    targets.reduce(
      (acc, keys) => update(acc, keys, transform as Transform<any>, 0),
      data,
    );
};
