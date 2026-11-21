import { describe, expect, it, vi } from "vitest";
import { sculpt } from "../src";

const id = (n: number) => n;

describe("trace", () => {
  it("returns the result plus one record per step", () => {
    const { result, steps } = sculpt(1)
      .transform("inc", (n) => n + 1)
      .transform((n) => n * 2)
      .trace();

    expect(result).toBe(4);
    expect(steps).toHaveLength(2);
    expect(steps[0]).toMatchObject({
      index: 0,
      kind: "transform",
      name: "inc",
      input: 1,
      output: 2,
    });
    expect(steps[1]).toMatchObject({ index: 1, input: 2, output: 4 });
  });

  // Plan 4.5: name key is absent for anonymous steps. Old code sets name: undefined.
  it.fails("omits the name key for anonymous steps", () => {
    const { steps } = sculpt(1).transform(id).trace();

    expect("name" in (steps[0] as object)).toBe(false);
  });

  it("records execution order after dependency resolution, across use", () => {
    const other = sculpt<number>().transform("b", id);
    const { steps } = sculpt(0)
      .transform("a", id, { after: ["b"] })
      .use(other)
      .trace();

    expect(steps.map((s) => [s.index, s.name])).toEqual([
      [0, "b"],
      [1, "a"],
    ]);
  });

  it("records derive steps as kind derive without a name", () => {
    const { steps } = sculpt(1)
      .derive((n) => ({ n }))
      .trace();

    expect(steps[0]?.kind).toBe("derive");
    expect(steps[0]?.name).toBeUndefined();
  });

  it("returns the input and no steps for an empty pipeline", () => {
    expect(sculpt(7).trace()).toEqual({ result: 7, steps: [] });
  });

  it("returns fresh records and runs callbacks on every call", () => {
    const fn = vi.fn(id);
    const pipeline = sculpt(1).transform(fn);
    const a = pipeline.trace();
    const b = pipeline.trace();

    expect(a).not.toBe(b);
    expect(a.steps).not.toBe(b.steps);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("holds references, not snapshots", () => {
    const input = { a: 1 };
    const { steps } = sculpt(input)
      .transform((o) => o)
      .trace();

    expect(steps[0]?.input).toBe(input);
    expect(steps[0]?.output).toBe(input);
  });

  it("measures duration per step", () => {
    const { steps } = sculpt(0)
      .transform((n) => n)
      .transform((n) => {
        const end = performance.now() + 5;
        while (performance.now() < end);
        return n;
      })
      .trace();

    expect(
      (steps[1]?.durationMs as number) > (steps[0]?.durationMs as number),
    ).toBe(true);
    expect(steps[1]?.durationMs).toBeGreaterThanOrEqual(4);
  });

  it("propagates the original error and skips later steps", () => {
    const boom = new Error("boom");
    const later = vi.fn(id);
    const pipeline = sculpt(1)
      .transform(() => {
        throw boom;
      })
      .transform(later);

    expect(() => pipeline.trace()).toThrow(boom);
    expect(later).not.toHaveBeenCalled();
  });

  it("throws validation errors before any callback runs", () => {
    const fn = vi.fn(id);
    const pipeline = sculpt(1)
      .transform(fn)
      .transform("a", fn, { after: ["nope"] });

    expect(() => pipeline.trace()).toThrow("Unknown transform dependency");
    expect(fn).not.toHaveBeenCalled();
  });

  it("works whether run or trace compiled first", () => {
    const make = () =>
      sculpt(1)
        .transform("a", (n) => n + 1, { after: ["b"] })
        .transform("b", (n) => n * 10);

    const first = make();
    first.run();
    const second = make();
    second.trace();

    expect(first.trace().result).toBe(11);
    expect(second.run()).toBe(11);
  });
});

describe("inspect", () => {
  it("reports declared vs execution indexes after reordering", () => {
    const { steps } = sculpt(0)
      .transform("a", id, { after: ["b"] })
      .transform("b", id)
      .inspect();

    expect(steps).toEqual([
      {
        declaredIndex: 1,
        executionIndex: 0,
        scope: 0,
        kind: "transform",
        name: "b",
        after: [],
      },
      {
        declaredIndex: 0,
        executionIndex: 1,
        scope: 0,
        kind: "transform",
        name: "a",
        after: ["b"],
      },
    ]);
  });

  it("assigns a derive to the scope it closes", () => {
    const { steps } = sculpt(0)
      .transform(id)
      .derive((n) => n)
      .transform(id)
      .inspect();

    expect(steps.map((s) => [s.kind, s.scope])).toEqual([
      ["transform", 0],
      ["derive", 0],
      ["transform", 1],
    ]);
  });

  it("gives a twice-used pipeline distinct indexes", () => {
    const other = sculpt<number>().transform(id);
    const { steps } = sculpt(0).use(other).use(other).inspect();

    expect(steps.map((s) => s.declaredIndex)).toEqual([0, 1]);
  });

  it("never runs callbacks and works without default data", () => {
    const fn = vi.fn(id);

    expect(sculpt<number>().transform(fn).inspect().steps).toHaveLength(1);
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns fresh arrays each call", () => {
    const pipeline = sculpt(0).transform("a", id, { after: [] });
    const first = pipeline.inspect();
    first.steps.length = 0;
    const second = pipeline.inspect();

    expect(second.steps).toHaveLength(1);
    expect(second.steps[0]).not.toBe(first.steps[0]);
  });

  it("throws the same validation errors as run", () => {
    const pipeline = sculpt(0)
      .transform("a", id, { after: ["b"] })
      .transform("b", id, { after: ["a"] });

    expect(() => pipeline.inspect()).toThrow(
      'Circular transform dependencies: "a" -> "b" -> "a"',
    );
  });
});
