import { describe, expect, it } from "vitest";
import { sculpt } from "../src";

describe("pipeline behavior", () => {
  it("mutates ordinary pipelines when registering transforms", () => {
    const base = sculpt(10);
    const extended = base.transform((value) => value + 5);

    expect(extended).toBe(base);
    expect(base.run()).toBe(15);
  });

  it("creates independent branches from a snapshot base", () => {
    const base = sculpt(10).snapshot();

    const first = base.transform((value) => value * 2);
    const second = base.transform((value) => value + 5);

    expect(first).not.toBe(base);
    expect(second).not.toBe(base);
    expect(first).not.toBe(second);

    expect(first.run()).toBe(20);
    expect(second.run()).toBe(15);
    expect(base.run()).toBe(10);
  });

  it("preserves registered transforms when taking a snapshot", () => {
    const original = sculpt(10).transform((value) => value * 2);
    const base = original.snapshot();

    original.transform((value) => value + 100);
    const branch = base.transform((value) => value + 5);

    expect(original.run()).toBe(120);
    expect(base.run()).toBe(20);
    expect(branch.run()).toBe(25);
  });

  it("makes returned snapshot branches mutable", () => {
    const base = sculpt(10).snapshot();
    const branch = base.transform((value) => value * 2);
    const extended = branch.transform((value) => value + 5);

    expect(extended).toBe(branch);
    expect(branch.run()).toBe(25);
    expect(base.run()).toBe(10);
  });

  it("supports independent derived shapes", () => {
    const base = sculpt(10);

    const text = base.derive((value) => ({ text: String(value) }));
    const numeric = base.derive((value) => ({ value: value * 3 }));

    text.transform((data) => ({ text: `${data.text}!` }));
    base.transform((value) => value + 100);

    expect(text.run()).toEqual({ text: "10!" });
    expect(numeric.run()).toEqual({ value: 30 });
    expect(base.run()).toBe(110);
  });

  it("invalidates compiled steps after adding a transform", () => {
    const pipeline = sculpt(10).transform((value) => value * 2);

    expect(pipeline.run()).toBe(20);

    pipeline.transform((value) => value + 5);

    expect(pipeline.run()).toBe(25);
    expect(pipeline.run()).toBe(25);
  });

  it("executes callbacks again on every run", () => {
    let calls = 0;

    const pipeline = sculpt(10).transform((value) => {
      calls++;
      return value + calls;
    });

    expect(pipeline.run()).toBe(11);
    expect(pipeline.run()).toBe(12);
    expect(calls).toBe(2);
  });

  it("creates fresh branches from an already compiled snapshot", () => {
    const base = sculpt(10)
      .transform((value) => value * 2)
      .snapshot();

    expect(base.run()).toBe(20);

    const branch = base.transform((value) => value + 5);

    expect(branch.run()).toBe(25);
    expect(base.run()).toBe(20);
  });
});

describe("pipeline dependencies", () => {
  it("reorders transforms before the first run", () => {
    const pipeline = sculpt(10)
      .transform("increment", (value) => value + 5, {
        after: ["double"],
      })
      .transform("double", (value) => value * 2);

    expect(pipeline.run()).toBe(25);
    expect(pipeline.run()).toBe(25);
  });

  it("resolves newly registered dependencies after a cached run", () => {
    const pipeline = sculpt(10);

    expect(pipeline.run()).toBe(10);

    pipeline
      .transform("increment", (value) => value + 5, {
        after: ["double"],
      })
      .transform("double", (value) => value * 2);

    expect(pipeline.run()).toBe(25);
  });

  it("copies supplied dependency arrays", () => {
    const after = ["double"];

    const pipeline = sculpt(10)
      .transform("increment", (value) => value + 5, { after })
      .transform("double", (value) => value * 2);

    after.length = 0;

    expect(pipeline.run()).toBe(25);
  });

  it("rejects unknown dependencies", () => {
    const pipeline = sculpt(10).transform("increment", (value) => value + 5, {
      after: ["missing"],
    });

    expect(() => pipeline.run()).toThrow(
      'Unknown transform dependency "missing"',
    );
  });

  it("rejects circular dependencies", () => {
    const pipeline = sculpt(10)
      .transform("first", (value) => value + 1, {
        after: ["second"],
      })
      .transform("second", (value) => value * 2, {
        after: ["first"],
      });

    expect(() => pipeline.run()).toThrow("Circular transform dependencies");
  });

  it("can recover from a missing dependency by registering it", () => {
    const pipeline = sculpt(10).transform("increment", (value) => value + 5, {
      after: ["double"],
    });

    expect(() => pipeline.run()).toThrow(
      'Unknown transform dependency "double"',
    );

    pipeline.transform("double", (value) => value * 2);

    expect(pipeline.run()).toBe(25);
  });

  it("resolves transforms independently on both sides of derive", () => {
    const pipeline = sculpt(10)
      .transform("increment", (value) => value + 5, {
        after: ["double"],
      })
      .transform("double", (value) => value * 2)
      .derive((value) => ({ value }))
      .transform(
        "increment",
        (data) => ({
          value: data.value + 1,
        }),
        {
          after: ["double"],
        },
      )
      .transform("double", (data) => ({
        value: data.value * 2,
      }));

    expect(pipeline.run()).toEqual({ value: 51 });
  });

  it("rejects dependencies pointing into an earlier context", () => {
    const pipeline = sculpt(10)
      .transform("double", (value) => value * 2)
      .derive((value) => ({ value }))
      .transform(
        "increment",
        (data) => ({
          value: data.value + 1,
        }),
        {
          after: ["double"],
        },
      );

    expect(() => pipeline.run()).toThrow(
      'Unknown transform dependency "double"',
    );
  });

  it("rejects dependencies pointing into a later context", () => {
    const pipeline = sculpt(10)
      .transform("increment", (value) => value + 1, {
        after: ["double"],
      })
      .derive((value) => ({ value }))
      .transform("double", (data) => ({
        value: data.value * 2,
      }));

    expect(() => pipeline.run()).toThrow(
      'Unknown transform dependency "double"',
    );
  });
});
