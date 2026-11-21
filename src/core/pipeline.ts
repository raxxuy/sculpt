import { compile, openScope, orderScope } from "./compile";
import { trace } from "./execute";
import type {
  CheckedTransform,
  Derive,
  InspectionStep,
  Node,
  PipelineInspection,
  Plan,
  Step,
  TraceResult,
  TransformOptions,
} from "./types";

type ExecutionArgs<Input, HasDefault extends boolean> = HasDefault extends true
  ? [] | [data: Input]
  : [data: Input];

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

const toArray = (head?: Node) => {
  const nodes: Node[] = [];

  for (let node = head; node; node = node.previous) nodes.push(node);

  return nodes.reverse();
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
  HasDefault extends boolean = true,
> {
  private plan?: Plan;

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

  transform<R extends Output>(
    nameOrTransform: string | CheckedTransform<Output, R>,
    transform?: CheckedTransform<Output, R>,
    options?: TransformOptions,
  ): Pipeline<Input, Output, HasDefault> {
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
            fn,
            nameOrTransform,
            options?.after && [...options.after],
          )
        : append(this.head, "transform", fn);

    return new Pipeline(this.data, node);
  }

  derive<R>(derive: Derive<Output, R>): Pipeline<Input, R, HasDefault> {
    return new Pipeline(this.data, append(this.head, "derive", derive));
  }

  use<Next, OtherHasDefault extends boolean>(
    other: Pipeline<Output, Next, OtherHasDefault>,
  ): Pipeline<Input, Next, HasDefault> {
    const head = toArray(other.head).reduce<Node | undefined>(
      (previous, { kind, fn, name, after }) =>
        append(previous, kind, fn, name, after),
      this.head,
    );

    return new Pipeline(this.data, head);
  }

  inspect(): PipelineInspection {
    return { steps: this.compiled().nodes.map(describe) };
  }

  run(...args: ExecutionArgs<Input, HasDefault>): Output {
    return this.compiled().steps.reduce(
      (value, step) => step(value),
      this.input(args),
    ) as Output;
  }

  trace(...args: ExecutionArgs<Input, HasDefault>): TraceResult<Output> {
    return trace<Output>(this.compiled(), this.input(args));
  }

  private input(args: unknown[]): unknown {
    return args.length === 0 ? this.data : args[0];
  }

  private compiled(): Plan {
    this.plan ??= compile(this.head);
    return this.plan;
  }
}

type Sculpt = {
  <T>(): Pipeline<T, T, false>;
  <T>(data: T): Pipeline<T, T, true>;
};

export const sculpt: Sculpt = <T>(data?: T) =>
  new Pipeline<T, T, boolean>(data);
