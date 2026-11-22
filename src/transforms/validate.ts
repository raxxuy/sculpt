import { ValidationError } from "../core/errors";
import type { Call, Context, Predicate, Transform } from "../core/types";

export const validate = <T, Params = unknown>(
  predicate: Predicate<T, Params>,
  message: string,
): Transform<T, Params> => {
  const test = predicate as Call<T, boolean, Params>;

  return ((data: T, context?: Context<Params>) => {
    if (!test(data, context)) throw new ValidationError(message);
    return data;
  }) as Transform<T, Params>;
};
