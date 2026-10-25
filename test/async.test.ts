import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { type MaybePromise, sculpt } from "../src";

describe("async", () => {
  it("accepts MaybePromise callbacks without changing execution return types", async () => {
    expectTypeOf<MaybePromise<number>>().toEqualTypeOf<
      number | PromiseLike<number>
    >();

    const increment = (value: number): MaybePromise<number> =>
      value % 2 === 0 ? value + 1 : Promise.resolve(value + 1);
    const pipeline = sculpt(2).transform(increment);

    expectTypeOf(pipeline.run).returns.toEqualTypeOf<number>();
    expectTypeOf(pipeline.runAsync).returns.toEqualTypeOf<Promise<number>>();
    expect(pipeline.run()).toBe(3);
    await expect(pipeline.runAsync()).resolves.toBe(3);
    await expect(pipeline.runAsync(3)).resolves.toBe(4);
  });

  it("passes Promise inputs directly to the first callback in both execution modes", async () => {
    const input = Promise.resolve(3);
    const first = vi.fn((value: Promise<number>) => value);
    const pipeline = sculpt(input).derive(first);

    expect(pipeline.run()).toBe(input);
    await expect(pipeline.runAsync()).resolves.toBe(3);
    expect(first).toHaveBeenCalledTimes(2);
    expect(first).toHaveBeenNthCalledWith(1, input);
    expect(first).toHaveBeenNthCalledWith(2, input);
  });

  it("mixes synchronous and asynchronous transforms and derivations", async () => {
    const pipeline = sculpt(3)
      .transform((value) => value + 1)
      .transform(async (value) => value * 2)
      .derive((value) => Promise.resolve({ total: value }))
      .derive((data) => `Total: ${data.total}`);

    await expect(pipeline.runAsync()).resolves.toBe("Total: 8");
    await expect(pipeline.runAsync(4)).resolves.toBe("Total: 10");
  });

  it.each([0, 2])(
    "waits for a pending step after %i synchronous steps before calling the next",
    async (preceding) => {
      let resolve!: (value: number) => void;
      const pending = new Promise<number>((done) => {
        resolve = done;
      });
      const next = vi.fn((value: number) => value + 1);
      let pipeline = sculpt(3);

      for (let index = 0; index < preceding; index++) {
        pipeline = pipeline.transform((value) => value + 1);
      }

      const result = pipeline
        .transform(() => pending)
        .transform(next)
        .runAsync();

      expect(next).not.toHaveBeenCalled();
      resolve(6);
      await expect(result).resolves.toBe(7);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next).toHaveBeenCalledWith(6);
    },
  );

  it("resolves non-native thenables during execution and tracing", async () => {
    const thenable: PromiseLike<number> = {
      // biome-ignore lint/suspicious/noThenProperty: intentionally test a non-native thenable
      then: (resolve, reject) => Promise.resolve(6).then(resolve, reject),
    };
    const pipeline = sculpt(3)
      .transform(() => thenable)
      .derive((value) => value + 1);

    await expect(pipeline.runAsync()).resolves.toBe(7);
    const trace = await pipeline.traceAsync();

    expect(trace.result).toBe(7);
    expect(trace.steps.map(({ input, output }) => ({ input, output }))).toEqual(
      [
        { input: 3, output: 6 },
        { input: 6, output: 7 },
      ],
    );
  });

  it.each(["runAsync", "traceAsync"] as const)(
    "%s rejects synchronous callback errors and skips downstream steps",
    async (method) => {
      const error = new Error("Synchronous failure");
      const next = vi.fn((value: number) => value + 1);
      const pipeline = sculpt(3)
        .transform(() => {
          throw error;
        })
        .transform(next);

      await expect(pipeline[method]()).rejects.toBe(error);
      expect(next).not.toHaveBeenCalled();
    },
  );

  it("traces resolved inputs and outputs", async () => {
    const trace = await sculpt(3)
      .transform("double", async (value) => value * 2)
      .derive(async (value) => ({ total: value }))
      .traceAsync();

    expect(trace).toEqual({
      result: { total: 6 },
      steps: [
        {
          index: 0,
          kind: "transform",
          name: "double",
          durationMs: expect.any(Number),
          input: 3,
          output: 6,
        },
        {
          index: 1,
          kind: "derive",
          durationMs: expect.any(Number),
          input: 6,
          output: { total: 6 },
        },
      ],
    });
  });

  it("preserves rejection identity and skips downstream steps", async () => {
    const error = new Error("Lookup failed");
    const next = vi.fn((value: number) => value + 1);
    const pipeline = sculpt(3)
      .transform(async () => {
        throw error;
      })
      .transform(next);

    await expect(pipeline.runAsync()).rejects.toBe(error);
    await expect(pipeline.traceAsync()).rejects.toBe(error);
    expect(next).not.toHaveBeenCalled();
  });

  it("resolves Promise inputs for empty async pipelines but preserves them in sync mode", async () => {
    const input = Promise.resolve(5);
    const pipeline = sculpt(input);

    expect(pipeline.run()).toBe(input);
    expect(pipeline.trace()).toEqual({ result: input, steps: [] });
    await expect(pipeline.runAsync()).resolves.toBe(5);
    await expect(pipeline.traceAsync()).resolves.toEqual({
      result: 5,
      steps: [],
    });
  });

  it("handles a pipeline without operations or a default input", async () => {
    const pipeline = sculpt<number>();

    await expect(pipeline.runAsync(5)).resolves.toBe(5);
    await expect(pipeline.traceAsync(5)).resolves.toEqual({
      result: 5,
      steps: [],
    });
  });
});
