export type Context<Params = unknown> = { readonly params: Params };

export type ContextArgs<Params> = unknown extends Params
  ? [context?: Context<Params>]
  : [context: Context<Params>];

export type Fn<T, R, Params = unknown> = (
  data: T,
  ...context: ContextArgs<Params>
) => R;

export type Call<T, R, Params = unknown> = (
  data: T,
  context?: Context<Params>,
) => R;

export type Transform<T, Params = unknown> = Fn<T, T, Params>;

export type Derive<T, R, Params = unknown> = Fn<T, R, Params>;

export type Predicate<T, Params = unknown> = Fn<T, boolean, Params>;

export type TransformOptions = {
  after?: string[];
};

export type CheckedTransform<T, R extends T, Params = unknown> = Fn<
  T,
  R &
    ([R] extends [never] ? unknown : Record<Exclude<keyof R, keyof T>, never>),
  Params
>;

export type PipelineState = {
  hasDefault: boolean;
  params: unknown;
  bound: boolean;
};

export type DefaultState = { hasDefault: true; params: unknown; bound: true };

export type Patch<
  S extends PipelineState,
  Changes extends Partial<PipelineState>,
> = {
  [K in keyof S]: K extends keyof Changes ? Changes[K] : S[K];
};

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous pipeline steps
export type Step = (data: any, context?: Context<any>) => any;

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
