import type { Node, Plan } from "./types";

const quote = (name?: string) => JSON.stringify(name);

export const collect = (
  head: Node | undefined,
  next: (node: Node) => Node | undefined,
) => {
  const nodes: Node[] = [];
  for (let node = head; node; node = next(node)) nodes.push(node);
  return nodes.reverse();
};

export const openScope = (head?: Node) => {
  const transforms: Node[] = [];
  let node = head;

  for (; node?.kind === "transform"; node = node.previous) {
    transforms.push(node);
  }

  return { transforms: transforms.reverse(), derive: node };
};

const positionsByName = (transforms: Node[]) => {
  const positions = new Map<string, number>();

  transforms.forEach((node, position) => {
    if (node.name === undefined) return;

    const first = positions.get(node.name);
    if (first !== undefined) {
      throw new Error(
        `Duplicate transform name ${quote(node.name)} in scope ${node.scope} (declared indexes ${transforms[first]?.index} and ${node.index})`,
      );
    }

    positions.set(node.name, position);
  });

  return positions;
};

const positionOf = (
  name: string,
  node: Node,
  positions: Map<string, number>,
) => {
  const position = positions.get(name);
  if (position === undefined) {
    throw new Error(
      `Unknown transform dependency ${quote(name)} required by ${quote(node.name)}`,
    );
  }
  return position;
};

const cycleError = (
  transforms: Node[],
  positions: Map<string, number>,
  pending: number[],
) => {
  const isBlocked = (position: number) => (pending[position] ?? 0) > 0;
  const path: number[] = [];
  let position = pending.findIndex((count) => count > 0);

  while (!path.includes(position)) {
    path.push(position);
    position =
      transforms[position]?.after
        .map((name) => positions.get(name) ?? -1)
        .find(isBlocked) ?? -1;
  }

  const cycle = [...path.slice(path.indexOf(position)), position];
  const names = cycle.map((p) => quote(transforms[p]?.name));

  return new Error(`Circular transform dependencies: ${names.join(" -> ")}`);
};

// Kahn's algorithm with a FIFO queue: ready transforms run in the order they became ready.
export const orderScope = (transforms: Node[]): Node[] => {
  const positions = positionsByName(transforms);

  if (transforms.every((node) => node.after.length === 0)) return transforms;

  const pending = transforms.map((node) => node.after.length);
  const dependents = transforms.map((): number[] => []);

  transforms.forEach((node, position) => {
    for (const name of node.after) {
      dependents[positionOf(name, node, positions)]?.push(position);
    }
  });

  const queue = [...pending.keys()].filter(
    (position) => pending[position] === 0,
  );

  for (const position of queue) {
    for (const next of dependents[position] ?? []) {
      pending[next] = (pending[next] ?? 0) - 1;
      if (pending[next] === 0) queue.push(next);
    }
  }

  if (queue.length < transforms.length) {
    throw cycleError(transforms, positions, pending);
  }

  return queue.map((position) => transforms[position] as Node);
};

const toPlan = (nodes: Node[]): Plan => ({
  steps: nodes.map((node) => node.fn),
  nodes,
});

export const compile = (head?: Node): Plan => {
  const { transforms, derive } = openScope(head);
  const open = orderScope(transforms);

  if (!derive) return toPlan(open);

  const closed = collect(derive, (node) => node.previousDerive).flatMap(
    (node) => [...(node.ordered ?? []), node],
  );

  return toPlan(closed.concat(open));
};
