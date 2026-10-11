/** biome-ignore-all lint/suspicious/noExplicitAny: <> */
import type { Transform } from "../core/types";

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

const update = (data: any, keys: string[], fn: Transform<any>): any => {
  const [key, ...rest] = keys as [string, ...string[]];
  const value = rest.length ? update(data[key], rest, fn) : fn(data[key]);

  return Array.isArray(data)
    ? Object.assign([...data], { [key]: value })
    : { ...data, [key]: value };
};

export const at = <T extends object, P extends Path<T>>(
  path: P | readonly P[],
  transform: Transform<PathValue<T, P>>,
): Transform<T> => {
  const paths: readonly P[] = typeof path === "string" ? [path] : path;
  const targets = paths.map((p) => p.split("."));

  return (data) =>
    targets.reduce((acc, keys) => update(acc, keys, transform), data);
};
