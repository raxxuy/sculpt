import { describe, expect, it, vi } from "vitest";
import { sculpt } from "../src";

describe("use", () => {
  it("appends another pipeline's transforms in order", () => {
    const other = sculpt<number>()
      .transform((value) => value * 2)
      .transform((value) => value + 3);

    const result = sculpt(5)
      .transform((value) => value + 1)
      .use(other)
      .transform((value) => value * 10)
      .run();

    expect(result).toBe(150);
  });

  it("composes multiple pipelines across output type changes", () => {
    const summarize = sculpt<number>().derive((value) => ({ total: value }));
    const format = sculpt<{ total: number }>()
      .transform((data) => ({ total: data.total * 2 }))
      .derive((data) => `Total: ${data.total}`);

    expect(sculpt(5).use(summarize).use(format).run()).toBe("Total: 10");
  });

  it("keeps the receiver's default and accepts new original inputs", () => {
    const other = sculpt(100).transform((value) => value * 2);
    const pipeline = sculpt(5).use(other);

    expect(pipeline.run()).toBe(10);
    expect(pipeline.run(7)).toBe(14);
    expect(pipeline.run()).toBe(10);
    expect(other.run()).toBe(200);
  });

  it("supports a receiver without a default", () => {
    const pipeline = sculpt<number>().use(
      sculpt(100).derive((value) => ({ value })),
    );

    expect(pipeline.run(4)).toEqual({ value: 4 });
  });

  it("does not modify either pipeline or previously created branches", () => {
    const base = sculpt(5).transform((value) => value + 1);
    const other = sculpt(10).transform((value) => value * 2);
    const combined = base.use(other);
    const extended = other.transform((value) => value + 100);

    expect(combined).not.toBe(base);
    expect(base.run()).toBe(6);
    expect(other.run()).toBe(20);
    expect(extended.run()).toBe(120);
    expect(combined.run()).toBe(12);
  });

  it("treats an empty imported pipeline as an identity operation", () => {
    const input = { value: 5 };
    const pipeline = sculpt(input).use(sculpt({ value: 100 }));

    expect(pipeline.run()).toBe(input);
  });

  it("does not execute callbacks during composition", () => {
    const callback = vi.fn((value: number) => value * 2);
    const pipeline = sculpt(5).use(sculpt<number>().transform(callback));

    expect(callback).not.toHaveBeenCalled();
    expect(pipeline.run()).toBe(10);
    expect(callback).toHaveBeenCalledWith(5);
  });

  it("resolves dependencies across use boundaries", () => {
    const increment = sculpt<number>().transform(
      "increment",
      (value) => value + 5,
      { after: ["double"] },
    );
    const double = sculpt<number>().transform("double", (value) => value * 2);

    expect(sculpt(10).use(increment).use(double).run()).toBe(25);
  });

  it("preserves derivation boundaries when importing operations", () => {
    const other = sculpt<number>()
      .derive((value) => value)
      .transform("increment", (value) => value + 1, { after: ["double"] });
    const pipeline = sculpt(5)
      .transform("double", (value) => value * 2)
      .use(other);

    expect(() => pipeline.run()).toThrow(
      'Unknown transform dependency "double"',
    );
  });

  it("allows the same transform name in separate derivation scopes", () => {
    const other = sculpt<number>()
      .derive((value) => value)
      .transform("double", (value) => value * 2);

    expect(
      sculpt(5)
        .transform("double", (value) => value * 2)
        .use(other)
        .run(),
    ).toBe(20);
  });

  it("composes registered operations even after both pipelines have run", () => {
    const base = sculpt(5).transform((value) => value + 1);
    const other = sculpt(10).transform((value) => value * 2);

    expect(base.run()).toBe(6);
    expect(other.run()).toBe(20);

    const combined = base.use(other);

    expect(combined.run()).toBe(12);
    expect(combined.run(10)).toBe(22);
    expect(base.run()).toBe(6);
    expect(other.run()).toBe(20);
  });

  it("can reuse the same pipeline more than once", () => {
    const double = sculpt<number>().transform((value) => value * 2);

    expect(sculpt(3).use(double).use(double).run()).toBe(12);
  });

  it("rejects a cycle introduced by composition before executing callbacks", () => {
    const first = vi.fn((value: number) => value + 1);
    const second = vi.fn((value: number) => value * 2);
    const pipeline = sculpt(5)
      .transform("first", first, { after: ["second"] })
      .use(sculpt<number>().transform("second", second, { after: ["first"] }));

    expect(() => pipeline.run()).toThrow("Circular transform dependencies");
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });
});
