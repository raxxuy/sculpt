import { describe, test } from "vitest";
import { sculpt } from "../src";

const sizes = [10, 100, 1_000];

const increment = (value: number) => value + 1;
const identity = (value: number) => value;

const createPipeline = (count: number) => {
  const pipeline = sculpt(0);

  for (let i = 0; i < count; i++) {
    pipeline.transform(increment);
  }

  return pipeline;
};

const createDependentPipeline = (count: number, reverse = false) => {
  const pipeline = sculpt(0);

  for (let i = 0; i < count; i++) {
    const index = reverse ? count - i - 1 : i;

    pipeline.transform(`step-${index}`, increment, {
      after: index === 0 ? [] : [`step-${index - 1}`],
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

const createNative = (count: number, derived = false) => {
  const transforms: ((value: number) => number)[] = [];

  for (let i = 0; i < count; i++) {
    transforms.push(increment);
    if (derived) transforms.push(identity);
  }

  return transforms;
};

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

describe("cached execution", () => {
  for (const size of sizes) {
    test(`${size} transforms`, async ({ bench }) => {
      const pipeline = createPipeline(size);
      const transforms = createNative(size);

      pipeline.run();

      await bench.compare(
        bench("sculpt", () => pipeline.run()),
        bench("native", () => runNative(0, transforms)),
      );
    });
  }
});

describe("construction + first execution", () => {
  for (const size of sizes) {
    test(`${size} transforms`, async ({ bench }) => {
      await bench.compare(
        bench("sculpt", () => createPipeline(size).run()),
        bench("native", () => runNative(0, createNative(size))),
      );
    });
  }
});

describe("dependencies: cached execution", () => {
  for (const size of sizes) {
    test(`${size} chained dependencies`, async ({ bench }) => {
      const pipeline = createDependentPipeline(size);
      const transforms = createNative(size);

      pipeline.run();

      await bench.compare(
        bench("sculpt", () => pipeline.run()),
        bench("native", () => runNative(0, transforms)),
      );
    });
  }
});

describe("dependencies: construction + resolution + first execution", () => {
  for (const size of sizes) {
    test(`${size} chained dependencies`, async ({ bench }) => {
      await bench.compare(
        bench("ordered", () => createDependentPipeline(size).run()),
        bench("reversed", () => createDependentPipeline(size, true).run()),
      );
    });
  }
});

describe("derive boundaries: cached execution", () => {
  for (const size of sizes) {
    test(`${size} derive boundaries`, async ({ bench }) => {
      const pipeline = createDerivedPipeline(size);
      const transforms = createNative(size, true);

      pipeline.run();

      await bench.compare(
        bench("sculpt", () => pipeline.run()),
        bench("native", () => runNative(0, transforms)),
      );
    });
  }
});

describe("derive boundaries: construction + first execution", () => {
  for (const size of sizes) {
    test(`${size} derive boundaries`, async ({ bench }) => {
      await bench.compare(
        bench("sculpt", () => createDerivedPipeline(size).run()),
        bench("native", () => runNative(0, createNative(size, true))),
      );
    });
  }
});

describe("realistic workload", () => {
  test("1,000 rows", async ({ bench }) => {
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

    pipeline.run();

    await bench.compare(
      bench("sculpt", () => pipeline.run()),
      bench("native", () => total(summarize(normalize(filter(data))))),
    );
  });
});
