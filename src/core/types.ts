export type Transform<T> = (data: T) => T;

export type Derive<T, R> = (data: T) => R;

export type TransformOptions = {
  after?: string[];
};

export type RegisteredTransform<T> = {
  name?: string;
  transform: Transform<T>;
  after: string[];
};

export type Sculpt<Initial, Current = Initial> = {
  transform(transform: Transform<Current>): Sculpt<Initial, Current>;

  transform(
    name: string,
    transform: Transform<Current>,
    options?: TransformOptions,
  ): Sculpt<Initial, Current>;

  derive<R>(derive: Derive<Current, R>): Sculpt<Initial, R>;

  run(): Current;
};
