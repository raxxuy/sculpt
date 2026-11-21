import type {
  CheckedTransform,
  Context,
  Predicate,
  Transform,
} from "../core/types";

export const when = <T, R extends T, Params = unknown>(
  predicate: Predicate<T, Params>,
  transform: CheckedTransform<T, R, Params>,
): Transform<T, Params> => {
  const test = predicate as (data: T, context?: Context<Params>) => boolean;
  const apply = transform as (data: T, context?: Context<Params>) => T;

  return ((data: T, context?: Context<Params>) =>
    test(data, context) ? apply(data, context) : data) as Transform<T, Params>;
};
