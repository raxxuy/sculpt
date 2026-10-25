export type MaybePromise<T> = T | PromiseLike<T>;

export type Transform<T> = (data: T) => T;

export type Derive<T, R> = (data: T) => R;

export type TransformOptions = {
  after?: string[];
};

export type CheckedTransform<T, R extends MaybePromise<T>> = (
  data: T,
) => R &
  ([Awaited<R>] extends [never]
    ? unknown
    : Record<Exclude<keyof Awaited<R>, keyof T>, never>);

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
