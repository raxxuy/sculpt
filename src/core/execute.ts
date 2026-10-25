import * as nodeHelpers from "./nodes";
import type {
  ExecutionPlan,
  Node,
  Step,
  StepMetadata,
  TraceResult,
  TraceStep,
} from "./types";

const { declared } = nodeHelpers;

type Continuation = (value: unknown, next: Step) => unknown;

const sync: Continuation = (value, next) => next(value);
const asynchronous: Continuation = (value, next) =>
  Promise.resolve(value).then(next);

const run = (steps: Step[], input: unknown, resume: Continuation): unknown => {
  const first = steps[0];
  if (!first) return input;

  // The first callback receives the original input, even if it is Promise-like.
  let value = first(input);

  for (let index = 1; index < steps.length; index++) {
    value = resume(value, steps[index] as Step);
  }

  return value;
};

const describe = (node: Node): StepMetadata =>
  node.kind === "transform"
    ? { kind: "transform", name: node.name }
    : { kind: "derive" };

const traceWith = (
  plan: ExecutionPlan,
  head: Node | undefined,
  input: unknown,
  resume: Continuation,
): unknown => {
  const nodes = plan.nodes ?? declared(head);
  const records: TraceStep[] = [];
  const steps = plan.steps.map((step, index) => {
    const metadata = describe(nodes[index] as Node);

    return (input: unknown) => {
      const startedAt = performance.now();

      return resume(step(input), (output: unknown) => {
        records.push({
          index,
          ...metadata,
          durationMs: performance.now() - startedAt,
          input,
          output,
        });
        return output;
      });
    };
  });

  return resume(run(steps, input, resume), (result: unknown) => ({
    result,
    steps: records,
  }));
};

export const executeAsync = async <Output>(
  plan: ExecutionPlan,
  input: unknown,
): Promise<Awaited<Output>> =>
  run(plan.steps, input, asynchronous) as Awaited<Output>;

export const trace = <Output>(
  plan: ExecutionPlan,
  head: Node | undefined,
  input: unknown,
): TraceResult<Output> =>
  traceWith(plan, head, input, sync) as TraceResult<Output>;

export const traceAsync = async <Output>(
  plan: ExecutionPlan,
  head: Node | undefined,
  input: unknown,
): Promise<TraceResult<Awaited<Output>>> =>
  traceWith(plan, head, input, asynchronous) as TraceResult<Awaited<Output>>;
