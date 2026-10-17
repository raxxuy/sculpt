import { afterEach, describe, expect, it, vi } from "vitest";
import { sculpt } from "../src";

describe("trace", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the final result and each step's input and output", () => {
    const trace = sculpt(10)
      .transform("double", (value) => value * 2)
      .transform("increment", (value) => value + 5)
      .trace();

    expect(trace.result).toBe(25);
    expect(trace.steps).toEqual([
      {
        index: 0,
        kind: "transform",
        name: "double",
        input: 10,
        output: 20,
        durationMs: expect.any(Number),
      },
      {
        index: 1,
        kind: "transform",
        name: "increment",
        input: 20,
        output: 25,
        durationMs: expect.any(Number),
      },
    ]);
  });

  it("records anonymous transforms and shape-changing derivations", () => {
    const trace = sculpt(5)
      .transform((value) => value * 2)
      .derive((value) => ({ total: value }))
      .derive((data) => `Total: ${data.total}`)
      .trace();

    expect(trace.result).toBe("Total: 10");
    expect(trace.steps).toHaveLength(3);
    expect(
      trace.steps.map(({ index, kind, name, input, output }) => ({
        index,
        kind,
        name,
        input,
        output,
      })),
    ).toEqual([
      { index: 0, kind: "transform", name: undefined, input: 5, output: 10 },
      {
        index: 1,
        kind: "derive",
        name: undefined,
        input: 10,
        output: { total: 10 },
      },
      {
        index: 2,
        kind: "derive",
        name: undefined,
        input: { total: 10 },
        output: "Total: 10",
      },
    ]);
  });

  it("records resolved order and metadata across use boundaries", () => {
    const increment = sculpt<number>().transform(
      "increment",
      (value) => value + 5,
      { after: ["double"] },
    );
    const double = sculpt<number>().transform("double", (value) => value * 2);
    const trace = sculpt(10).use(increment).use(double).trace();

    expect(trace.result).toBe(25);
    expect(
      trace.steps.map(({ index, name, input, output }) => ({
        index,
        name,
        input,
        output,
      })),
    ).toEqual([
      { index: 0, name: "double", input: 10, output: 20 },
      { index: 1, name: "increment", input: 20, output: 25 },
    ]);
  });

  it("returns an empty trace for a pipeline without operations", () => {
    const input = { value: 5 };
    const trace = sculpt(input).trace();

    expect(trace.result).toBe(input);
    expect(trace.steps).toEqual([]);
  });

  it("accepts original inputs after derivation without replacing the default", () => {
    const pipeline = sculpt(5).derive((value) => ({ value }));

    expect(pipeline.trace(9).result).toEqual({ value: 9 });
    expect(pipeline.trace().result).toEqual({ value: 5 });
  });

  it("supports a pipeline without a default", () => {
    const trace = sculpt<number>()
      .transform((value) => value * 2)
      .trace(7);

    expect(trace.result).toBe(14);
    expect(trace.steps[0]?.input).toBe(7);
  });

  it("distinguishes explicit undefined from an omitted input", () => {
    const pipeline = sculpt<number | undefined>(5).derive((value) =>
      value === undefined ? "missing" : String(value),
    );

    expect(pipeline.trace(undefined).result).toBe("missing");
    expect(pipeline.trace().result).toBe("5");
  });

  it("works when run initializes the compilation cache first", () => {
    const pipeline = sculpt(5).transform("double", (value) => value * 2);

    expect(pipeline.run()).toBe(10);

    const trace = pipeline.trace(7);

    expect(trace.result).toBe(14);
    expect(trace.steps).toHaveLength(1);
    expect(trace.steps[0]).toMatchObject({
      name: "double",
      input: 7,
      output: 14,
    });
  });

  it("executes callbacks again and creates fresh records on every trace", () => {
    const callback = vi.fn((value: number) => value * 2);
    const pipeline = sculpt(5).transform(callback);
    const first = pipeline.trace();
    const second = pipeline.trace(7);

    expect(pipeline.run(9)).toBe(18);
    expect(callback.mock.calls).toEqual([[5], [7], [9]]);
    expect(first.result).toBe(10);
    expect(second.result).toBe(14);
    expect(first.steps).not.toBe(second.steps);
    expect(first.steps[0]).not.toBe(second.steps[0]);
    expect(first.steps[0]?.input).toBe(5);
    expect(first.steps[0]?.output).toBe(10);
  });

  it("measures each callback duration independently", () => {
    vi.spyOn(performance, "now")
      .mockReturnValueOnce(100)
      .mockReturnValueOnce(103)
      .mockReturnValueOnce(200)
      .mockReturnValueOnce(207);

    const trace = sculpt(5)
      .transform((value) => value * 2)
      .derive((value) => String(value))
      .trace();

    expect(trace.steps.map((step) => step.durationMs)).toEqual([3, 7]);
  });

  it("propagates the original callback error and skips remaining steps", () => {
    const error = new Error("Callback failed");
    const next = vi.fn((value: number) => value + 1);
    const pipeline = sculpt(5)
      .transform(() => {
        throw error;
      })
      .transform(next);

    expect(() => pipeline.trace()).toThrow(error);
    expect(next).not.toHaveBeenCalled();
  });

  it("validates all dependency scopes before executing any callback", () => {
    const first = vi.fn((value: number) => value * 2);
    const pipeline = sculpt(5)
      .transform(first)
      .derive((value) => value)
      .transform("increment", (value) => value + 1, { after: ["missing"] });

    expect(() => pipeline.trace()).toThrow(
      'Unknown transform dependency "missing"',
    );
    expect(first).not.toHaveBeenCalled();
  });

  it("rejects circular dependencies before executing callbacks", () => {
    const callback = vi.fn((value: number) => value);
    const pipeline = sculpt(5)
      .transform("first", callback, { after: ["second"] })
      .transform("second", callback, { after: ["first"] });

    expect(() => pipeline.trace()).toThrow("Circular transform dependencies");
    expect(callback).not.toHaveBeenCalled();
  });

  it("captures references rather than snapshots of mutable values", () => {
    const input = { value: 5 };
    const trace = sculpt(input)
      .transform((data) => data)
      .transform((data) => {
        data.value += 1;
        return data;
      })
      .trace();

    expect(trace.result).toBe(input);
    expect(trace.steps[0]?.input).toBe(input);
    expect(trace.steps[0]?.output).toBe(input);
    expect(trace.steps[0]?.output).toEqual({ value: 6 });
  });
});
