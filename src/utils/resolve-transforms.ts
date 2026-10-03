import type { RegisteredTransform } from "../types";

export const resolveTransforms = <T>(
  transforms: RegisteredTransform<T>[],
): RegisteredTransform<T>[] => {
  const resolved: RegisteredTransform<T>[] = [];
  const remaining = [...transforms];

  while (remaining.length > 0) {
    const next = remaining.find(({ after }) =>
      after.every((dependency) =>
        resolved.some(({ name }) => name === dependency),
      ),
    );

    if (!next) {
      throw new Error("Unable to resolve transform dependencies");
    }

    resolved.push(next);
    remaining.splice(remaining.indexOf(next), 1);
  }

  return resolved;
};
