import { collect, compile, openScope, orderScope } from "./compile";
import { StepError } from "./errors";
import { trace } from "./execute";
import type {
  CheckedTransform,
  Context,
  DefaultState,
  Derive,
  InspectionStep,
  Node,
  Patch,
  PipelineInspection,
  PipelineState,
  Plan,
  Step,
  TraceResult,
  TransformOptions,
} from "./types";

type ExecutionArgs<Input, S extends PipelineState> = S["bound"] extends true
  ? S["hasDefault"] extends true
    ? [] | [data: Input]
    : [data: Input]
  : never;

type Cache = { plan?: Plan };

const noParams: Context = { params: undefined };

const noDependencies: string[] = [];

const append = (
  previous: Node | undefined,
  kind: Node["kind"],
  fn: Step,
  name?: string,
  after = noDependencies,
): Node => {
  const closed = kind === "derive" ? openScope(previous) : undefined;

  return {
    kind,
    name,
    fn,
    after,
    index: previous ? previous.index + 1 : 0,
    scope: previous ? previous.scope + (previous.kind === "derive" ? 1 : 0) : 0,
    previous,
    ordered: closed && orderScope(closed.transforms),
    previousDerive: closed?.derive,
  };
};

const describe = (node: Node, executionIndex: number): InspectionStep => {
  const position = {
    declaredIndex: node.index,
    executionIndex,
    scope: node.scope,
  };

  return node.kind === "derive"
    ? { ...position, kind: "derive" }
    : {
        ...position,
        kind: "transform",
        name: node.name,
        after: [...node.after],
      };
};

export class Pipeline<
  Input,
  Output = Input,
  S extends PipelineState = DefaultState,
> {
  constructor(
    private readonly data?: Input,
    private readonly head?: Node,
    private readonly context: Context = noParams,
    private readonly cache: Cache = {},
  ) {}

  transform<R extends Output>(
    transform: CheckedTransform<Output, R, S["params"]>,
  ): Pipeline<Input, Output, S>;

  transform<R extends Output>(
    name: string,
    transform: CheckedTransform<Output, R, S["params"]>,
    options?: TransformOptions,
  ): Pipeline<Input, Output, S>;

  transform<R extends Output>(
    nameOrTransform: string | CheckedTransform<Output, R, S["params"]>,
    transform?: CheckedTransform<Output, R, S["params"]>,
    options?: TransformOptions,
  ): Pipeline<Input, Output, S> {
    const fn =
      typeof nameOrTransform === "string" ? transform : nameOrTransform;

    if (typeof fn !== "function") {
      throw new Error("Named transform requires transform function");
    }

    const node =
      typeof nameOrTransform === "string"
        ? append(
            this.head,
            "transform",
            fn as Step,
            nameOrTransform,
            options?.after && [...options.after],
          )
        : append(this.head, "transform", fn as Step);

    return new Pipeline(this.data, node, this.context);
  }

  derive<R>(derive: Derive<Output, R, S["params"]>): Pipeline<Input, R, S> {
    return new Pipeline(
      this.data,
      append(this.head, "derive", derive as Step),
      this.context,
    );
  }

  use<Next, Other extends PipelineState>(
    other: Pipeline<Output, Next, Other>,
  ): Pipeline<
    Input,
    Next,
    Patch<
      S,
      {
        params: S["params"] & Other["params"];
        bound: unknown extends Other["params"] ? S["bound"] : false;
      }
    >
  > {
    const head = collect(other.head, (node) => node.previous).reduce<
      Node | undefined
    >(
      (previous, { kind, fn, name, after }) =>
        append(previous, kind, fn, name, after),
      this.head,
    );

    return new Pipeline(this.data, head, this.context);
  }

  params<Params>(): Pipeline<
    Input,
    Output,
    Patch<S, { params: S["params"] & Params; bound: false }>
  > {
    return new Pipeline(this.data, this.head, this.context, this.cache);
  }

  with(
    params: S["params"],
  ): Pipeline<Input, Output, Patch<S, { bound: true }>> {
    return new Pipeline(this.data, this.head, { params }, this.cache);
  }

  inspect(): PipelineInspection {
    return { steps: this.compiled().nodes.map(describe) };
  }

  run(...args: ExecutionArgs<Input, S>): Output {
    const { steps, nodes } = this.compiled();

    return steps.reduce((value, step, index) => {
      try {
        return step(value, this.context);
      } catch (error) {
        throw new StepError(nodes[index] as Node, index, error);
      }
    }, this.input(args)) as Output;
  }

  trace(...args: ExecutionArgs<Input, S>): TraceResult<Output> {
    return trace<Output>(this.compiled(), this.input(args), this.context);
  }

  private input(args: unknown[]): unknown {
    return args.length === 0 ? this.data : args[0];
  }

  private compiled(): Plan {
    this.cache.plan ??= compile(this.head);
    return this.cache.plan;
  }
}

type Sculpt = {
  <T>(): Pipeline<T, T, Patch<DefaultState, { hasDefault: false }>>;
  <T>(data: T): Pipeline<T, T>;
};

export const sculpt: Sculpt = <T>(data?: T) => new Pipeline<T, T>(data);
