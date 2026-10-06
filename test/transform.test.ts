import { describe, expect, it } from "vitest";
import { sculpt } from "../src";

describe("sculpt", () => {
  it("applies transformations", () => {
    const result = sculpt({ value: 10 })
      .transform((data) => ({
        ...data,
        value: data.value * 2,
      }))
      .transform((data) => ({
        ...data,
        value: data.value + 5,
      }))
      .run();

    expect(result).toEqual({ value: 25 });
  });

  it("supports named transformations", () => {
    const result = sculpt({ value: 10 })
      .transform("double", (data) => ({
        ...data,
        value: data.value * 2,
      }))
      .transform("increment", (data) => ({
        ...data,
        value: data.value + 5,
      }))
      .run();

    expect(result).toEqual({ value: 25 });
  });

  it("applies transformations according to dependencies", () => {
    const result = sculpt({ value: 10 })
      .transform(
        "double",
        (data) => ({
          ...data,
          value: data.value * 2,
        }),
        { after: ["increment"] },
      )
      .transform("increment", (data) => ({
        ...data,
        value: data.value + 5,
      }))
      .run();

    expect(result).toEqual({ value: 30 });
  });

  it("throws when dependency does not exist", () => {
    expect(() =>
      sculpt({ value: 10 })
        .transform(
          "double",
          (data) => ({
            ...data,
            value: data.value * 2,
          }),
          {
            after: ["missing"],
          },
        )
        .run(),
    ).toThrow();
  });

  it("throws on circular dependencies", () => {
    expect(() =>
      sculpt({ value: 10 })
        .transform("first", (data) => data, {
          after: ["second"],
        })
        .transform("second", (data) => data, {
          after: ["first"],
        })
        .run(),
    ).toThrow();
  });

  it("preserves registration order for independent transforms", () => {
    const order: string[] = [];

    sculpt({})
      .transform(() => {
        order.push("first");
        return {};
      })
      .transform(() => {
        order.push("second");
        return {};
      })
      .run();

    expect(order).toEqual(["first", "second"]);
  });
});
