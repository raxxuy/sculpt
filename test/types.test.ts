import { describe, expectTypeOf, it } from "vitest";
import {
  type Pipeline,
  type StandardSchemaV1,
  sculpt,
  type Transform,
} from "../src";
import {
  defaults,
  type Extended,
  extend,
  omit,
  parse,
  pick,
  rename,
} from "../src/derivations";
import { at, compose, each, eachWhen, validate, when } from "../src/transforms";

describe("types", () => {
  it("transform rejects a callback that adds a key", () => {
    // @ts-expect-error extra key
    sculpt({ a: 1 }).transform((d) => ({ ...d, b: 2 }));
  });

  it("derive sets Output to exactly R", () => {
    const out = sculpt(1)
      .derive((n) => ({ n }))
      .run();

    expectTypeOf(out).toEqualTypeOf<{ n: number }>();
  });

  it("run() with no args is an error without default data", () => {
    // @ts-expect-error missing input
    sculpt<number>().run();
  });

  it("use requires matching input", () => {
    // @ts-expect-error string pipeline on number output
    sculpt(1).use(sculpt<string>());
  });

  it("at infers paths and rejects bad ones", () => {
    type D = { a: { b: number } };

    expectTypeOf(at<D, "a.b">("a.b", (n) => n)).toEqualTypeOf<(d: D) => D>();
    // @ts-expect-error invalid path
    at<D, "a.c">("a.c", (n) => n);
    // @ts-expect-error leaf cannot change type
    at<D, "a.b">("a.b", (n) => String(n));
  });

  it("compose infers T and rejects key-adding fns", () => {
    type D = { a: { b: number } };
    const inferred: Transform<D> = compose(at("a.b", (n) => n + 1));
    expectTypeOf(inferred).toEqualTypeOf<Transform<D>>();
    // @ts-expect-error extra key
    const _bad: Transform<{ a: number }> = compose((d) => ({ ...d, b: 1 }));
  });

  it("each/eachWhen/when reject shape-changing fns; predicates reject async", () => {
    const addKey = (d: { a: number }) => ({ ...d, b: 1 });
    const asyncPredicate = async () => true;
    const identity = (n: number) => n;

    // @ts-expect-error extra key
    const _t0: Transform<{ a: number }[]> = each(addKey);
    // @ts-expect-error extra key
    const _t1: Transform<{ a: number }[]> = eachWhen(() => true, addKey);
    // @ts-expect-error extra key
    const _t2: Transform<{ a: number }> = when(() => true, addKey);
    // @ts-expect-error async predicate
    validate<number>(asyncPredicate, "m");
    // @ts-expect-error async predicate
    when<number, number>(asyncPredicate, identity);
  });

  it("pick/omit reject unknown keys and return Pick/Omit", () => {
    type D = { a: number; b: string };
    // @ts-expect-error unknown key
    pick<D, "z">("z");
    // @ts-expect-error unknown key
    omit<D, "z">("z");
    expectTypeOf(pick<D, "a">("a")).returns.toEqualTypeOf<Pick<D, "a">>();
    expectTypeOf(omit<D, "a">("a")).returns.toEqualTypeOf<Omit<D, "a">>();
  });

  it("extend overwrites a key with its new type", () => {
    type D = { a: number; b: string };
    const f = extend<D, { a: string }>({ a: (d) => String(d.a) });

    expectTypeOf(f).returns.toEqualTypeOf<Extended<D, { a: string }>>();
    expectTypeOf(f).returns.toEqualTypeOf<{ a: string; b: string }>();
  });
});

describe("no async support", () => {
  it("transform rejects a callback returning a promise", () => {
    const async = async (n: number) => n;
    // @ts-expect-error promises are not allowed
    sculpt(1).transform(async);
  });

  it("derive does not unwrap promises", () => {
    const out = sculpt(1)
      .derive(async (n) => n)
      .run();

    expectTypeOf(out).toEqualTypeOf<Promise<number>>();
  });

  it("has no runAsync or traceAsync", () => {
    expectTypeOf(sculpt(1)).not.toHaveProperty("runAsync");
    expectTypeOf(sculpt(1)).not.toHaveProperty("traceAsync");
  });

  it("exports Pipeline as a type", () => {
    const build = (p: Pipeline<number>): Pipeline<number, string> =>
      p.derive(String);

    expectTypeOf(build).returns.toEqualTypeOf<Pipeline<number, string>>();
  });
});

describe("extend function form", () => {
  it("produces Extended<T, R> and overwrites with the new type", () => {
    type D = { a: number; b: string };
    const f = extend((d: D) => ({ a: String(d.a), c: true }));

    expectTypeOf(f).returns.toEqualTypeOf<{
      a: string;
      b: string;
      c: boolean;
    }>();
  });
});

describe("rename and defaults", () => {
  type D = { a: number; b?: string };

  it("rename maps keys, keeps optionality and rejects unknown keys", () => {
    expectTypeOf(rename<D, { b: "c" }>({ b: "c" })).returns.toEqualTypeOf<{
      a: number;
      c?: string;
    }>();
    // @ts-expect-error unknown key
    sculpt<D>({ a: 1 }).derive(rename({ a: "n", z: "c" }));
  });

  it("rename types a collision as the renamed value and supports swaps", () => {
    type E = { a: number; b: string };
    const base = sculpt<E>({ a: 1, b: "" });

    expectTypeOf(base.derive(rename({ a: "b" })).run()).toEqualTypeOf<{
      b: number;
    }>();
    expectTypeOf(base.derive(rename({ a: "b", b: "a" })).run()).toEqualTypeOf<{
      a: string;
      b: number;
    }>();
  });

  it("defaults makes keys required and rejects unknown keys or bad values", () => {
    expectTypeOf(defaults<D, { b: string }>({ b: "x" })).returns.toEqualTypeOf<{
      a: number;
      b: string;
    }>();
    // @ts-expect-error unknown key
    defaults<D, { z: number }>({ z: 1 });
    // @ts-expect-error wrong value type
    defaults<D, { b: number }>({ b: 1 });
  });

  it("infers from the pipeline", () => {
    const out = sculpt<D>({ a: 1 })
      .derive(defaults({ b: "x" }))
      .derive(rename({ a: "n" }))
      .run();

    expectTypeOf(out).toEqualTypeOf<{ n: number; b: string }>();
  });
});

describe("parse", () => {
  it("outputs the schema output type from any pipeline", () => {
    const schema = {} as StandardSchemaV1<string, { id: number }>;

    const pipeline = sculpt(1).derive(parse(schema));

    expectTypeOf(pipeline.run).returns.toEqualTypeOf<{ id: number }>();
  });
});
