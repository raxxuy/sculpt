import * as nodeHelpers from "./nodes";
import type {
  ExecutionPlan,
  InspectionStep,
  Node,
  PipelineInspection,
} from "./types";

const { declared } = nodeHelpers;

export const inspect = (
  plan: ExecutionPlan,
  head?: Node,
): PipelineInspection => {
  let scope = 0;
  const steps = (plan.nodes ?? declared(head)).map<InspectionStep>(
    (node, executionIndex) => {
      const metadata = {
        declaredIndex: node.size - 1,
        executionIndex,
        scope,
      };

      if (node.kind === "derive") {
        scope++;
        return { ...metadata, kind: "derive" };
      }

      return {
        ...metadata,
        kind: "transform",
        name: node.name,
        after: [...node.after],
      };
    },
  );

  return { steps };
};
