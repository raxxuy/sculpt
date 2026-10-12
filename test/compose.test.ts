import { describe, expect, it } from "vitest";
import { sculpt } from "../src";
import { at, compose } from "../src/transforms";

describe("compose", () => {
  it("returns input unchanged when no transforms are provided", () => {
    const data = { value: 10 };

    expect(compose<typeof data>()(data)).toBe(data);
  });

  it("applies a single transform", () => {
    const transform = compose<number>((value) => value * 2);

    expect(transform(10)).toBe(20);
  });

  it("applies transforms from left to right", () => {
    const transform = compose<number>(
      (value) => value + 5,
      (value) => value * 2,
      (value) => value - 3,
    );

    expect(transform(10)).toBe(27);
  });

  it("passes each result to the next transform", () => {
    type Data = { value: number };
    const initial: Data = { value: 10 };
    const intermediate: Data = { value: 20 };

    const transform = compose<Data>(
      (data) => {
        expect(data).toBe(initial);
        return intermediate;
      },
      (data) => {
        expect(data).toBe(intermediate);
        return { value: data.value + 5 };
      },
    );

    expect(transform(initial)).toEqual({ value: 25 });
  });

  it("can be reused with different inputs", () => {
    const transform = compose<number>(
      (value) => value * 2,
      (value) => value + 1,
    );

    expect(transform(10)).toBe(21);
    expect(transform(20)).toBe(41);
    expect(transform(10)).toBe(21);
  });

  it("supports nested compositions", () => {
    const transform = compose<number>(
      compose<number>(
        (value) => value + 5,
        (value) => value * 2,
      ),
      (value) => value - 3,
    );

    expect(transform(10)).toBe(27);
  });

  it("propagates errors and skips remaining transforms", () => {
    const error = new Error("Transform failed");
    let reachedLast = false;

    const transform = compose<number>(
      (value) => value + 1,
      () => {
        throw error;
      },
      (value) => {
        reachedLast = true;
        return value * 2;
      },
    );

    let caught: unknown;

    try {
      transform(10);
    } catch (cause) {
      caught = cause;
    }

    expect(caught).toBe(error);
    expect(reachedLast).toBe(false);
  });

  it("composes at transforms without mutating input", () => {
    type Data = {
      value: number;
      user: { name: string };
      untouched: { active: boolean };
    };

    const data: Data = {
      value: 50,
      user: { name: " Test " },
      untouched: { active: true },
    };

    const transform = compose<Data>(
      at("value", (value) => value / 100),
      at("user.name", (name) => name.trim()),
    );

    const result = transform(data);

    expect(result).toEqual({
      value: 0.5,
      user: { name: "Test" },
      untouched: { active: true },
    });
    expect(data.value).toBe(50);
    expect(data.user.name).toBe(" Test ");
    expect(result).not.toBe(data);
    expect(result.user).not.toBe(data.user);
    expect(result.untouched).toBe(data.untouched);
  });

  it("supports sequential updates to the same path", () => {
    type Data = { value: number };

    const transform = compose<Data>(
      at("value", (value) => value * 2),
      at("value", (value) => value + 5),
    );

    expect(transform({ value: 10 })).toEqual({ value: 25 });
  });

  it("works as a named pipeline transform with dependencies", () => {
    const result = sculpt(10)
      .transform(
        "combined",
        compose(
          (value) => value * 2,
          (value) => value + 1,
        ),
        { after: ["increment"] },
      )
      .transform("increment", (value) => value + 5)
      .run();

    expect(result).toBe(31);
  });
});
