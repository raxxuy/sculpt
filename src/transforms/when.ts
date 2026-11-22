import type {
  Call,
  CheckedTransform,
  Context,
  Predicate,
  Transform,
} from "../core/types";

export const when = <T, R extends T, Params = unknown>(
  predicate: Predicate<T, Params>,
  transform: CheckedTransform<T, R, Params>,
): Transform<T, Params> => {
  const test = predicate as Call<T, boolean, Params>;
  const apply = transform as Call<T, T, Params>;

  return ((data: T, context?: Context<Params>) =>
    test(data, context) ? apply(data, context) : data) as Transform<T, Params>;
};
