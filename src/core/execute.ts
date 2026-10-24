import { declared } from "./nodes";
import type {
  ExecutionPlan,
  Node,
  Step,
  StepMetadata,
  TraceResult,
  TraceStep,
} from "./types";

const describe = (node: Node): StepMetadata =>
  node.kind === "transform"
    ? { kind: "transform", name: node.name }
    : { kind: "derive" };

export const execute = <Output>(
  plan: ExecutionPlan,
  input: unknown,
): Output => {
  let value = input;

  for (const step of plan.steps) {
    value = step(value);
  }

  return value as Output;
};

export const trace = <Output>(
  plan: ExecutionPlan,
  head: Node | undefined,
  input: unknown,
): TraceResult<Output> => {
  const { steps } = plan;
  const nodes = plan.nodes ?? declared(head);
  const records: TraceStep[] = [];
  let value = input;

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
};
