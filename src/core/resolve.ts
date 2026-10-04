import { SculptError } from "./errors";
import type { RegisteredTransform } from "./types";

export const resolveTransforms = <T>(
  transforms: RegisteredTransform<T>[],
): RegisteredTransform<T>[] => {
  const names = transforms.flatMap(({ name }) =>
    name === undefined ? [] : [name],
  );
  const known = new Set(names);

  const duplicate = names.find((name, i) => names.indexOf(name) !== i);
  if (duplicate !== undefined) {
    throw new SculptError(
      "DUPLICATE_TRANSFORM",
      `Duplicate transform "${duplicate}"`,
    );
  }

  transforms.forEach(({ name, after }) => {
    const missing = after.find((dependency) => !known.has(dependency));
    if (missing !== undefined) {
      throw new SculptError(
        "UNKNOWN_DEPENDENCY",
        `Transform "${name ?? "<unnamed>"}" depends on unknown transform "${missing}"`,
      );
    }
  });

  const resolved: RegisteredTransform<T>[] = [];
  const done = new Set<string>();

  let remaining = [...transforms];

  while (remaining.length > 0) {
    const next = remaining.find(({ after }) =>
      after.every((dependency) => done.has(dependency)),
    );

    if (!next) {
      const stuck = remaining.map(({ name }) => name ?? "<unnamed>").join(", ");
      throw new SculptError(
        "CIRCULAR_DEPENDENCY",
        `Circular dependency among transforms: ${stuck}`,
      );
    }

    resolved.push(next);
    remaining = remaining.filter((transform) => transform !== next);
    if (next.name !== undefined) done.add(next.name);
  }

  return resolved;
};
