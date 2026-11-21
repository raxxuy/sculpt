import { describe, expectTypeOf, it } from "vitest";
import { sculpt, type Transform } from "../src";
import { type Extended, extend, omit, pick } from "../src/derivations";
import { at, compose, each, eachWhen, validate, when } from "../src/transforms";

// Phase 1 baseline: only assertions that hold on the current code.
// Promise/Awaited, runAsync/traceAsync, Pipeline export and extend function form join in phase 4/5.
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
    const ok: Transform<D> = compose(at("a.b", (n) => n + 1));
    // @ts-expect-error extra key
    const bad: Transform<{ a: number }> = compose((d) => ({ ...d, b: 1 }));
  });

  it("each/eachWhen/when reject shape-changing fns; predicates reject async", () => {
    const addKey = (d: { a: number }) => ({ ...d, b: 1 });
    const asyncPredicate = async () => true;
    const identity = (n: number) => n;

    // @ts-expect-error extra key
    const t0: Transform<{ a: number }[]> = each(addKey);
    // @ts-expect-error extra key
    const t1: Transform<{ a: number }[]> = eachWhen(() => true, addKey);
    // @ts-expect-error extra key
    const t2: Transform<{ a: number }> = when(() => true, addKey);
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
