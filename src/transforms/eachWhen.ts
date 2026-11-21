import type { CheckedTransform, Predicate, Transform } from "../core/types";
import { each } from "./each";
import { when } from "./when";

export const eachWhen = <T, R extends T = T, Params = unknown>(
  predicate: Predicate<T, Params>,
  transform: CheckedTransform<T, R, Params>,
): Transform<T[], Params> =>
  each(when(predicate, transform) as CheckedTransform<T, T, Params>);
