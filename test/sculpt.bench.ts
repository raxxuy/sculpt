import { describe, test } from "vitest";
import { sculpt } from "../src";

const sizes = [10, 100, 1_000];

const increment = (value: number) => value + 1;
const identity = (value: number) => value;

const createPipeline = (count: number) => {
  let pipeline = sculpt(0);

  for (let i = 0; i < count; i++) {
    pipeline = pipeline.transform(increment);
  }

  return pipeline;
};

const createDependentPipeline = (count: number) => {
  let pipeline = sculpt(0);

  for (let i = 0; i < count; i++) {
    pipeline = pipeline.transform(`step-${i}`, increment, {
      after: i === 0 ? [] : [`step-${i - 1}`],
    });
  }

  return pipeline;
};

const createDerivedPipeline = (count: number) => {
  let pipeline = sculpt(0);

  for (let i = 0; i < count; i++) {
    pipeline = pipeline.transform(increment).derive(identity);
  }

  return pipeline;
};

const createNative = (count: number) =>
  Array.from({ length: count }, () => increment);

const runNative = (
  initial: number,
  transforms: ((value: number) => number)[],
) => {
  let value = initial;

  for (const transform of transforms) {
    value = transform(value);
  }

  return value;
};

describe("execution", () => {
  for (const size of sizes) {
    const pipeline = createPipeline(size);
    const transforms = createNative(size);

    test(`${size} transforms`, async ({ bench }) => {
      await bench.compare(
        bench("sculpt", () => pipeline.run()),
        bench("native", () => runNative(0, transforms)),
      );
    });
  }
});

describe("construction + execution", () => {
  for (const size of sizes) {
    test(`${size} transforms`, async ({ bench }) => {
      await bench.compare(
        bench("sculpt", () => createPipeline(size).run()),
        bench("native", () => runNative(0, createNative(size))),
      );
    });
  }
});

describe("dependencies", () => {
  for (const size of sizes) {
    const pipeline = createDependentPipeline(size);
    const transforms = createNative(size);

    test(`${size} chained dependencies`, async ({ bench }) => {
      await bench.compare(
        bench("sculpt", () => pipeline.run()),
        bench("native", () => runNative(0, transforms)),
      );
    });
  }
});

describe("derive boundaries", () => {
  for (const size of sizes) {
    const pipeline = createDerivedPipeline(size);
    const transforms = createNative(size);

    test(`${size} derive boundaries`, async ({ bench }) => {
      await bench.compare(
        bench("sculpt", () => pipeline.run()),
        bench("native", () => {
          let value = 0;

          for (const transform of transforms) {
            value = identity(transform(value));
          }

          return value;
        }),
      );
    });
  }
});

describe("realistic workload", () => {
  const data = Array.from({ length: 1_000 }, (_, i) => ({
    id: i,
    value: i,
    active: i % 2 === 0,
  }));

  const filter = (rows: typeof data) => rows.filter((row) => row.active);

  const normalize = (rows: typeof data) =>
    rows.map((row) => ({
      ...row,
      value: row.value / 1_000,
    }));

  const summarize = (rows: typeof data) => ({
    rows,
    count: rows.length,
  });

  const total = (result: ReturnType<typeof summarize>) => ({
    ...result,
    total: result.rows.reduce((sum, row) => sum + row.value, 0),
  });

  const pipeline = sculpt(data)
    .transform("filter", filter)
    .transform("normalize", normalize, {
      after: ["filter"],
    })
    .derive(summarize)
    .derive(total);

  test("1,000 rows", async ({ bench }) => {
    await bench.compare(
      bench("sculpt", () => pipeline.run()),
      bench("native", () => total(summarize(normalize(filter(data))))),
    );
  });
});
