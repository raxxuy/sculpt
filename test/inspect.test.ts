import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import { type InspectionStep, type PipelineInspection, sculpt } from "../src";
import * as compiler from "../src/core/compile";

vi.mock("../src/core/compile", async (importOriginal) => {
  const original = await importOriginal<typeof import("../src/core/compile")>();
  return { ...original, compile: vi.fn(original.compile) };
});

describe("inspect", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the public inspection types without requiring an input", () => {
    const pipeline = sculpt<number>().derive((value) => ({ value }));
    const inspection = pipeline.inspect();

    expectTypeOf(inspection).toEqualTypeOf<PipelineInspection>();
    expectTypeOf(inspection.steps).toEqualTypeOf<InspectionStep[]>();
    expectTypeOf(pipeline.inspect).parameters.toEqualTypeOf<[]>();
    expect(inspection).toStrictEqual({
      steps: [
        { kind: "derive", declaredIndex: 0, executionIndex: 0, scope: 0 },
      ],
    });
  });

  it("reports resolved dependencies with distinct declaration and execution indexes", () => {
    const inspection = sculpt(5)
      .transform("increment", (value) => value + 1, {
        after: ["double", "offset"],
      })
      .transform("double", (value) => value * 2, { after: ["offset"] })
      .transform("offset", (value) => value + 2)
      .inspect();

    expect(inspection).toStrictEqual({
      steps: [
        {
          kind: "transform",
          name: "offset",
          after: [],
          declaredIndex: 2,
          executionIndex: 0,
          scope: 0,
        },
        {
          kind: "transform",
          name: "double",
          after: ["offset"],
          declaredIndex: 1,
          executionIndex: 1,
          scope: 0,
        },
        {
          kind: "transform",
          name: "increment",
          after: ["double", "offset"],
          declaredIndex: 0,
          executionIndex: 2,
          scope: 0,
        },
      ],
    });
  });

  it("preserves unconstrained order and assigns derivations to the preceding scope", () => {
    const inspection = sculpt<number>()
      .derive((value) => ({ value }))
      .transform((data) => ({ value: data.value * 2 }))
      .transform("increment", (data) => ({ value: data.value + 1 }))
      .derive((data) => String(data.value))
      .derive((value) => value.length)
      .transform((value) => value + 1)
      .inspect();

    expect(inspection).toEqual({
      steps: [
        { kind: "derive", declaredIndex: 0, executionIndex: 0, scope: 0 },
        {
          kind: "transform",
          after: [],
          declaredIndex: 1,
          executionIndex: 1,
          scope: 1,
        },
        {
          kind: "transform",
          name: "increment",
          after: [],
          declaredIndex: 2,
          executionIndex: 2,
          scope: 1,
        },
        { kind: "derive", declaredIndex: 3, executionIndex: 3, scope: 1 },
        { kind: "derive", declaredIndex: 4, executionIndex: 4, scope: 2 },
        {
          kind: "transform",
          after: [],
          declaredIndex: 5,
          executionIndex: 5,
          scope: 3,
        },
      ],
    });
    for (const step of inspection.steps) {
      if (step.kind === "derive") {
        expect(Object.keys(step).sort()).toEqual([
          "declaredIndex",
          "executionIndex",
          "kind",
          "scope",
        ]);
      } else {
        const { name, ...metadata } = step;
        expect(name).toBe(step.declaredIndex === 2 ? "increment" : undefined);
        expect(Object.keys(metadata).sort()).toEqual([
          "after",
          "declaredIndex",
          "executionIndex",
          "kind",
          "scope",
        ]);
      }
    }
  });

  it("resolves dependencies and global indexes across use boundaries", () => {
    const increment = sculpt<number>().transform(
      "increment",
      (value) => value + 1,
      { after: ["double"] },
    );
    const double = sculpt<number>().transform("double", (value) => value * 2);
    const inspection = sculpt(5).use(increment).use(double).inspect();

    expect(inspection).toStrictEqual({
      steps: [
        {
          kind: "transform",
          name: "double",
          after: [],
          declaredIndex: 1,
          executionIndex: 0,
          scope: 0,
        },
        {
          kind: "transform",
          name: "increment",
          after: ["double"],
          declaredIndex: 0,
          executionIndex: 1,
          scope: 0,
        },
      ],
    });
  });

  it("gives reused pipeline operations distinct global indexes and scopes", () => {
    const reusable = sculpt<number>()
      .transform("increment", (value) => value + 1, { after: ["double"] })
      .transform("double", (value) => value * 2)
      .derive((value) => value);
    const original = reusable.inspect();
    const inspection = sculpt(5)
      .transform((value) => value - 1)
      .use(reusable)
      .use(reusable)
      .transform((value) => value + 10)
      .inspect();

    expect(
      inspection.steps.map(
        ({ kind, declaredIndex, executionIndex, scope }) => ({
          kind,
          declaredIndex,
          executionIndex,
          scope,
        }),
      ),
    ).toStrictEqual([
      { kind: "transform", declaredIndex: 0, executionIndex: 0, scope: 0 },
      { kind: "transform", declaredIndex: 2, executionIndex: 1, scope: 0 },
      { kind: "transform", declaredIndex: 1, executionIndex: 2, scope: 0 },
      { kind: "derive", declaredIndex: 3, executionIndex: 3, scope: 0 },
      { kind: "transform", declaredIndex: 5, executionIndex: 4, scope: 1 },
      { kind: "transform", declaredIndex: 4, executionIndex: 5, scope: 1 },
      { kind: "derive", declaredIndex: 6, executionIndex: 6, scope: 1 },
      { kind: "transform", declaredIndex: 7, executionIndex: 7, scope: 2 },
    ]);
    expect(reusable.inspect()).toStrictEqual(original);
  });

  it("returns fresh mutable empty inspections with or without a default", () => {
    const pipeline = sculpt<number>();
    const first = pipeline.inspect();
    const second = pipeline.inspect();

    expect(first).toStrictEqual({ steps: [] });
    expect(second).toStrictEqual({ steps: [] });
    expect(sculpt(5).inspect()).toStrictEqual({ steps: [] });
    expect(first).not.toBe(second);
    expect(first.steps).not.toBe(second.steps);

    first.steps.push({
      kind: "derive",
      declaredIndex: 0,
      executionIndex: 0,
      scope: 0,
    });
    expect(second).toStrictEqual({ steps: [] });
    expect(pipeline.inspect()).toStrictEqual({ steps: [] });
    expect(pipeline.run(5)).toBe(5);
    expect(pipeline.trace(7)).toStrictEqual({ result: 7, steps: [] });
  });

  it("never executes transform or derive callbacks, even without a default", () => {
    const transform = vi.fn((value: number): number => {
      throw new Error(`Transform executed with ${value}`);
    });
    const derive = vi.fn((value: number) => {
      throw new Error(`Derive executed with ${value}`);
    });
    const pipeline = sculpt<number>().transform(transform).derive(derive);

    expect(pipeline.inspect().steps).toHaveLength(2);
    expect(pipeline.inspect().steps).toHaveLength(2);
    expect(transform).not.toHaveBeenCalled();
    expect(derive).not.toHaveBeenCalled();
  });

  it.each(["inspect", "run", "trace", "runAsync", "traceAsync"] as const)(
    "shares the compilation cache when %s is called first",
    async (firstMethod) => {
      const compile = vi.mocked(compiler.compile);
      const callback = vi.fn((value: number) => value);
      const pipeline = sculpt(5)
        .transform("increment", (value) => callback(value + 1), {
          after: ["double"],
        })
        .transform("double", (value) => callback(value * 2))
        .derive((value) => String(callback(value)));

      await pipeline[firstMethod]();
      expect(callback).toHaveBeenCalledTimes(firstMethod === "inspect" ? 0 : 3);

      const before = pipeline.inspect();
      const calls = callback.mock.calls.length;
      expect(pipeline.run()).toBe("11");
      expect(pipeline.inspect()).toStrictEqual(before);
      const trace = pipeline.trace(7);
      expect(trace.result).toBe("15");
      expect(trace.steps.map(({ kind, name }) => ({ kind, name }))).toEqual([
        { kind: "transform", name: "double" },
        { kind: "transform", name: "increment" },
        { kind: "derive", name: undefined },
      ]);
      expect(pipeline.inspect()).toStrictEqual(before);
      expect(callback).toHaveBeenCalledTimes(calls + 6);
      await expect(pipeline.runAsync()).resolves.toBe("11");
      await expect(pipeline.traceAsync(7)).resolves.toMatchObject({
        result: "15",
      });
      expect(compile).toHaveBeenCalledTimes(1);
    },
  );

  it.each([false, true])(
    "isolates mutable inspections from internals (constrained: %s)",
    (constrained) => {
      const pipeline = sculpt(5)
        .transform("increment", (value) => value + 1, {
          after: constrained ? ["double"] : [],
        })
        .transform("double", (value) => value * 2)
        .derive((value) => String(value));
      const first = pipeline.inspect();
      const original = pipeline.inspect();

      expect(first).not.toBe(original);
      expect(first.steps).not.toBe(original.steps);
      for (const [index, step] of first.steps.entries()) {
        const other = original.steps[index];
        expect(step).not.toBe(other);
        if (step.kind === "transform" && other?.kind === "transform") {
          expect(step.after).not.toBe(other.after);
          for (const sibling of first.steps) {
            if (sibling !== step && sibling.kind === "transform") {
              expect(step.after).not.toBe(sibling.after);
            }
          }
          step.after.splice(0, step.after.length, "missing");
          step.name = "changed";
        }
        step.declaredIndex = 100;
        step.executionIndex = 200;
        step.scope = 300;
      }
      first.steps.reverse();
      first.steps.pop();
      first.steps = [];

      expect(pipeline.inspect()).toStrictEqual(original);
      expect(pipeline.run()).toBe(constrained ? "11" : "12");
      const trace = pipeline.trace(7);
      expect(trace.result).toBe(constrained ? "15" : "16");
      expect(trace.steps.map(({ kind, name }) => ({ kind, name }))).toEqual([
        { kind: "transform", name: constrained ? "double" : "increment" },
        { kind: "transform", name: constrained ? "increment" : "double" },
        { kind: "derive", name: undefined },
      ]);
      expect(pipeline.inspect()).toStrictEqual(original);
      expect(
        sculpt(5)
          .transform((value) => value + 1)
          .inspect().steps[0],
      ).toEqual({
        kind: "transform",
        after: [],
        declaredIndex: 0,
        executionIndex: 0,
        scope: 0,
      });
    },
  );

  it("rejects unknown dependencies in later scopes before executing any callback", () => {
    const callback = vi.fn((value: number) => value);
    const pipeline = sculpt(5)
      .transform(callback)
      .derive(callback)
      .transform("increment", callback, { after: ["missing"] });

    expect(() => pipeline.inspect()).toThrow(
      'Unknown transform dependency "missing"',
    );
    expect(callback).not.toHaveBeenCalled();
  });

  it("rejects cycles before executing any callback", () => {
    const callback = vi.fn((value: number) => value);
    const pipeline = sculpt(5)
      .transform(callback)
      .derive(callback)
      .transform("first", callback, { after: ["second"] })
      .transform("second", callback, { after: ["first"] });

    expect(() => pipeline.inspect()).toThrow("Circular transform dependencies");
    expect(callback).not.toHaveBeenCalled();
  });

  it.each(["earlier", "later"] as const)(
    "rejects dependencies on transforms in an %s derivation scope",
    (direction) => {
      const callback = vi.fn((value: number) => value);
      const pipeline =
        direction === "earlier"
          ? sculpt(5)
              .transform("double", callback)
              .derive(callback)
              .transform("increment", callback, { after: ["double"] })
          : sculpt(5)
              .transform("increment", callback, { after: ["double"] })
              .derive(callback)
              .transform("double", callback);

      expect(() => pipeline.inspect()).toThrow(
        'Unknown transform dependency "double"',
      );
      expect(callback).not.toHaveBeenCalled();
    },
  );
});
