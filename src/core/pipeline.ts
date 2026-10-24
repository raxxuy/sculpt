import { compile } from "./compile";
import { execute, trace } from "./execute";
import { inspect } from "./inspect";
import { append, emptyDependencies, link } from "./nodes";
import type {
  CheckedTransform,
  Derive,
  ExecutionPlan,
  Node,
  PipelineInspection,
  TraceResult,
  Transform,
  TransformOptions,
} from "./types";

export class Pipeline<
  Input,
  Output = Input,
  HasDefault extends boolean = true,
> {
  private compiled?: ExecutionPlan;

  private get plan(): ExecutionPlan {
    if (!this.compiled) this.compiled = compile(this.head);
    return this.compiled;
  }

  constructor(
    private readonly data?: Input,
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

    return new Pipeline<Input, Output, HasDefault>(
      this.data,
      link(
        "transform",
        named ? nameOrTransform : undefined,
        callback,
        named && options?.after ? [...options.after] : emptyDependencies,
        this.head,
      ),
    );
  }

  derive<R>(derive: Derive<Output, R>): Pipeline<Input, R, HasDefault> {
    return new Pipeline<Input, R, HasDefault>(
      this.data,
      link("derive", undefined, derive, emptyDependencies, this.head),
    );
  }

  use<Next, OtherHasDefault extends boolean>(
    pipeline: Pipeline<Output, Next, OtherHasDefault>,
  ): Pipeline<Input, Next, HasDefault> {
    return new Pipeline<Input, Next, HasDefault>(
      this.data,
      append(this.head, pipeline.head),
    );
  }

  inspect(): PipelineInspection {
    return inspect(this.plan, this.head);
  }

  run(
    ...args: HasDefault extends true ? [] | [data: Input] : [data: Input]
  ): Output {
    return execute<Output>(this.plan, args.length === 0 ? this.data : args[0]);
  }

  trace(
    ...args: HasDefault extends true ? [] | [data: Input] : [data: Input]
  ): TraceResult<Output> {
    return trace<Output>(
      this.plan,
      this.head,
      args.length === 0 ? this.data : args[0],
    );
  }
}
