import * as nodeHelpers from "./nodes";
import * as resolver from "./resolve";
import type { ExecutionPlan, Node, Step } from "./types";

const { declared } = nodeHelpers;
const { resolveTransforms } = resolver;

export const compile = (head?: Node): ExecutionPlan => {
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
};
