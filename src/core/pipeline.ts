import { resolveTransforms } from "./resolve";
import type {
  CheckedTransform,
  Derive,
  Entry,
  Node,
  Step,
  Transform,
  TransformOptions,
} from "./types";

const emptyDependencies: string[] = [];

export class Pipeline<
  Input,
  Output = Input,
  HasDefault extends boolean = true,
> {
  private compiled?: Step[];

  constructor(
    private readonly data: Input | undefined,
    private readonly head?: Node,
  ) {}

  transform<R extends Output>(
    transform: CheckedTransform<Output, R>,
  ): Pipeline<Input, Output, HasDefault>;

  transform<R extends Output>(
    name: string,
    transform: CheckedTransform<Output, R>,
    options?: TransformOptions,
  ): Pipeline<Input, Output, HasDefault>;

  transform(
    nameOrTransform: string | Transform<Output>,
    transform?: Transform<Output>,
    options?: TransformOptions,
  ): Pipeline<Input, Output, HasDefault> {
    const named = typeof nameOrTransform === "string";
    const callback =
      typeof nameOrTransform === "function" ? nameOrTransform : transform;

    if (typeof callback !== "function") {
      throw new Error("Named transform requires transform function");
    }

    return new Pipeline<Input, Output, HasDefault>(this.data, {
      previous: this.head,
      entry: {
        kind: "transform",
        name: named ? nameOrTransform : undefined,
        transform: callback,
        after: named && options?.after ? [...options.after] : emptyDependencies,
      },
    });
  }

  derive<R>(derive: Derive<Output, R>): Pipeline<Input, R, HasDefault> {
    return new Pipeline<Input, R, HasDefault>(this.data, {
      previous: this.head,
      entry: { kind: "derive", derive },
    });
  }

  private compile(): Step[] {
    const entries: Entry[] = [];

    for (let node = this.head; node; node = node.previous) {
      entries.push(node.entry);
    }

    const steps: Step[] = [];
    const transforms: Extract<Entry, { kind: "transform" }>[] = [];

    const flush = () => {
      for (const { transform } of resolveTransforms(transforms)) {
        steps.push(transform);
      }

      transforms.length = 0;
    };

    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = entries[index] as Entry;

      if (entry.kind === "transform") transforms.push(entry);
      else {
        flush();
        steps.push(entry.derive);
      }
    }

    flush();
    return steps;
  }

  run(
    ...args: HasDefault extends true ? [] | [data: Input] : [data: Input]
  ): Output {
    if (!this.compiled) this.compiled = this.compile();

    const steps = this.compiled;
    let value: unknown = args.length === 0 ? this.data : args[0];

    for (const step of steps) {
      value = step(value);
    }

    return value as Output;
  }
}
