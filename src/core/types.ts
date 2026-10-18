export type Transform<T> = (data: T) => T;

export type Derive<T, R> = (data: T) => R;

export type TransformOptions = {
  after?: string[];
};

export type CheckedTransform<T, R extends T> = (
  data: T,
) => R & Record<Exclude<keyof R, keyof T>, never>;

export type RegisteredTransform<T> = {
  name?: string;
  transform: Transform<T>;
  after: string[];
};

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous pipeline steps
export type Step = (data: any) => any;

export type Node = {
  kind: "transform" | "derive";
  name?: string;
  fn: Step;
  after: string[];
  previous?: Node;
  size: number;
  constrained: boolean;
};

export type StepMetadata = {
  kind: "transform" | "derive";
  name?: string;
};

export type ExecutionPlan = {
  steps: Step[];
  nodes?: Node[];
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
