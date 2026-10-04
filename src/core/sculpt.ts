import { SculptError } from "./errors";
import { runPipeline, withDerive, withTransform } from "./pipeline";
import type {
  Derive,
  Pipeline,
  Sculpt,
  Transform,
  TransformOptions,
} from "./types";

const createApi = <Initial, Current>(
  p: Pipeline,
): Sculpt<Initial, Current> => ({
  transform(
    nameOrFn: string | Transform<Current>,
    fn?: Transform<Current>,
    options: TransformOptions = {},
  ) {
    if (typeof nameOrFn === "string") {
      if (typeof fn !== "function") {
        throw new SculptError(
          "INVALID_TRANSFORM",
          `Transform "${nameOrFn}" requires a function`,
        );
      }
      return createApi<Initial, Current>(
        withTransform(p, {
          name: nameOrFn,
          transform: fn,
          after: options.after ?? [],
        }),
      );
    }

    return createApi<Initial, Current>(
      withTransform(p, { transform: nameOrFn, after: [] }),
    );
  },

  derive<R>(derive: Derive<Current, R>) {
    return createApi<Initial, R>(withDerive(p, derive));
  },

  run: () => runPipeline(p) as Current,
});

export const sculpt = <T>(data: T): Sculpt<T, T> =>
  createApi<T, T>({ data, contexts: [{ transforms: [] }] });
