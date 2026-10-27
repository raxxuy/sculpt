import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { sculpt } from "../src";
import { validate } from "../src/transforms";

describe("validate", () => {
  it("returns the original reference when valid", () => {
    const input = Object.freeze({ price: 10 });
    const predicate = vi.fn((data: typeof input) => data.price >= 0);
    const result = validate(predicate, "Price must be non-negative")(input);

    expect(result).toBe(input);
    expect(predicate).toHaveBeenNthCalledWith(1, input);
  });

  it("infers the current pipeline shape without changing its output type", () => {
    const pipeline = sculpt({ price: 10 }).transform(
      validate((data) => {
        expectTypeOf(data).toEqualTypeOf<{ price: number }>();
        return data.price >= 0;
      }, "Price must be non-negative"),
    );

    expectTypeOf(pipeline.run()).toEqualTypeOf<{ price: number }>();
    expect(pipeline.run()).toEqual({ price: 10 });
  });

  it("throws the supplied message and skips downstream operations", () => {
    const next = vi.fn((data: { price: number }) => data);
    const pipeline = sculpt({ price: -10 })
      .transform(
        validate((data) => data.price >= 0, "Price must be non-negative"),
      )
      .transform(next);

    expect(() => pipeline.run()).toThrow("Price must be non-negative");
    expect(next).not.toHaveBeenCalled();
  });

  it("evaluates the current value after a shape-changing derivation", () => {
    const pipeline = sculpt(10)
      .derive((value) => ({ price: value - 15 }))
      .transform(
        validate((data) => data.price >= 0, "Price must be non-negative"),
      );

    expect(() => pipeline.run()).toThrow("Price must be non-negative");
    expect(pipeline.run(20)).toEqual({ price: 5 });
  });

  it("reevaluates on every run and remains usable after failure", () => {
    const predicate = vi.fn((value: number) => value >= 0);
    const pipeline = sculpt<number>().transform(
      validate(predicate, "Value must be non-negative"),
    );

    expect(pipeline.run(5)).toBe(5);
    expect(() => pipeline.run(-1)).toThrow("Value must be non-negative");
    expect(pipeline.run(0)).toBe(0);
    expect(predicate.mock.calls).toEqual([[5], [-1], [0]]);
  });

  it.each([0, false, "", null, undefined])(
    "preserves valid falsy input %s",
    (input) => {
      const check = validate<typeof input>(() => true, "Invalid value");
      expect(check(input)).toBe(input);
    },
  );

  it("does not run the predicate during registration or inspection", () => {
    const predicate = vi.fn((value: number) => value >= 0);
    const check = validate(predicate, "Value must be non-negative");
    const pipeline = sculpt(5).transform(check);

    pipeline.inspect();
    expect(predicate).not.toHaveBeenCalled();
    expect(pipeline.run()).toBe(5);
    expect(predicate).toHaveBeenNthCalledWith(1, 5);
  });

  it("supports tracing and stops on invalid input", () => {
    const next = vi.fn((value: number) => value * 2);
    const pipeline = sculpt(5)
      .transform(
        "validate",
        validate((value) => value >= 0, "Value must be non-negative"),
      )
      .transform(next);
    const trace = pipeline.trace();

    expect(trace.result).toBe(10);
    expect(trace.steps[0]).toMatchObject({
      kind: "transform",
      name: "validate",
      input: 5,
      output: 5,
    });
    next.mockClear();
    expect(() => pipeline.trace(-1)).toThrow("Value must be non-negative");
    expect(next).not.toHaveBeenCalled();
  });

  it("propagates predicate errors unchanged", () => {
    expect.assertions(1);
    const error = new Error("Predicate failed");
    const check = validate((_value: number): boolean => {
      throw error;
    }, "Invalid value");

    try {
      check(5);
    } catch (cause) {
      expect(cause).toBe(error);
    }
  });

  it("rejects asynchronous predicates and incompatible input types", () => {
    const checkTypes = () => {
      // @ts-expect-error Validation predicates must return a synchronous boolean.
      validate(async (_value: number) => true, "Invalid value");
      const check = validate((value: number) => value >= 0, "Invalid value");
      // @ts-expect-error The transform retains its predicate's input type.
      check("5");
      // @ts-expect-error A failure message is required.
      validate((value: number) => value >= 0);
    };

    expectTypeOf(checkTypes).toBeFunction();
  });
});
