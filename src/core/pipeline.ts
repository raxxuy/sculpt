import { resolveTransforms } from "./resolve";
import type { Derive, Entry, Step, Transform, TransformOptions } from "./types";

const emptyDependencies: string[] = [];

export class Pipeline<T> {
  private compiled?: Step[];

  constructor(
    private readonly data: unknown,
    private readonly entries: Entry[] = [],
    private readonly forkOnTransform = false,
  ) {}

  transform(transform: Transform<T>): Pipeline<T>;

  transform(
    name: string,
    transform: Transform<T>,
    options?: TransformOptions,
  ): Pipeline<T>;

  transform(
    nameOrTransform: string | Transform<T>,
    transform?: Transform<T>,
    options?: TransformOptions,
  ): Pipeline<T> {
    let entry: Extract<Entry, { kind: "transform" }>;

    if (typeof nameOrTransform === "string") {
      if (typeof transform !== "function") {
        throw new Error("Named transform requires transform function");
      }

      entry = {
        kind: "transform",
        name: nameOrTransform,
        transform,
        after: options?.after ? [...options.after] : emptyDependencies,
      };
    } else {
      entry = {
        kind: "transform",
        transform: nameOrTransform,
        after: emptyDependencies,
      };
    }

    const target = this.forkOnTransform
      ? new Pipeline<T>(this.data, [...this.entries])
      : this;

    target.entries.push(entry);
    target.compiled = undefined;

    return target;
  }

  snapshot(): Pipeline<T> {
    return new Pipeline<T>(this.data, [...this.entries], true);
  }

  derive<R>(derive: Derive<T, R>): Pipeline<R> {
    return new Pipeline<R>(this.data, [
      ...this.entries,
      { kind: "derive", derive },
    ]);
  }

  private compile(): Step[] {
    const steps: Step[] = [];
    const transforms: Extract<Entry, { kind: "transform" }>[] = [];

    const flush = () => {
      for (const { transform } of resolveTransforms(transforms)) {
        steps.push(transform);
      }

      transforms.length = 0;
    };

    for (const entry of this.entries) {
      if (entry.kind === "transform") transforms.push(entry);
      else {
        flush();
        steps.push(entry.derive);
      }
    }

    flush();
    return steps;
  }

  run(): T {
    if (!this.compiled) this.compiled = this.compile();

    const steps = this.compiled;
    let value = this.data;

    for (const step of steps) {
      value = step(value);
    }

    return value as T;
  }
}
