import { resolveTransforms } from "./resolve";
import type {
  CheckedTransform,
  Derive,
  Entry,
  ExecutionPlan,
  Node,
  Step,
  StepMetadata,
  TraceResult,
  TraceStep,
  Transform,
  TransformOptions,
} from "./types";

const emptyDependencies: string[] = [];

export class Pipeline<
  Input,
  Output = Input,
  HasDefault extends boolean = true,
> {
  private compiled?: ExecutionPlan;

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

  private compile(): ExecutionPlan {
    const entries: Entry[] = [];

    for (let node = this.head; node; node = node.previous) {
      entries.push(node.entry);
    }

    const steps: Step[] = [];
    const metadata: StepMetadata[] = [];
    const transforms: Extract<Entry, { kind: "transform" }>[] = [];

    const flush = () => {
      for (const entry of resolveTransforms(transforms)) {
        steps.push(entry.transform);
        metadata.push({
          kind: "transform",
          name: entry.name,
        });
      }

      transforms.length = 0;
    };

    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = entries[index] as Entry;

      if (entry.kind === "transform") {
        transforms.push(entry);
      } else {
        flush();
        steps.push(entry.derive);
        metadata.push({ kind: "derive" });
      }
    }

    flush();

    return { steps, metadata };
  }

  use<Next, OtherHasDefault extends boolean>(
    pipeline: Pipeline<Output, Next, OtherHasDefault>,
  ): Pipeline<Input, Next, HasDefault> {
    const entries: Entry[] = [];

    for (let node = pipeline.head; node; node = node.previous) {
      entries.push(node.entry);
    }

    let head = this.head;

    for (let index = entries.length - 1; index >= 0; index--) {
      head = {
        entry: entries[index] as Entry,
        previous: head,
      };
    }

    return new Pipeline<Input, Next, HasDefault>(this.data, head);
  }

  run(
    ...args: HasDefault extends true ? [] | [data: Input] : [data: Input]
  ): Output {
    if (!this.compiled) this.compiled = this.compile();

    const { steps } = this.compiled;
    let value: unknown = args.length === 0 ? this.data : args[0];

    for (const step of steps) {
      value = step(value);
    }

    return value as Output;
  }

  trace(
    ...args: HasDefault extends true ? [] | [data: Input] : [data: Input]
  ): TraceResult<Output> {
    if (!this.compiled) this.compiled = this.compile();

    const { steps, metadata } = this.compiled;
    const records: TraceStep[] = [];
    let value: unknown = args.length === 0 ? this.data : args[0];

    for (let index = 0; index < steps.length; index++) {
      const step = steps[index] as Step;
      const info = metadata[index] as StepMetadata;
      const input = value;
      const startedAt = performance.now();

      value = step(value);

      records.push({
        index,
        ...info,
        durationMs: performance.now() - startedAt,
        input,
        output: value,
      });
    }

    return {
      result: value as Output,
      steps: records,
    };
  }
}
