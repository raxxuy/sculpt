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

type Trie = { leaf: boolean; keys: string[]; nodes: Trie[] };

const node = (): Trie => ({ leaf: false, keys: [], nodes: [] });

const buildTrie = (targets: string[][]): Trie | undefined => {
  const root = node();

  for (const path of targets) {
    let current = root;

    for (const key of path) {
      if (current.leaf) return undefined;

      let index = current.keys.indexOf(key);

      if (index === -1) {
        index = current.keys.push(key) - 1;
        current.nodes.push(node());
      }

      current = current.nodes[index] as Trie;
    }

    if (current.leaf || current.keys.length > 0) return undefined;
    current.leaf = true;
  }

  return root;
};

const apply = (data: any, trie: Trie, fn: Transform<any>): any => {
  const copy = Array.isArray(data) ? [...data] : { ...data };

  for (let i = 0; i < trie.keys.length; i++) {
    const key = trie.keys[i] as string;
    const child = trie.nodes[i] as Trie;

    copy[key] = child.leaf ? fn(data[key]) : apply(data[key], child, fn);
  }

  return copy;
};

const MAX_SOURCE_LENGTH = 8_192;
const ROOT = "data";

const compile = (
  trie: Trie,
  fn: Transform<any>,
): Transform<any> | undefined => {
  const tries: Trie[] = [];

  const emit = (current: Trie, expr: string): string => {
    const index = tries.push(current) - 1;
    const parts = [`...${expr}`];

    for (let i = 0; i < current.keys.length; i++) {
      const key = JSON.stringify(current.keys[i]);
      const child = current.nodes[i] as Trie;
      const read = `${expr}[${key}]`;

      parts.push(`[${key}]: ${child.leaf ? `fn(${read})` : emit(child, read)}`);
    }

    return `(Array.isArray(${expr}) ? apply(${expr}, tries[${index}], fn) : { ${parts.join(", ")} })`;
  };

  const body = emit(trie, ROOT);
  if (body.length > MAX_SOURCE_LENGTH) return undefined;

  try {
    return new Function("apply", "tries", "fn", `return (${ROOT}) => ${body};`)(
      apply,
      tries,
      fn,
    ) as Transform<any>;
  } catch {
    return undefined;
  }
};

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
  const fn = transform as Transform<any>;

  if (targets.length === 0) return (data) => data;

  const trie = buildTrie(targets);

  if (!trie) {
    return (data) =>
      targets.reduce((acc, keys) => update(acc, keys, fn, 0), data);
  }

  return compile(trie, fn) ?? ((data) => apply(data, trie, fn));
};
