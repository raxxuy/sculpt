import { describe, expect, it, vi } from "vitest";
import { type StandardSchemaV1, sculpt, ValidationError } from "../src";
import {
  defaults,
  extend,
  omit,
  parse,
  pick,
  rename,
} from "../src/derivations";

type Data = { id: number; name: string; secret: string; tags?: string[] };
const make = (): Data => ({ id: 1, name: "a", secret: "s" });

describe("pick", () => {
  it("keeps listed keys and skips missing ones", () => {
    expect(pick<Data, "id" | "tags">("id", "tags")(make())).toEqual({ id: 1 });
    expect("tags" in pick<Data, "tags">("tags")(make())).toBe(false);
  });

  it("ignores inherited keys", () => {
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
    const out = extend<Data, Record<never, never>>({})(input);

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

describe("extend function form", () => {
  it("merges the result over the input and runs fn once", () => {
    const fn = vi.fn((d: Data) => ({ total: d.id * 2, label: d.name }));
    const out = extend(fn)(make());

    expect(out).toEqual({ ...make(), total: 2, label: "a" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("overwrites keys and leaves the input untouched", () => {
    const input = make();
    const out = extend((d: Data) => ({ id: d.id + 1 }))(input);

    expect(out.id).toBe(2);
    expect(input.id).toBe(1);
  });

  it("works inside a pipeline", () => {
    const out = sculpt(make())
      .derive(extend((d) => ({ total: d.id * 3 })))
      .transform((d) => ({ ...d, total: d.total + 1 }))
      .run();

    expect(out.total).toBe(4);
  });
});

describe("rename", () => {
  it("renames keys, keeps the rest and leaves the input untouched", () => {
    const input = make();
    const out = rename<Data, { name: "label" }>({ name: "label" })(input);

    expect(out).toEqual({ id: 1, label: "a", secret: "s" });
    expect(input).toEqual(make());
  });

  it("skips missing and inherited keys", () => {
    const input = Object.create({ name: "x" }) as Data;
    input.id = 1;
    const out = rename<Data, { name: "n"; tags: "t" }>({
      name: "n",
      tags: "t",
    })(input);

    expect(out).toEqual({ id: 1 });
  });

  it("overwrites an existing key with the renamed value", () => {
    const out = rename<Data, { name: "secret" }>({ name: "secret" })(make());

    expect(out).toEqual({ id: 1, secret: "a" });
  });

  it("swaps keys", () => {
    const out = rename<Data, { id: "name"; name: "id" }>({
      id: "name",
      name: "id",
    })(make());

    expect(out).toEqual({ id: "a", name: 1, secret: "s" });
  });

  it("works inside a pipeline", () => {
    const out = sculpt(make())
      .derive(rename({ id: "key" }))
      .transform((d) => ({ ...d, key: d.key + 1 }))
      .run();

    expect(out.key).toBe(2);
  });
});

describe("defaults", () => {
  it("fills missing and undefined keys, keeps defined ones", () => {
    const fill = defaults<Data, { tags: string[]; name: string }>({
      tags: ["x"],
      name: "z",
    });

    expect(fill(make())).toEqual({ ...make(), tags: ["x"] });
    expect(fill({ ...make(), name: undefined as never }).name).toBe("z");
  });

  it("returns a new object and leaves the input untouched", () => {
    const input = make();
    const out = defaults<Data, { tags: string[] }>({ tags: [] })(input);

    expect(out).not.toBe(input);
    expect(input).toEqual(make());
  });

  it("works inside a pipeline", () => {
    const out = sculpt(make())
      .derive(defaults({ tags: ["t"] }))
      .transform((d) => ({ ...d, tags: [...d.tags, "u"] }))
      .run();

    expect(out.tags).toEqual(["t", "u"]);
  });
});

describe("parse", () => {
  const positive: StandardSchemaV1<unknown, { n: number }> = {
    "~standard": {
      version: 1,
      vendor: "test",
      validate: (value) => {
        const n = (value as { n?: unknown }).n;
        return typeof n === "number" && n > 0
          ? { value: { n } }
          : {
              issues: [
                { message: "must be positive", path: [{ key: "n" }] },
                { message: "bad" },
              ],
            };
      },
    },
  };

  it("returns the schema output", () => {
    expect(parse(positive)({ n: 1, extra: true })).toEqual({ n: 1 });
  });

  it("throws a ValidationError with every issue", () => {
    expect(() => parse(positive)({ n: -1 })).toThrow(ValidationError);
    expect(() => parse(positive)({ n: -1 })).toThrow(
      "n: must be positive; bad",
    );

    try {
      parse(positive)({ n: -1 });
    } catch (error) {
      expect((error as ValidationError).issues).toHaveLength(2);
    }
  });

  it("rejects async schemas", () => {
    const async: StandardSchemaV1 = {
      "~standard": {
        version: 1,
        vendor: "test",
        validate: async (value) => ({ value }),
      },
    };

    expect(() => parse(async)(1)).toThrow("Async schemas are not supported");
  });

  it("works inside a pipeline", () => {
    const out = sculpt<unknown>()
      .derive(parse(positive))
      .transform((d) => ({ ...d, n: d.n + 1 }))
      .run({ n: 1 });

    expect(out).toEqual({ n: 2 });
  });
});
