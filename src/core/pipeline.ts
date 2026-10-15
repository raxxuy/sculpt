import { resolveTransforms } from "./resolve";
import type {
  CheckedTransform,
  Derive,
  Entry,
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
    private readonly entries: Entry[] = [],
    private readonly forkOnTransform = false,
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

    const target = this.forkOnTransform ? this.fork() : this;

    target.entries.push({
      kind: "transform",
      name: named ? nameOrTransform : undefined,
      transform: callback,
      after: named && options?.after ? [...options.after] : emptyDependencies,
    });
    target.compiled = undefined;

    return target;
  }

  private fork(forkOnTransform = false): Pipeline<Input, Output, HasDefault> {
    return new Pipeline<Input, Output, HasDefault>(
      this.data,
      [...this.entries],
      forkOnTransform,
    );
  }

  snapshot(): Pipeline<Input, Output, HasDefault> {
    return this.fork(true);
  }

  derive<R>(derive: Derive<Output, R>): Pipeline<Input, R, HasDefault> {
    return new Pipeline<Input, R, HasDefault>(this.data, [
      ...this.entries,
      { kind: "derive", derive },
    ]);
  }

  private compile(): Step[] {
    const steps: Step[] = [];
    const transforms: Extract<Entry, { kind: "transform" }>[] = [];

    const flush = () => {
      for (const { transform } of resolveTransforms(transforms)) {
        steps.push(transform);
      }

      transforms.length = 0;
    };

    for (const entry of this.entries) {
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
