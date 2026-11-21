export type Transform<T> = (data: T) => T;

export type Derive<T, R> = (data: T) => R;

export type TransformOptions = {
  after?: string[];
};

export type CheckedTransform<T, R extends T> = (
  data: T,
) => R &
  ([R] extends [never] ? unknown : Record<Exclude<keyof R, keyof T>, never>);

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous pipeline steps
export type Step = (data: any) => any;

export type Node = {
  kind: "transform" | "derive";
  name?: string;
  fn: Step;
  after: string[];
  index: number;
  scope: number;
  previous?: Node;
  ordered?: Node[];
  previousDerive?: Node;
};

export type Plan = {
  steps: Step[];
  nodes: Node[];
};

export type InspectionStep = {
  declaredIndex: number;
  executionIndex: number;
  scope: number;
} & (
  | { kind: "transform"; name?: string; after: string[] }
  | { kind: "derive" }
);

export type PipelineInspection = {
  steps: InspectionStep[];
};

export type TraceStep = {
  index: number;
  kind: "transform" | "derive";
  name?: string;
  durationMs: number;
  input: unknown;
  output: unknown;
};

export type TraceResult<T> = {
  result: T;
  steps: TraceStep[];
};
