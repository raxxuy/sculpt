import { describe, expect, it, vi } from "vitest";
import { sculpt } from "../src";
import { when } from "../src/transforms";

describe("when", () => {
  it("applies the transform when the predicate returns true", () => {
    const result = sculpt({ score: 10 })
      .transform(
        when(
          (data) => data.score < 20,
          (data) => ({ ...data, score: data.score * 2 }),
        ),
      )
      .run();

    expect(result).toEqual({ score: 20 });
  });

  it("returns the original reference without transforming when false", () => {
    const input = { score: 20 };
    const transform = vi.fn((data: typeof input) => ({
      ...data,
      score: data.score * 2,
    }));

    const result = when(
      (data) => data.score < 20,
      transform,
    )(input);

    expect(result).toBe(input);
    expect(transform).not.toHaveBeenCalled();
  });

  it("evaluates the current value after preceding pipeline steps", () => {
    const result = sculpt(10)
      .transform((value) => value + 15)
      .transform(
        when(
          (value) => value >= 20,
          (value) => value * 2,
        ),
      )
      .run();

    expect(result).toBe(50);
  });

  it("reevaluates the predicate on every run", () => {
    const transform = vi.fn((value: number) => value * 2);
    const pipeline = sculpt<number>().transform(
      when((value) => value < 10, transform),
    );

    expect(pipeline.run(5)).toBe(10);
    expect(pipeline.run(20)).toBe(20);
    expect(pipeline.run(3)).toBe(6);
    expect(transform.mock.calls).toEqual([[5], [3]]);
  });

  it("preserves a falsy result returned by the transform", () => {
    const result = when(
      (value: number) => value > 0,
      () => 0,
    )(5);

    expect(result).toBe(0);
  });

  it("propagates predicate errors without calling the transform", () => {
    const transform = vi.fn((value: number) => value * 2);
    const update = when((_value: number): boolean => {
      throw new Error("Predicate failed");
    }, transform);

    expect(() => update(5)).toThrow("Predicate failed");
    expect(transform).not.toHaveBeenCalled();
  });

  it("propagates transform errors", () => {
    const update = when(
      (value: number) => value > 0,
      (_value): number => {
        throw new Error("Transform failed");
      },
    );

    expect(() => update(5)).toThrow("Transform failed");
  });
});
