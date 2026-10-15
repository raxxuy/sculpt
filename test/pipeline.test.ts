import { describe, expect, it } from "vitest";
import { sculpt } from "../src";

describe("pipeline behavior", () => {
  it("returns a new pipeline when registering transforms", () => {
    const base = sculpt(10);
    const extended = base.transform((value) => value + 5);

    expect(extended).not.toBe(base);
    expect(base.run()).toBe(10);
    expect(extended.run()).toBe(15);
  });

  it("creates independent branches without snapshots", () => {
    const base = sculpt(10).transform((value) => value * 2);
    const first = base.transform((value) => value + 5);
    const second = base.transform((value) => value - 5);

    expect(base.run()).toBe(20);
    expect(first.run()).toBe(25);
    expect(second.run()).toBe(15);
  });

  it("keeps branches immutable", () => {
    const base = sculpt(10);
    const branch = base.transform((value) => value * 2);
    const extended = branch.transform((value) => value + 5);

    expect(extended).not.toBe(branch);
    expect(base.run()).toBe(10);
    expect(branch.run()).toBe(20);
    expect(extended.run()).toBe(25);
  });

  it("preserves snapshot branching behavior", () => {
    const base = sculpt(10).transform((value) => value * 2);

    const first = base.transform((value) => value + 5);
    const second = base.transform((value) => value - 5);

    expect(base.run()).toBe(20);
    expect(first.run()).toBe(25);
    expect(second.run()).toBe(15);
  });

  it("supports independent derived shapes", () => {
    const base = sculpt(10);
    const text = base
      .derive((value) => ({ text: String(value) }))
      .transform((data) => ({ text: `${data.text}!` }));
    const numeric = base.derive((value) => ({ value: value * 3 }));
    const extended = base.transform((value) => value + 100);

    expect(text.run()).toEqual({ text: "10!" });
    expect(numeric.run()).toEqual({ value: 30 });
    expect(extended.run()).toBe(110);
    expect(base.run()).toBe(10);
  });

  it("extends a compiled pipeline without changing its result", () => {
    const base = sculpt(10).transform((value) => value * 2);

    expect(base.run()).toBe(20);

    const extended = base.transform((value) => value + 5);

    expect(extended.run()).toBe(25);
    expect(extended.run()).toBe(25);
    expect(base.run()).toBe(20);
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

  it("accepts new input without replacing the default", () => {
    const pipeline = sculpt(10)
      .transform((value) => value * 2)
      .derive((value) => ({ value }));

    expect(pipeline.run()).toEqual({ value: 20 });
    expect(pipeline.run(5)).toEqual({ value: 10 });
    expect(pipeline.run()).toEqual({ value: 20 });
  });

  it("supports pipelines without default input", () => {
    const pipeline = sculpt<number>()
      .transform((value) => value * 2)
      .derive((value) => ({ value }));

    expect(pipeline.run(5)).toEqual({ value: 10 });
    expect(pipeline.run(10)).toEqual({ value: 20 });
  });

  it("distinguishes explicit undefined from omitted input", () => {
    const pipeline = sculpt<number | undefined>(10).derive(
      (value) => value ?? 0,
    );

    expect(pipeline.run()).toBe(10);
    expect(pipeline.run(undefined)).toBe(0);
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

  it("resolves dependencies on a branch after a cached run", () => {
    const base = sculpt(10);

    expect(base.run()).toBe(10);

    const branch = base
      .transform("increment", (value) => value + 5, {
        after: ["double"],
      })
      .transform("double", (value) => value * 2);

    expect(branch.run()).toBe(25);
    expect(base.run()).toBe(10);
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

  it("resolves a missing dependency in an extended pipeline", () => {
    const base = sculpt(10).transform("increment", (value) => value + 5, {
      after: ["double"],
    });

    expect(() => base.run()).toThrow('Unknown transform dependency "double"');

    const extended = base.transform("double", (value) => value * 2);

    expect(extended.run()).toBe(25);
    expect(() => base.run()).toThrow('Unknown transform dependency "double"');
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

describe("pipeline edge cases", () => {
  it("runs newly unblocked transforms before later ready transforms", () => {
    const order: string[] = [];

    sculpt(0)
      .transform(
        "a",
        (value) => {
          order.push("a");
          return value;
        },
        { after: ["b"] },
      )
      .transform("b", (value) => {
        order.push("b");
        return value;
      })
      .transform((value) => {
        order.push("c");
        return value;
      })
      .run();

    expect(order).toEqual(["b", "a", "c"]);
  });

  it("handles repeated dependency names", () => {
    const result = sculpt(10)
      .transform("increment", (value) => value + 5, {
        after: ["double", "double"],
      })
      .transform("double", (value) => value * 2)
      .run();

    expect(result).toBe(25);
  });

  it("rejects self-dependencies", () => {
    const pipeline = sculpt(10).transform("double", (value) => value * 2, {
      after: ["double"],
    });

    expect(() => pipeline.run()).toThrow("Circular transform dependencies");
  });

  it("shares input data across snapshot branches", () => {
    const data = { value: 10 };
    const base = sculpt(data);

    const branch = base.transform((value) => {
      value.value += 5;
      return value;
    });

    expect(branch.run()).toBe(data);
    expect(base.run()).toBe(data);
    expect(data.value).toBe(15);
  });

  it("validates all dependency scopes before executing callbacks", () => {
    let calls = 0;

    const pipeline = sculpt(10)
      .transform((value) => {
        calls++;
        return value;
      })
      .derive((value) => ({ value }))
      .transform("increment", (data) => data, {
        after: ["missing"],
      });

    expect(() => pipeline.run()).toThrow(
      'Unknown transform dependency "missing"',
    );
    expect(calls).toBe(0);
  });

  it("accepts new input after derive without replacing the default", () => {
    const pipeline = sculpt(10)
      .transform((value) => value * 2)
      .derive((value) => ({ value }));

    expect(pipeline.run()).toEqual({ value: 20 });
    expect(pipeline.run(5)).toEqual({ value: 10 });
    expect(pipeline.run()).toEqual({ value: 20 });
  });

  it("distinguishes explicit undefined from omitted input", () => {
    const pipeline = sculpt<number | undefined>(10).derive(
      (value) => value ?? 0,
    );

    expect(pipeline.run()).toBe(10);
    expect(pipeline.run(undefined)).toBe(0);
  });
});
