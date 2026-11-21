import { ValidationError } from "../core/errors";
import type { Transform } from "../core/types";

export const validate =
  <T>(predicate: (data: T) => boolean, message: string): Transform<T> =>
  (data) => {
    if (!predicate(data)) throw new ValidationError(message);
    return data;
  };
