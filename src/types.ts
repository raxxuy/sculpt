export type Transform<T> = (data: T) => T;

export type TransformOptions = {
  after?: string[];
};

export type RegisteredTransform<T> = {
  name?: string;
  transform: Transform<T>;
  after: string[];
};

export type Sculpt<T> = {
  transform(transform: Transform<T>, options?: TransformOptions): Sculpt<T>;

  transform(
    name: string,
    transform: Transform<T>,
    options?: TransformOptions,
  ): Sculpt<T>;

  run(): T;
};
