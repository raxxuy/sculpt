import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { sculpt } from "../src";
import { at, compose, each } from "../src/transforms";

describe("each", () => {
  it("transforms every element in order without mutating the array", () => {
    const input = [1, 2, 3];
    Object.freeze(input);
    const transform = vi.fn((value: number) => value * 2);

    const result = each(transform)(input);

    expect(result).toEqual([2, 4, 6]);
    expect(result).not.toBe(input);
    expect(input).toEqual([1, 2, 3]);
    expect(transform.mock.calls).toEqual([[1], [2], [3]]);
  });

  it("returns a new empty array without calling the transform", () => {
    const input: number[] = [];
    const transform = vi.fn((value: number) => value * 2);
    const result = each(transform)(input);

    expect(result).toEqual([]);
    expect(result).not.toBe(input);
    expect(transform).not.toHaveBeenCalled();
  });

  it("preserves references returned by the transform", () => {
    const input = [{ value: 1 }, { value: 2 }];
    const result = each((item: { value: number }) => item)(input);

    expect(result).not.toBe(input);
    expect(result[0]).toBe(input[0]);
    expect(result[1]).toBe(input[1]);
  });

  it("infers element types within a pipeline", () => {
    const result = sculpt([{ value: 1 }, { value: 2 }])
      .transform(each((item) => ({ value: item.value * 2 })))
      .run();

    expect(result).toEqual([{ value: 2 }, { value: 4 }]);
    expectTypeOf(result).toEqualTypeOf<{ value: number }[]>();
  });

  it("composes element transforms inside a nested array", () => {
    const input = {
      items: [{ value: 1 }, { value: 2 }],
      untouched: { active: true },
    };
    const result = sculpt(input)
      .transform(
        at(
          "items",
          each(
            compose(
              (item) => ({ value: item.value + 1 }),
              (item) => ({ value: item.value * 2 }),
            ),
          ),
        ),
      )
      .run();

    expect(result.items).toEqual([{ value: 4 }, { value: 6 }]);
    expect(input.items).toEqual([{ value: 1 }, { value: 2 }]);
    expect(result.untouched).toBe(input.untouched);
  });

  it("can be reused across runs with different inputs", () => {
    const pipeline = sculpt<number[]>().transform(each((value) => value + 1));

    expect(pipeline.run([1, 2])).toEqual([2, 3]);
    expect(pipeline.run([5])).toEqual([6]);
  });

  it("preserves sparse array holes", () => {
    const input = new Array<number>(3);
    input[1] = 2;
    const transform = vi.fn((value: number) => value * 2);
    const result = each(transform)(input);

    expect(result).toEqual(input.map((value) => value * 2));
    expect(0 in result).toBe(false);
    expect(2 in result).toBe(false);
    expect(transform.mock.calls).toEqual([[2]]);
  });

  it("propagates errors and stops transforming remaining elements", () => {
    const error = new Error("Transform failed");
    const transform = vi.fn((value: number) => {
      if (value === 2) throw error;
      return value * 2;
    });

    expect(() => each(transform)([1, 2, 3])).toThrow(error);
    expect(transform.mock.calls).toEqual([[1], [2]]);
  });

  it("rejects transforms that change the element type or shape", () => {
    // @ts-expect-error Array transforms must preserve the element type.
    each<number>((value) => String(value));
    // @ts-expect-error Required element properties cannot be removed.
    each<{ value: number }>(() => ({}));
    each<{ value: number }, { value: number; extra: boolean }>(
      // @ts-expect-error Extra properties require a derivation instead.
      (item) => ({ ...item, extra: true }),
    );
  });
});
