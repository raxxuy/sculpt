import { resolveTransforms } from "./resolve";
import type {
  CheckedTransform,
  Derive,
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

const describe = (node: Node): StepMetadata =>
  node.kind === "transform"
    ? { kind: "transform", name: node.name }
    : { kind: "derive" };

const link = (
  kind: Node["kind"],
  name: string | undefined,
  fn: Step,
  after: string[],
  previous?: Node,
): Node => ({
  kind,
  name,
  fn,
  after,
  previous,
  size: previous === undefined ? 1 : previous.size + 1,
  constrained: previous?.constrained || after.length > 0,
});

const declared = (head?: Node): Node[] => {
  const size = head?.size ?? 0;
  const nodes: Node[] = new Array(size);
  let index = size;

  for (let node = head; node; node = node.previous) nodes[--index] = node;

  return nodes;
};

export class Pipeline<
  Input,
  Output = Input,
  HasDefault extends boolean = true,
> {
  private compiled?: ExecutionPlan;

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

  private compile(): ExecutionPlan {
    const head = this.head;

    if (!head) return { steps: [] };

    if (!head.constrained) {
      const steps: Step[] = [];

      for (let node: Node | undefined = head; node; node = node.previous) {
        steps.push(node.fn);
      }

      return { steps: steps.reverse() };
    }

    const nodes = declared(head);
    const steps: Step[] = [];
    const order: Node[] = [];
    const transforms: Node[] = [];

    const flush = () => {
      for (const node of resolveTransforms(transforms)) {
        steps.push(node.fn);
        order.push(node);
      }

      transforms.length = 0;
    };

    for (let index = 0; index < nodes.length; index++) {
      const node = nodes[index] as Node;

      if (node.kind === "transform") {
        transforms.push(node);
      } else {
        flush();
        steps.push(node.fn);
        order.push(node);
      }
    }

    flush();

    return { steps, nodes: order };
  }

  use<Next, OtherHasDefault extends boolean>(
    pipeline: Pipeline<Output, Next, OtherHasDefault>,
  ): Pipeline<Input, Next, HasDefault> {
    const nodes = declared(pipeline.head);
    let head = this.head;

    for (const node of nodes) {
      head = link(node.kind, node.name, node.fn, node.after, head);
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

    const { steps } = this.compiled;
    const nodes = this.compiled.nodes ?? declared(this.head);
    const records: TraceStep[] = [];
    let value: unknown = args.length === 0 ? this.data : args[0];

    for (let index = 0; index < steps.length; index++) {
      const step = steps[index] as Step;
      const info = describe(nodes[index] as Node);
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
