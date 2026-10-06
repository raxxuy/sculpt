import { collect, type Node } from "./pipeline";
import { resolveTransforms } from "./resolve";
import type {
  Derive,
  RegisteredTransform,
  Sculpt,
  Transform,
  TransformOptions,
} from "./types";

const createApi = <Initial, Current>(
  head: Node<any>,
): Sculpt<Initial, Current> => ({
  transform(
    nameOrTransform: string | Transform<Current>,
    transformOrOptions?: Transform<Current> | TransformOptions,
    options: TransformOptions = {},
  ) {
    let registered: RegisteredTransform<Current>;

    if (typeof nameOrTransform === "string") {
      if (typeof transformOrOptions !== "function") {
        throw new Error("Named transform requires transform function");
      }

      registered = {
        name: nameOrTransform,
        transform: transformOrOptions,
        after: options.after ?? [],
      };
    } else {
      registered = { transform: nameOrTransform, after: [] };
    }

    return createApi<Initial, Current>({
      kind: "transform",
      prev: head,
      registered,
    });
  },

  derive<R>(derive: Derive<Current, R>) {
    return createApi<Initial, R>({ kind: "derive", prev: head, derive });
  },

  run() {
    const { data, contexts } = collect(head);
    let current = data;

    for (const context of contexts) {
      current = resolveTransforms(context.transforms).reduce(
        (value, { transform }) => transform(value),
        current,
      );

      if (context.derive) current = context.derive(current);
    }

    return current as Current;
  },
});

export const sculpt = <T>(data: T): Sculpt<T, T> =>
  createApi<T, T>({ kind: "root", data });
