import type { RegisteredTransform } from "./types";

type Resolvable = Pick<RegisteredTransform<unknown>, "name" | "after">;

export const resolveTransforms = <T extends Resolvable>(
  transforms: T[],
): T[] => {
  const constrained = transforms.some(({ after }) => after.length > 0);
  if (!constrained) return transforms;

  const done = new Set<string>();

  for (const { name, after } of transforms) {
    if (!satisfied(after, done)) return reorder(transforms);
    if (name !== undefined) done.add(name);
  }

  return transforms;
};

const satisfied = (after: string[], done: Set<string>): boolean =>
  after.every((dependency) => done.has(dependency));

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

    if (next.name === undefined || done.has(next.name)) continue;
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
    );
  }

  return resolved;
};

const diagnose = <T extends Resolvable>(all: T[], blocked: T[]): Error => {
  const known = new Set(all.map(({ name }) => name));
  const missing = blocked
    .flatMap(({ after }) => after)
    .find((dependency) => !known.has(dependency));

  return new Error(
    missing !== undefined
      ? `Unknown transform dependency "${missing}"`
      : "Circular transform dependencies",
  );
};
