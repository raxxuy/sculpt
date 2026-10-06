import type { Derive, RegisteredTransform } from "./types";

type Context<T, R> = {
  transforms: RegisteredTransform<T>[];
  derive?: Derive<T, R>;
};

export type Node<T> =
  | { kind: "root"; data: unknown }
  | {
      kind: "transform";
      prev: Node<T>;
      registered: RegisteredTransform<T>;
    }
  | { kind: "derive"; prev: Node<T>; derive: Derive<T, unknown> };

export const collect = <T>(head: Node<T>) => {
  const nodes: Exclude<Node<T>, { kind: "root" }>[] = [];
  let node = head;

  while (node.kind !== "root") {
    nodes.push(node);
    node = node.prev;
  }

  const contexts: Context<T, unknown>[] = [{ transforms: [] }];

  for (const current of nodes.reverse()) {
    const context = contexts.at(-1) as Context<T, unknown>;

    if (current.kind === "transform") {
      context.transforms.push(current.registered);
    } else {
      context.derive = current.derive;
      contexts.push({ transforms: [] });
    }
  }

  return { data: node.data, contexts };
};
