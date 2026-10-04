import { SculptError } from "./errors";
import { resolveTransforms } from "./resolve";
import type { Context, Derive, Pipeline, RegisteredTransform } from "./types";

const split = (p: Pipeline): [Context[], Context] => {
  const last = p.contexts[p.contexts.length - 1];

  if (!last) {
    throw new SculptError("INVALID_CONTEXT", "Pipeline has no active context");
  }

  return [p.contexts.slice(0, -1), last];
};

export const withTransform = <T>(
  p: Pipeline,
  entry: RegisteredTransform<T>,
): Pipeline => {
  const [rest, last] = split(p);
  return {
    ...p,
    contexts: [...rest, { ...last, transforms: [...last.transforms, entry] }],
  };
};

export const withDerive = <T, R>(
  p: Pipeline,
  derive: Derive<T, R>,
): Pipeline => {
  const [rest, last] = split(p);
  return { ...p, contexts: [...rest, { ...last, derive }, { transforms: [] }] };
};

export const runPipeline = ({ data, contexts }: Pipeline): unknown =>
  contexts.reduce((value, { transforms, derive }) => {
    const next = resolveTransforms(transforms).reduce(
      (v, t) => t.transform(v),
      value,
    );
    return derive ? derive(next) : next;
  }, data);
