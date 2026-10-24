import type { Node, Step } from "./types";

export const emptyDependencies: string[] = [];

export const link = (
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

export const declared = (head?: Node): Node[] => {
  const size = head?.size ?? 0;
  const nodes: Node[] = new Array(size);
  let index = size;

  for (let node = head; node; node = node.previous) nodes[--index] = node;

  return nodes;
};

export const append = (
  head: Node | undefined,
  other?: Node,
): Node | undefined => {
  for (const node of declared(other)) {
    head = link(node.kind, node.name, node.fn, node.after, head);
  }

  return head;
};
