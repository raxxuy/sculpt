import type {
  Derive,
  RegisteredTransform,
  Sculpt,
  Transform,
  TransformOptions,
} from "./types";
import { resolveTransforms } from "./utils/resolve-transforms";

type Context = {
  transforms: RegisteredTransform<any>[];
  derive?: Derive<any, any>;
};

type Pipeline = {
  data: unknown;
  contexts: Context[];
};

const createApi = <Initial, Current>(
  pipeline: Pipeline,
  contextIndex: number,
): Sculpt<Initial, Current> => {
  const api: Sculpt<Initial, Current> = {
    transform(
      nameOrTransform: string | Transform<Current>,
      transformOrOptions?: Transform<Current> | TransformOptions,
      options: TransformOptions = {},
    ) {
      const contexts = pipeline.contexts.map((context) => ({
        ...context,
        transforms: [...context.transforms],
      }));

      const context = contexts[contextIndex];

      if (!context) throw new Error("Invalid context index");

      if (typeof nameOrTransform === "string") {
        if (typeof transformOrOptions !== "function") {
          throw new Error("Named transform requires transform function");
        }

        context.transforms.push({
          name: nameOrTransform,
          transform: transformOrOptions,
          after: options.after ?? [],
        });
      } else {
        context.transforms.push({
          transform: nameOrTransform,
          after: [],
        });
      }

      return createApi<Initial, Current>(
        {
          ...pipeline,
          contexts,
        },
        contextIndex,
      );
    },

    derive<R>(derive: Derive<Current, R>) {
      const contexts = pipeline.contexts.map((context) => ({
        ...context,
        transforms: [...context.transforms],
      }));

      const context = contexts[contextIndex];

      if (!context) throw new Error("Invalid context index");

      contexts[contextIndex] = {
        transforms: context.transforms,
        derive,
      };

      contexts.push({
        transforms: [],
      });

      return createApi<Initial, R>(
        {
          ...pipeline,
          contexts,
        },
        contextIndex + 1,
      );
    },

    run() {
      let current = pipeline.data;

      for (const context of pipeline.contexts) {
        current = resolveTransforms(context.transforms).reduce(
          (value, { transform }) => transform(value),
          current,
        );

        if (context.derive) current = context.derive(current);
      }

      return current as Current;
    },
  };

  return api;
};

export const sculpt = <T>(data: T): Sculpt<T, T> => {
  return createApi<T, T>(
    {
      data,
      contexts: [
        {
          transforms: [],
        },
      ],
    },
    0,
  );
};
