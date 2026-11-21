import type { Node, TraceStep } from "./types";

export class StepError extends Error {
  override name = "StepError";
  readonly index: number;
  readonly kind: Node["kind"];
  readonly step?: string;
  readonly steps?: TraceStep[];

  constructor(node: Node, index: number, cause: unknown, steps?: TraceStep[]) {
    const label = node.name === undefined ? "" : ` "${node.name}"`;
    const reason = cause instanceof Error ? cause.message : String(cause);

    super(`Step ${index} (${node.kind}${label}) failed: ${reason}`, { cause });
    this.index = index;
    this.kind = node.kind;
    this.step = node.name;
    this.steps = steps;
  }
}

export class ValidationError extends Error {
  override name = "ValidationError";
}
