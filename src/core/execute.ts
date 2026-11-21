import type { Plan, TraceResult, TraceStep } from "./types";

export const trace = <Output>(
  plan: Plan,
  input: unknown,
): TraceResult<Output> => {
  const steps: TraceStep[] = [];

  const result = plan.nodes.reduce((value, node, index) => {
    const startedAt = performance.now();
    const output = node.fn(value);

    steps.push({
      index,
      kind: node.kind,
      ...(node.name !== undefined && { name: node.name }),
      durationMs: performance.now() - startedAt,
      input: value,
      output,
    });

    return output;
  }, input);

  return { result: result as Output, steps };
};
