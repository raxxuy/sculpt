import type { Node } from "./types";

type Resolvable = Pick<Node, "name" | "after" | "size">;

export const resolveTransforms = <T extends Resolvable>(
  transforms: T[],
  scope: number,
): T[] => {
  if (transforms.length < 2 && !transforms[0]?.after.length) return transforms;

  const names = new Set<string>();
  let ordered = true;

  for (const { name, after, size } of transforms) {
    if (ordered) {
      for (const dependency of after) {
        if (!names.has(dependency)) {
          ordered = false;
          break;
        }
      }
    }

    if (name !== undefined) {
      if (names.has(name)) {
        const first = transforms.find(
          (transform) => transform.name === name,
        ) as T;

        throw new Error(
          `Duplicate transform name ${JSON.stringify(name)} in scope ${scope} (declared indexes ${first.size - 1} and ${size - 1})`,
        );
      }

      names.add(name);
    }
  }

  return ordered ? transforms : reorder(transforms);
};

const push = (heap: number[], value: number) => {
  let i = heap.push(value) - 1;

  while (i > 0) {
    const parent = (i - 1) >> 1;
    if ((heap[parent] as number) <= value) break;
    heap[i] = heap[parent] as number;
    i = parent;
  }

  heap[i] = value;
};

const pop = (heap: number[]): number => {
  const top = heap[0] as number;
  const last = heap.pop() as number;

  if (heap.length > 0) {
    let i = 0;

    while (true) {
      let child = 2 * i + 1;
      if (child >= heap.length) break;

      if (
        child + 1 < heap.length &&
        (heap[child + 1] as number) < (heap[child] as number)
      ) {
        child++;
      }

      if ((heap[child] as number) >= last) break;
      heap[i] = heap[child] as number;
      i = child;
    }

    heap[i] = last;
  }

  return top;
};

const reorder = <T extends Resolvable>(transforms: T[]): T[] => {
  const pending: number[] = [];
  const waiting = new Map<string, number[]>();
  const ready: number[] = [];

  for (let i = 0; i < transforms.length; i++) {
    const dependencies = new Set((transforms[i] as T).after);

    pending.push(dependencies.size);
    if (dependencies.size === 0) push(ready, i);

    for (const dependency of dependencies) {
      const list = waiting.get(dependency);
      if (list) list.push(i);
      else waiting.set(dependency, [i]);
    }
  }

  const resolved: T[] = [];
  const placed: boolean[] = new Array(transforms.length).fill(false);
  const done = new Set<string>();

  while (ready.length > 0) {
    const index = pop(ready);
    const next = transforms[index] as T;

    placed[index] = true;
    resolved.push(next);

    if (next.name === undefined) continue;
    done.add(next.name);

    for (const waiter of waiting.get(next.name) ?? []) {
      const left = (pending[waiter] as number) - 1;
      pending[waiter] = left;
      if (left === 0) push(ready, waiter);
    }
  }

  if (resolved.length < transforms.length) {
    throw diagnose(
      transforms,
      transforms.filter((_, index) => !placed[index]),
      done,
    );
  }

  return resolved;
};

const diagnose = <T extends Resolvable>(
  all: T[],
  blocked: T[],
  done: Set<string>,
): Error => {
  const known = new Set(all.map(({ name }) => name));

  for (const { name, after } of blocked) {
    for (const dependency of after) {
      if (!known.has(dependency)) {
        return new Error(
          `Unknown transform dependency ${JSON.stringify(dependency)}${name === undefined ? "" : ` required by ${JSON.stringify(name)}`}`,
        );
      }
    }
  }

  const named = new Map<string, T>();
  for (const transform of blocked) {
    if (transform.name !== undefined) named.set(transform.name, transform);
  }

  const path: string[] = [];
  const visited = new Map<string, number>();
  let current = blocked[0] as T;

  if (current.name !== undefined) {
    visited.set(current.name, path.length);
    path.push(current.name);
  }

  // Every blocked transform has an unresolved dependency on another blocked transform.
  while (true) {
    const dependency = current.after.find((name) => !done.has(name)) as string;
    const start = visited.get(dependency);

    if (start !== undefined) {
      return new Error(
        `Circular transform dependencies: ${[...path.slice(start), dependency].map((name) => JSON.stringify(name)).join(" -> ")}`,
      );
    }

    visited.set(dependency, path.length);
    path.push(dependency);
    current = named.get(dependency) as T;
  }
};
