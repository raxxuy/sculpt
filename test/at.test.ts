import { describe, expect, it } from "vitest";
import { sculpt } from "../src";
import { at } from "../src/transforms";

describe("at", () => {
  it("transforms a top-level property", () => {
    const data = { value: 10, label: "unchanged" };
    const result = at<typeof data, "value">(
      "value",
      (value) => value * 2,
    )(data);

    expect(result).toEqual({ value: 20, label: "unchanged" });
  });

  it("transforms a deeply nested property", () => {
    const data = { user: { profile: { name: "Ada", age: 30 } }, active: true };
    const result = at<typeof data, "user.profile.name">(
      "user.profile.name",
      (name) => name.toUpperCase(),
    )(data);

    expect(result).toEqual({
      user: { profile: { name: "ADA", age: 30 } },
      active: true,
    });
  });

  it("copies the updated ancestors without mutating the input", () => {
    const sibling = { value: 5 };
    const profile = Object.freeze<{ score: number }>({ score: 10 });
    const user = Object.freeze({ profile, sibling });
    const data = Object.freeze({ user, sibling });
    const result = at<typeof data, "user.profile.score">(
      "user.profile.score",
      (score) => score + 1,
    )(data);

    expect(data.user.profile.score).toBe(10);
    expect(result.user.profile.score).toBe(11);
    expect(result).not.toBe(data);
    expect(result.user).not.toBe(user);
    expect(result.user.profile).not.toBe(profile);
    expect(result.user.sibling).toBe(sibling);
    expect(result.sibling).toBe(sibling);
  });

  it("transforms multiple paths", () => {
    const data = { first: 1, nested: { second: 2, untouched: 3 } };
    const result = at<typeof data, "first" | "nested.second">(
      ["first", "nested.second"] as const,
      (value) => value * 10,
    )(data);

    expect(result).toEqual({ first: 10, nested: { second: 20, untouched: 3 } });
  });

  it("applies repeated paths sequentially using the updated value", () => {
    const data = { value: 1 };
    const received: number[] = [];
    const result = at<typeof data, "value">(["value", "value"], (value) => {
      received.push(value);
      return value + 1;
    })(data);

    expect(received).toEqual([1, 2]);
    expect(result).toEqual({ value: 3 });
  });

  it("returns the original input without calling the transform for no paths", () => {
    const data = { value: 1 };
    let calls = 0;
    const result = at<typeof data, "value">([], (value) => {
      calls += 1;
      return value + 1;
    })(data);

    expect(result).toBe(data);
    expect(calls).toBe(0);
  });

  it("transforms an array-valued property as a whole", () => {
    const data = { values: [1, 2, 3] };
    const result = at<typeof data, "values">("values", (values) =>
      values.map((value) => value * 2),
    )(data);

    expect(result).toEqual({ values: [2, 4, 6] });
    expect(data.values).toEqual([1, 2, 3]);
    expect(result.values).not.toBe(data.values);
  });

  it("can reuse a transform across inputs", () => {
    const increment = at<{ value: number }, "value">(
      "value",
      (value) => value + 1,
    );

    expect(increment({ value: 1 })).toEqual({ value: 2 });
    expect(increment({ value: 10 })).toEqual({ value: 11 });
  });

  it("works in a sculpt transformation pipeline", () => {
    const data = { user: { score: 10 }, label: "unchanged" };
    const result = sculpt(data)
      .transform(at("user.score", (score) => score * 2))
      .derive((value) => value.user.score)
      .run();

    expect(result).toBe(20);
    expect(data.user.score).toBe(10);
  });
});
