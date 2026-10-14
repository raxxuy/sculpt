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
