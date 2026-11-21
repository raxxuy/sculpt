import { StepError } from "./errors";
import type { Context, Plan, TraceResult, TraceStep } from "./types";

export const trace = <Output>(
  plan: Plan,
  input: unknown,
  context: Context,
): TraceResult<Output> => {
  const steps: TraceStep[] = [];

  const result = plan.nodes.reduce((value, node, index) => {
    const startedAt = performance.now();

    try {
      const output = node.fn(value, context);

      steps.push({
        index,
        kind: node.kind,
        ...(node.name !== undefined && { name: node.name }),
        durationMs: performance.now() - startedAt,
        input: value,
        output,
      });

      return output;
    } catch (error) {
      throw new StepError(node, index, error, steps);
    }
  }, input);

  return { result: result as Output, steps };
};
