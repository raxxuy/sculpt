import type { CheckedTransform, Transform } from "../core/types";
import { each } from "./each";
import { when } from "./when";

export const eachWhen = <T, R extends T = T>(
  predicate: (data: T) => boolean,
  transform: CheckedTransform<T, R>,
): Transform<T[]> => each(when(predicate, transform) as CheckedTransform<T, T>);
