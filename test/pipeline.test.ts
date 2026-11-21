import { describe, expect, it, vi } from "vitest";
import { sculpt } from "../src";

type Log = string[];
const logger = (log: Log, name: string) => (n: number) => {
  log.push(name);
  return n;
};

describe("transform", () => {
  it("applies anonymous and named transforms in order", () => {
    const result = sculpt(1)
      .transform((n) => n + 1)
      .transform("double", (n) => n * 2)
      .transform((n) => n + 3)
      .run();

    expect(result).toBe(7);
  });

  it("throws when a named transform has no function", () => {
    expect(() => sculpt(1).transform("x", undefined as never)).toThrow(
      "Named transform requires transform function",
    );
  });

  it("copies the after list", () => {
    const log: Log = [];
    const after = ["b"];
    const pipeline = sculpt(0)
      .transform("a", logger(log, "a"), { after })
      .transform("b", logger(log, "b"));

    after.push("missing");
    pipeline.run();

    expect(log).toEqual(["b", "a"]);
  });
});

describe("run input", () => {
  it("uses the default data when called with no args", () => {
    expect(
      sculpt(5)
        .transform((n) => n * 2)
        .run(),
    ).toBe(10);
  });

  it("prefers a passed input, and explicit undefined counts as input", () => {
    const pipeline = sculpt<number | undefined>(5);

    expect(pipeline.run(7)).toBe(7);
    expect(pipeline.run(undefined)).toBeUndefined();
  });

  it("runs without default data when an input is passed", () => {
    expect(
      sculpt<number>()
        .transform((n) => n + 1)
        .run(1),
    ).toBe(2);
  });

  it("returns the input of an empty pipeline unchanged", () => {
    const data = { a: 1 };

    expect(sculpt(data).run()).toBe(data);
  });
});

describe("branching", () => {
  it("does not affect the original or siblings", () => {
    const base = sculpt(1).transform((n) => n + 1);
    const a = base.transform((n) => n * 10);
    const b = base.transform((n) => n * 100);

    expect(base.run()).toBe(2);
    expect(a.run()).toBe(20);
    expect(b.run()).toBe(200);
  });

  it("can extend a pipeline that already ran", () => {
    const base = sculpt(1).transform((n) => n + 1);
    expect(base.run()).toBe(2);

    expect(base.transform((n) => n * 5).run()).toBe(10);
    expect(base.run()).toBe(2);
  });
});

describe("derive", () => {
  it("changes the shape for later transforms", () => {
    const result = sculpt(2)
      .derive((n) => ({ n }))
      .transform((o) => ({ n: o.n + 1 }))
      .run();

    expect(result).toEqual({ n: 3 });
  });

  it("chains multiple derives", () => {
    const result = sculpt(2)
      .derive((n) => ({ n }))
      .derive((o) => `n=${o.n}`)
      .derive((s) => s.length)
      .run();

    expect(result).toBe(3);
  });
});

describe("dependencies (after)", () => {
  it("runs a dependency declared later first", () => {
    const log: Log = [];
    sculpt(0)
      .transform("a", logger(log, "a"), { after: ["b"] })
      .transform("b", logger(log, "b"))
      .run();

    expect(log).toEqual(["b", "a"]);
  });

  it("keeps declaration order for independent transforms", () => {
    const log: Log = [];
    sculpt(0)
      .transform("a", logger(log, "a"))
      .transform("b", logger(log, "b"))
      .transform(logger(log, "anon"))
      .transform("c", logger(log, "c"))
      .run();

    expect(log).toEqual(["a", "b", "anon", "c"]);
  });

  it("runs x after z, y, z as y, z, x", () => {
    const log: Log = [];
    sculpt(0)
      .transform("x", logger(log, "x"), { after: ["z"] })
      .transform("y", logger(log, "y"))
      .transform("z", logger(log, "z"))
      .run();

    expect(log).toEqual(["y", "z", "x"]);
  });

  it("runs a diamond as a, b, c, d", () => {
    const log: Log = [];
    sculpt(0)
      .transform("b", logger(log, "b"), { after: ["a"] })
      .transform("c", logger(log, "c"), { after: ["a"] })
      .transform("d", logger(log, "d"), { after: ["b", "c"] })
      .transform("a", logger(log, "a"))
      .run();

    expect(log).toEqual(["a", "b", "c", "d"]);
  });

  it("handles a repeated name inside one after list", () => {
    const log: Log = [];
    sculpt(0)
      .transform("a", logger(log, "a"), { after: ["b", "b"] })
      .transform("b", logger(log, "b"))
      .run();

    expect(log).toEqual(["b", "a"]);
  });

  it("resolves a 1,000-step reversed chain", () => {
    const log: Log = [];
    let pipeline = sculpt(0).transform(
      "t0",
      (n) => {
        log.push("t0");
        return n;
      },
      { after: ["t1"] },
    );
    for (let i = 1; i < 1000; i++) {
      pipeline = pipeline.transform(
        `t${i}`,
        (n) => {
          log.push(`t${i}`);
          return n;
        },
        i < 999 ? { after: [`t${i + 1}`] } : undefined,
      );
    }
    pipeline.run();

    expect(log).toHaveLength(1000);
    expect(log[0]).toBe("t999");
    expect(log[999]).toBe("t0");
  });

  it("allows the same name in separate scopes", () => {
    const result = sculpt(1)
      .transform("t", (n) => n + 1)
      .derive((n) => n)
      .transform("t", (n) => n * 10)
      .run();

    expect(result).toBe(20);
  });

  it("treats a dependency on another scope as unknown", () => {
    const pipeline = sculpt(1)
      .transform("a", (n) => n)
      .derive((n) => n)
      .transform("b", (n) => n, { after: ["a"] });

    expect(() => pipeline.run()).toThrow(
      'Unknown transform dependency "a" required by "b"',
    );
  });

  it("throws on a duplicate name with scope and declared indexes", () => {
    const pipeline = sculpt(1)
      .transform((n) => n)
      .derive((n) => n)
      .transform("t", (n) => n)
      .transform((n) => n)
      .transform("t", (n) => n);

    expect(() => pipeline.run()).toThrow(
      'Duplicate transform name "t" in scope 1 (declared indexes 2 and 4)',
    );
  });

  it("throws a cycle with the full path", () => {
    const pipeline = sculpt(1)
      .transform("a", (n) => n, { after: ["b"] })
      .transform("b", (n) => n, { after: ["a"] });

    expect(() => pipeline.run()).toThrow(
      'Circular transform dependencies: "a" -> "b" -> "a"',
    );
  });

  describe("build-time validation", () => {
    // Plan 2.6: scopes closed by .derive() throw there. Old code throws on first run.
    it.fails("throws at .derive() for a duplicate name", () => {
      const pipeline = sculpt(1)
        .transform("t", (n) => n)
        .transform("t", (n) => n);

      expect(() => pipeline.derive((n) => n)).toThrow("Duplicate");
    });

    it.fails("throws at .derive() for an unknown dependency", () => {
      const pipeline = sculpt(1).transform("a", (n) => n, { after: ["x"] });

      expect(() => pipeline.derive((n) => n)).toThrow("Unknown");
    });

    it.fails("throws at .derive() for a cycle", () => {
      const pipeline = sculpt(1)
        .transform("a", (n) => n, { after: ["b"] })
        .transform("b", (n) => n, { after: ["a"] });

      expect(() => pipeline.derive((n) => n)).toThrow("Circular");
    });

    it("does not throw while building an invalid open scope; throws on first run, trace and inspect before any callback", () => {
      const fn = vi.fn((n: number) => n);
      const build = () =>
        sculpt(1)
          .transform("a", fn, { after: ["missing"] })
          .transform("b", fn);

      expect(() => build().run()).toThrow("Unknown");
      expect(() => build().trace()).toThrow("Unknown");
      expect(() => build().inspect()).toThrow("Unknown");
      expect(fn).not.toHaveBeenCalled();
    });

    it("allows a forward reference in the open scope", () => {
      const log: Log = [];
      const pipeline = sculpt(0)
        .transform("a", logger(log, "a"), { after: ["b"] })
        .transform("b", logger(log, "b"));

      pipeline.run();
      expect(log).toEqual(["b", "a"]);
    });

    it("keeps the original usable after a branch threw at .derive()", () => {
      const base = sculpt(1).transform("a", (n) => n + 1);
      try {
        base
          .transform("a", (n) => n)
          .derive((n) => n)
          .run();
      } catch {}

      expect(base.run()).toBe(2);
    });
  });
});

describe("use", () => {
  it("appends the other steps and flows types across a shape change", () => {
    const other = sculpt<number>()
      .transform((n) => n * 2)
      .derive((n) => ({ n }));
    const result = sculpt(5)
      .transform((n) => n + 1)
      .use(other)
      .transform((o) => ({ n: o.n + 1 }))
      .run();

    expect(result).toEqual({ n: 13 });
  });

  it("keeps the receiver's default data", () => {
    const other = sculpt(100).transform((n) => n * 2);

    expect(sculpt(5).use(other).run()).toBe(10);
  });

  it("is identity for an empty pipeline and can be used twice", () => {
    const double = sculpt<number>().transform((n) => n * 2);

    expect(sculpt(3).use(sculpt<number>()).run()).toBe(3);
    expect(sculpt(3).use(double).use(double).run()).toBe(12);
  });

  it("does not run callbacks while composing and leaves inputs unchanged", () => {
    const fn = vi.fn((n: number) => n + 1);
    const other = sculpt<number>().transform("a", fn);
    const base = sculpt(1).transform("b", fn);

    sculpt(1).use(other);
    base.use(other);

    expect(fn).not.toHaveBeenCalled();
    expect(other.inspect().steps).toHaveLength(1);
    expect(base.inspect().steps).toHaveLength(1);
  });

  it("resolves dependencies across the boundary and keeps derive boundaries", () => {
    const log: Log = [];
    const other = sculpt<number>().transform("late", logger(log, "late"));
    sculpt(0)
      .transform("early", logger(log, "early"), { after: ["late"] })
      .use(other)
      .run();
    expect(log).toEqual(["late", "early"]);

    const withDerive = sculpt(0)
      .transform("t", (n) => n)
      .use(sculpt<number>().derive((n) => n))
      .transform("t", (n) => n);
    expect(() => withDerive.run()).not.toThrow();
  });

  it("throws a cycle in the open scope at first run", () => {
    const other = sculpt<number>().transform("b", (n) => n, { after: ["a"] });
    const pipeline = sculpt(1)
      .transform("a", (n) => n, { after: ["b"] })
      .use(other);

    expect(() => pipeline.run()).toThrow("Circular");
  });

  // Plan 2.6: .use() validates scopes it closes. Old code throws on first run.
  it.fails("throws at .use() for a cycle in a scope that use closes", () => {
    const other = sculpt<number>()
      .transform("b", (n) => n, { after: ["a"] })
      .derive((n) => n);
    const base = sculpt(1).transform("a", (n) => n, { after: ["b"] });

    expect(() => base.use(other)).toThrow("Circular");
  });
});

describe("failed validation", () => {
  it("throws the same error on every call", () => {
    const pipeline = sculpt(1).transform("a", (n) => n, { after: ["nope"] });

    expect(() => pipeline.run()).toThrow('Unknown transform dependency "nope"');
    expect(() => pipeline.run()).toThrow('Unknown transform dependency "nope"');
  });
});
