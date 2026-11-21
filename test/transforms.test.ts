import { describe, expect, it, vi } from "vitest";
import { sculpt, type Transform } from "../src";
import { at, compose, each, eachWhen, validate, when } from "../src/transforms";

describe("at", () => {
  type Data = {
    a: number;
    user: { name: string; score: number; meta: { tags: string[] } };
    other: { x: number };
  };
  const make = (): Data => ({
    a: 1,
    user: { name: "n", score: 2, meta: { tags: ["t"] } },
    other: { x: 1 },
  });

  it("transforms a top-level key", () => {
    expect(at<Data, "a">("a", (n) => n + 1)(make()).a).toBe(2);
  });

  it("transforms a deep path, copying ancestors and sharing siblings", () => {
    const input = make();
    const snapshot = structuredClone(input);
    const out = at<Data, "user.meta.tags">("user.meta.tags", (t) => [
      ...t,
      "u",
    ])(input);

    expect(out.user.meta.tags).toEqual(["t", "u"]);
    expect(out).not.toBe(input);
    expect(out.user).not.toBe(input.user);
    expect(out.user.meta).not.toBe(input.user.meta);
    expect(out.other).toBe(input.other);
    expect(input).toEqual(snapshot);
  });

  it("applies multiple paths left to right", () => {
    const out = at<Data, "a" | "user.score">(
      ["a", "user.score"],
      (n) => n * 10,
    )(make());

    expect([out.a, out.user.score]).toEqual([10, 20]);
  });

  it("lets a repeated path see the earlier result", () => {
    const out = at<Data, "a">(["a", "a"], (n) => n + 1)(make());

    expect(out.a).toBe(3);
  });

  it("handles overlapping paths", () => {
    const out = at<Data, "user" | "user.score">(
      ["user", "user.score"],
      (v: number | Data["user"]) =>
        typeof v === "number" ? v + 1 : { ...v, name: "z" },
    )(make());

    expect(out.user.name).toBe("z");
    expect(out.user.score).toBe(3);
  });

  it("returns the same reference when the value is unchanged", () => {
    const input = { user: { score: 1 }, other: {} };
    const out = at<typeof input, "user.score">("user.score", (n) => n)(input);

    expect(out).toBe(input);
  });

  it("returns the same reference and never calls fn for no paths", () => {
    const fn = vi.fn((n: number) => n);
    const input = make();

    expect(at<Data, "a">([], fn)(input)).toBe(input);
    expect(fn).not.toHaveBeenCalled();
  });

  it("transforms an array-valued property as a whole", () => {
    const out = at<Data, "user.meta.tags">("user.meta.tags", (t) =>
      t.map((s) => s.toUpperCase()),
    )(make());

    expect(out.user.meta.tags).toEqual(["T"]);
  });

  it("is reusable across inputs", () => {
    const t = at<Data, "a">("a", (n) => n + 1);

    expect(t(make()).a).toBe(2);
    expect(t({ ...make(), a: 5 }).a).toBe(6);
  });
});

describe("compose", () => {
  it("is identity with no fns", () => {
    const data = { a: 1 };

    expect(compose()(data)).toBe(data);
  });

  it("runs left to right", () => {
    const t: Transform<number> = compose(
      (n) => n + 5,
      (n) => n * 2,
    );

    expect(t(1)).toBe(12);
  });

  it("supports nesting", () => {
    const inner: Transform<number> = compose(
      (n) => n + 1,
      (n) => n * 2,
    );
    const outer: Transform<number> = compose(inner, (n) => n - 1);

    expect(outer(1)).toBe(3);
  });

  it("stops later fns after an error", () => {
    const later = vi.fn((n: number) => n);
    const t: Transform<number> = compose(() => {
      throw new Error("x");
    }, later);

    expect(() => t(1)).toThrow("x");
    expect(later).not.toHaveBeenCalled();
  });

  it("composes at without mutating the input", () => {
    type D = { a: { b: number } };
    const input: D = { a: { b: 1 } };
    const t: Transform<D> = compose(at("a.b", (n) => n + 1));
    const out = t(input);

    expect(out.a.b).toBe(2);
    expect(input.a.b).toBe(1);
  });
});

describe("each", () => {
  it("maps in order without mutating", () => {
    const input = [1, 2, 3];
    const out = each<number>((n) => n * 2)(input);

    expect(out).toEqual([2, 4, 6]);
    expect(input).toEqual([1, 2, 3]);
  });

  it("returns the same array for empty input without calling fn", () => {
    const fn = vi.fn((n: number) => n);
    const input: number[] = [];
    const out = each(fn)(input);

    expect(out).toBe(input);
    expect(fn).not.toHaveBeenCalled();
  });

  it("returns the same array when every item is unchanged", () => {
    const input = [{ a: 1 }, { a: 2 }];

    expect(each<{ a: number }>((x) => x)(input)).toBe(input);
  });

  it("keeps sparse holes", () => {
    const sparse = [1, 2, 3];
    delete sparse[1];
    const out = each<number>((n) => n + 1)(sparse);

    expect(1 in out).toBe(false);
    expect(out[2]).toBe(4);
  });

  it("stops at the first error", () => {
    const fn = vi.fn((n: number) => {
      if (n === 2) throw new Error("two");
      return n;
    });

    expect(() => each(fn)([1, 2, 3])).toThrow("two");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe("when", () => {
  it("transforms when the predicate is true", () => {
    expect(
      when<number, number>(
        (n) => n > 0,
        (n) => n * 2,
      )(2),
    ).toBe(4);
  });

  it("returns the same reference when false", () => {
    const input = { a: 1 };
    const fn = vi.fn((o: typeof input) => ({ ...o }));

    expect(when(() => false, fn)(input)).toBe(input);
    expect(fn).not.toHaveBeenCalled();
  });

  it("keeps a falsy result from fn", () => {
    expect(
      when<number, number>(
        () => true,
        () => 0,
      )(5),
    ).toBe(0);
  });

  it("does not call fn when the predicate throws", () => {
    const fn = vi.fn((n: number) => n);
    const t = when<number, number>(() => {
      throw new Error("p");
    }, fn);

    expect(() => t(1)).toThrow("p");
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("eachWhen", () => {
  it("transforms only matching elements and keeps other references", () => {
    const a = { v: 1 };
    const b = { v: 2 };
    const out = eachWhen<{ v: number }>(
      (o) => o.v > 1,
      (o) => ({ v: o.v * 10 }),
    )([a, b]);

    expect(out[0]).toBe(a);
    expect(out[1]).toEqual({ v: 20 });
  });

  it("returns the same array for empty input and calls nothing", () => {
    const predicate = vi.fn(() => true);
    const fn = vi.fn((n: number) => n);
    const input: number[] = [];
    const out = eachWhen(predicate, fn)(input);

    expect(out).toBe(input);
    expect(predicate).not.toHaveBeenCalled();
    expect(fn).not.toHaveBeenCalled();
  });
});

describe("validate", () => {
  it("returns the same reference when valid", () => {
    const input = { a: 1 };

    expect(validate<typeof input>(() => true, "bad")(input)).toBe(input);
  });

  it("throws the message and stops later pipeline steps", () => {
    const later = vi.fn((n: number) => n);
    const pipeline = sculpt(-1)
      .transform(validate<number>((n) => n > 0, "must be positive"))
      .transform(later);

    expect(() => pipeline.run()).toThrow("must be positive");
    expect(later).not.toHaveBeenCalled();
  });

  it("propagates a predicate error unchanged", () => {
    const boom = new Error("boom");
    const t = validate<number>(() => {
      throw boom;
    }, "msg");

    expect(() => t(1)).toThrow(boom);
  });

  it("is reusable after a failure", () => {
    const t = validate<number>((n) => n > 0, "bad");

    expect(() => t(-1)).toThrow("bad");
    expect(t(1)).toBe(1);
  });
});
