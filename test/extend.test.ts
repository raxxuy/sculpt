import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { sculpt } from "../src";
import { extend } from "../src/derivations";

describe("extend", () => {
  const order = { price: 10, quantity: 3, label: "order" };

  it("adds computed keys", () => {
    const result = sculpt(order)
      .derive(extend({ total: (d) => d.price * d.quantity }))
      .run();

    expect(result).toEqual({
      price: 10,
      quantity: 3,
      label: "order",
      total: 30,
    });
    expectTypeOf(result).toEqualTypeOf<{
      price: number;
      quantity: number;
      label: string;
      total: number;
    }>();
  });

  it("overwrites existing keys with the new value type", () => {
    const result = sculpt(order)
      .derive(extend({ label: (d) => d.label.length }))
      .run();

    expect(result.label).toBe(5);
    expectTypeOf(result.label).toEqualTypeOf<number>();
  });

  it("passes the original input to every field", () => {
    const result = sculpt(order)
      .derive(
        extend({
          price: (d) => d.price * 2,
          original: (d) => d.price,
        }),
      )
      .run();

    expect(result).toMatchObject({ price: 20, original: 10 });
  });

  it("computes each field once per run and does not mutate the input", () => {
    const total = vi.fn((d: typeof order) => d.price * d.quantity);
    const result = extend<typeof order, { total: number }>({ total })(order);

    expect(total).toHaveBeenCalledTimes(1);
    expect(total).toHaveBeenCalledWith(order);
    expect(Object.getOwnPropertyDescriptor(result, "total")?.value).toBe(30);
    expect(result).not.toBe(order);
    expect(order).not.toHaveProperty("total");
  });

  it("supports non-primitive and nullish values", () => {
    const result = sculpt({ id: 1 })
      .derive(
        extend({
          ids: (d) => [d.id],
          meta: (d) => ({ id: d.id }),
          empty: () => null,
        }),
      )
      .run();

    expect(result).toEqual({ id: 1, ids: [1], meta: { id: 1 }, empty: null });
    expectTypeOf(result.ids).toEqualTypeOf<number[]>();
    expectTypeOf(result.empty).toEqualTypeOf<null>();
  });

  it("returns a shallow copy for no fields", () => {
    const result = extend<typeof order, Record<never, never>>({})(order);

    expect(result).toEqual(order);
    expect(result).not.toBe(order);
  });

  it("rejects unknown input keys", () => {
    // @ts-expect-error missing is not a key of the input
    sculpt(order).derive(extend({ total: (d) => d.missing }));
  });

  it("chains with later steps", () => {
    const result = sculpt(order)
      .derive(extend({ total: (d) => d.price * d.quantity }))
      .derive(extend({ tax: (d) => d.total * 0.2 }))
      .run();

    expect(result.tax).toBe(6);
  });
});
