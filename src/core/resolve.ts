import type { RegisteredTransform } from "./types";

export const resolveTransforms = <T>(
  transforms: RegisteredTransform<T>[],
): RegisteredTransform<T>[] => {
  const done = new Set<string>();

  for (const { name, after } of transforms) {
    if (!after.every((dependency) => done.has(dependency))) {
      return reorder(transforms);
    }

    if (name !== undefined) done.add(name);
  }

  return transforms;
};

const reorder = <T>(
  transforms: RegisteredTransform<T>[],
): RegisteredTransform<T>[] => {
  const resolved: RegisteredTransform<T>[] = [];
  const done = new Set<string>();
  const remaining = [...transforms];

  while (remaining.length > 0) {
    const index = remaining.findIndex(({ after }) =>
      after.every((dependency) => done.has(dependency)),
    );

    if (index === -1) throw diagnose(transforms, remaining);

    const [next] = remaining.splice(index, 1);
    if (!next) throw new Error("Unable to resolve transform dependencies");

    resolved.push(next);
    if (next.name !== undefined) done.add(next.name);
  }

  return resolved;
};

const diagnose = <T>(
  all: RegisteredTransform<T>[],
  blocked: RegisteredTransform<T>[],
): Error => {
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
