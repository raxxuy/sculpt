import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { sculpt } from "../src";
import { at, eachWhen } from "../src/transforms";

describe("eachWhen", () => {
  it("transforms only matching elements in order", () => {
    const predicate = vi.fn((value: number) => value > 1);
    const transform = vi.fn((value: number) => value * 2);
    const input = [1, 2, 3];
    Object.freeze(input);

    const result = eachWhen(predicate, transform)(input);

    expect(result).toEqual([1, 4, 6]);
    expect(result).not.toBe(input);
    expect(input).toEqual([1, 2, 3]);
    expect(predicate.mock.calls).toEqual([[1], [2], [3]]);
    expect(transform.mock.calls).toEqual([[2], [3]]);
  });

  it("infers element types and preserves non-matching references", () => {
    const input = [{ value: 1 }, { value: 2 }];
    const result = sculpt(input)
      .transform(
        eachWhen(
          (item) => item.value > 1,
          (item) => ({ value: item.value * 2 }),
        ),
      )
      .run();

    expect(result).toEqual([{ value: 1 }, { value: 4 }]);
    expect(result[0]).toBe(input[0]);
    expect(result[1]).not.toBe(input[1]);
    expect(input).toEqual([{ value: 1 }, { value: 2 }]);
    expectTypeOf(result).toEqualTypeOf<{ value: number }[]>();
  });

  it("returns a new array when nothing matches", () => {
    const input = [1, 2];
    const transform = vi.fn((value: number) => value * 2);
    const result = eachWhen(() => false, transform)(input);

    expect(result).toEqual(input);
    expect(result).not.toBe(input);
    expect(transform).not.toHaveBeenCalled();
  });

  it("returns a new empty array without evaluating callbacks", () => {
    const predicate = vi.fn((value: number) => value > 0);
    const transform = vi.fn((value: number) => value * 2);
    const input: number[] = [];
    const result = eachWhen(predicate, transform)(input);

    expect(result).toEqual([]);
    expect(result).not.toBe(input);
    expect(predicate).not.toHaveBeenCalled();
    expect(transform).not.toHaveBeenCalled();
  });

  it("works inside at and reevaluates predicates on every run", () => {
    const pipeline = sculpt<{ values: number[] }>().transform(
      at(
        "values",
        eachWhen(
          (value) => value > 0,
          () => 0,
        ),
      ),
    );

    expect(pipeline.run({ values: [-1, 2, 3] })).toEqual({
      values: [-1, 0, 0],
    });
    expect(pipeline.run({ values: [4, -5] })).toEqual({ values: [0, -5] });
  });

  it("propagates predicate errors and skips remaining elements", () => {
    const error = new Error("Predicate failed");
    const predicate = vi.fn((value: number) => {
      if (value === 2) throw error;
      return true;
    });
    const transform = vi.fn((value: number) => value * 2);

    expect(() => eachWhen(predicate, transform)([1, 2, 3])).toThrow(error);
    expect(predicate.mock.calls).toEqual([[1], [2]]);
    expect(transform.mock.calls).toEqual([[1]]);
  });

  it("propagates transform errors and skips remaining elements", () => {
    const error = new Error("Transform failed");
    const predicate = vi.fn((value: number) => value > 0);
    const transform = vi.fn((value: number) => {
      if (value === 2) throw error;
      return value * 2;
    });

    expect(() => eachWhen(predicate, transform)([1, 2, 3])).toThrow(error);
    expect(predicate.mock.calls).toEqual([[1], [2]]);
    expect(transform.mock.calls).toEqual([[1], [2]]);
  });

  it("rejects transforms that change the element type or shape", () => {
    eachWhen<number>(
      (value) => value > 0,
      // @ts-expect-error Array transforms must preserve the element type.
      (value) => String(value),
    );
    eachWhen<{ value: number }>(
      (item) => item.value > 0,
      // @ts-expect-error Required element properties cannot be removed.
      () => ({}),
    );
    eachWhen<{ value: number }, { value: number; extra: boolean }>(
      (item) => item.value > 0,
      // @ts-expect-error Extra properties require a derivation instead.
      (item) => ({ ...item, extra: true }),
    );
  });
});
