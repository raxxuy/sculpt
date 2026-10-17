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

export type Entry =
  | {
      kind: "transform";
      name?: string;
      transform: Step;
      after: string[];
    }
  | {
      kind: "derive";
      derive: Step;
    };

export type Node = {
  entry: Entry;
  previous?: Node;
};

export type StepMetadata = {
  kind: "transform" | "derive";
  name?: string;
};

export type ExecutionPlan = {
  steps: Step[];
  metadata: StepMetadata[];
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
