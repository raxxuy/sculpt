import { describe, expect, it, vi } from "vitest";
import { sculpt } from "../src";
import { extend, omit, pick } from "../src/derivations";

type Data = { id: number; name: string; secret: string; tags?: string[] };
const make = (): Data => ({ id: 1, name: "a", secret: "s" });

describe("pick", () => {
  it("keeps listed keys and skips missing ones", () => {
    expect(pick<Data, "id" | "tags">("id", "tags")(make())).toEqual({ id: 1 });
    expect("tags" in pick<Data, "tags">("tags")(make())).toBe(false);
  });

  // Plan 2.3: own properties only. Old code uses `in`.
  it.fails("ignores inherited keys", () => {
    const input = Object.create({ id: 9 }) as Data;

    expect("id" in pick<Data, "id">("id")(input)).toBe(false);
  });

  it("returns a new object and leaves the input untouched", () => {
    const input = make();
    const out = pick<Data, "id">("id")(input);

    expect(out).not.toBe(input);
    expect(input).toEqual(make());
  });

  it("returns {} for no keys", () => {
    expect(pick<Data, never>()(make())).toEqual({});
  });

  it("works inside a pipeline", () => {
    const out = sculpt(make())
      .derive(pick("id", "name"))
      .transform((d) => ({ ...d, id: d.id + 1 }))
      .run();

    expect(out).toEqual({ id: 2, name: "a" });
  });
});

describe("omit", () => {
  it("removes listed keys", () => {
    expect(omit<Data, "secret">("secret")(make())).toEqual({
      id: 1,
      name: "a",
    });
  });

  it("keeps symbol keys", () => {
    const sym = Symbol("s");
    const input = { ...make(), [sym]: 1 };

    expect(omit<typeof input, "id">("id")(input)[sym]).toBe(1);
  });

  it("ignores inherited keys", () => {
    const input = Object.create({ id: 9 }) as Data;
    input.name = "a";

    expect("id" in omit<Data, "secret">("secret")(input)).toBe(false);
  });

  it("shallow-copies when no keys are given", () => {
    const input = make();
    const out = omit<Data, never>()(input);

    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("works inside a pipeline", () => {
    const out = sculpt(make())
      .derive(omit("secret", "tags"))
      .transform((d) => ({ ...d, name: d.name.toUpperCase() }))
      .run();

    expect(out).toEqual({ id: 1, name: "A" });
  });
});

describe("extend object form", () => {
  it("adds keys", () => {
    const out = extend<Data, { upper: string }>({
      upper: (d) => d.name.toUpperCase(),
    })(make());

    expect(out).toEqual({ ...make(), upper: "A" });
  });

  it("overwrites existing keys", () => {
    const out = extend<Data, { id: string }>({ id: (d) => `#${d.id}` })(make());

    expect(out.id).toBe("#1");
  });

  it("gives each field the original input and runs it once", () => {
    const input = make();
    const seen: unknown[] = [];
    const fn = vi.fn((d: Data) => {
      seen.push(d);
      return 1;
    });
    extend<Data, { x: number; y: number }>({ x: fn, y: fn })(input);

    expect(fn).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([input, input]);
    expect(seen[0]).toBe(input);
  });

  it("shallow-copies with no fields", () => {
    const input = make();
    const out = extend<Data, {}>({})(input);

    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it("works inside a pipeline", () => {
    const out = sculpt(make())
      .derive(extend({ double: (d: Data) => d.id * 2 }))
      .transform((d) => ({ ...d, double: d.double + 1 }))
      .run();

    expect(out.double).toBe(3);
  });
});

// Plan 2.4: function form. Old code only takes an object, so these fail (cast to bypass types).
describe("extend function form", () => {
  const fnForm = extend as never as <R>(
    fn: (d: Data) => R,
  ) => (d: Data) => Data & R;

  it.fails("merges the result over the input and runs fn once", () => {
    const fn = vi.fn((d: Data) => ({ total: d.id * 2, label: d.name }));
    const out = fnForm(fn)(make());

    expect(out).toEqual({ ...make(), total: 2, label: "a" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.fails("overwrites keys and leaves the input untouched", () => {
    const input = make();
    const out = fnForm((d) => ({ id: d.id + 1 }))(input);

    expect(out.id).toBe(2);
    expect(input.id).toBe(1);
  });

  it.fails("works inside a pipeline", () => {
    const out = sculpt(make())
      .derive(fnForm((d) => ({ total: d.id * 3 })) as never)
      .transform((d: any) => ({ ...d, total: d.total + 1 }))
      .run() as any;

    expect(out.total).toBe(4);
  });
});
