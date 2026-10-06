import type { RegisteredTransform } from "./types";

export const resolveTransforms = <T>(
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

    const next = remaining.splice(index, 1)[0] as RegisteredTransform<T>;

    resolved.push(next);
    if (next.name) done.add(next.name);
  }

  return resolved;
};

const diagnose = <T>(
  all: RegisteredTransform<T>[],
  blocked: RegisteredTransform<T>[],
) => {
  const known = new Set(all.map(({ name }) => name));
  const missing = blocked
    .flatMap(({ after }) => after)
    .find((dependency) => !known.has(dependency));

  return new Error(
    missing
      ? `Unknown transform dependency "${missing}"`
      : "Circular transform dependencies",
  );
};
