import { ValidationError } from "../core/errors";
import type { Context, Predicate, Transform } from "../core/types";

export const validate = <T, Params = unknown>(
  predicate: Predicate<T, Params>,
  message: string,
): Transform<T, Params> => {
  const test = predicate as (data: T, context?: Context<Params>) => boolean;

  return ((data: T, context?: Context<Params>) => {
    if (!test(data, context)) throw new ValidationError(message);
    return data;
  }) as Transform<T, Params>;
};
