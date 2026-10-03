import type {
  RegisteredTransform,
  Sculpt,
  Transform,
  TransformOptions,
} from "./types";
import { resolveTransforms } from "./utils/resolve-transforms";

export const sculpt = <T>(data: T): Sculpt<T> => {
  const transforms: RegisteredTransform<T>[] = [];

  const api: Sculpt<T> = {
    transform(
      nameOrTransform: string | Transform<T>,
      transformOrOptions?: Transform<T> | TransformOptions,
      options: TransformOptions = {},
    ) {
      if (typeof nameOrTransform === "string") {
        if (typeof transformOrOptions !== "function") {
          throw new Error("Named transform requires transform function");
        }

        transforms.push({
          name: nameOrTransform,
          transform: transformOrOptions,
          after: options.after ?? [],
        });
      } else {
        transforms.push({
          transform: nameOrTransform,
          after: [],
        });
      }

      return api;
    },

    run() {
      return resolveTransforms(transforms).reduce(
        (value, { transform }) => transform(value),
        data,
      );
    },
  };

  return api;
};
