import { describe, expect, it, vi } from "vitest";
import { sculpt } from "../src";

describe("async", () => {
  it("mixes synchronous and asynchronous transforms and derivations", async () => {
    const pipeline = sculpt(3)
      .transform((value) => value + 1)
      .transform(async (value) => value * 2)
      .derive((value) => Promise.resolve({ total: value }))
      .derive((data) => `Total: ${data.total}`);

    await expect(pipeline.runAsync()).resolves.toBe("Total: 8");
    await expect(pipeline.runAsync(4)).resolves.toBe("Total: 10");
  });

  it("waits for a pending step before calling the next", async () => {
    let resolve!: (value: number) => void;
    const pending = new Promise<number>((done) => {
      resolve = done;
    });
    const next = vi.fn((value: number) => value + 1);
    const result = sculpt(3)
      .transform(() => pending)
      .transform(next)
      .runAsync();

    expect(next).not.toHaveBeenCalled();
    resolve(6);
    await expect(result).resolves.toBe(7);
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(6);
  });

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
    expect(next).not.toHaveBeenCalled();
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
