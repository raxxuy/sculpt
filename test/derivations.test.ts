import { describe, expect, expectTypeOf, it } from "vitest";
import { sculpt } from "../src";
import { omit, pick } from "../src/derivations";

type Data = { id: number; name: string; secret: string; tags?: string[] };
const data: Data = { id: 1, name: "a", secret: "s" };

describe("pick", () => {
  it("keeps only the listed keys", () => {
    const result = sculpt(data).derive(pick("id", "name")).run();

    expect(result).toEqual({ id: 1, name: "a" });
    expectTypeOf(result).toEqualTypeOf<Pick<Data, "id" | "name">>();
  });

  it("skips keys missing at runtime", () => {
    expect(pick<Data, "id" | "tags">("id", "tags")(data)).toEqual({ id: 1 });
    expect("tags" in pick<Data, "tags">("tags")(data)).toBe(false);
  });

  it("does not mutate or share the input", () => {
    const result = pick<Data, "id">("id")(data);

    expect(result).not.toBe(data);
    expect(data).toEqual({ id: 1, name: "a", secret: "s" });
  });

  it("returns an empty object for no keys", () => {
    expect(pick<Data, never>()(data)).toEqual({});
  });

  it("rejects unknown keys", () => {
    // @ts-expect-error missing is not a key of Data
    sculpt(data).derive(pick("missing"));
  });
});

describe("omit", () => {
  it("removes the listed keys", () => {
    const result = sculpt(data).derive(omit("secret")).run();

    expect(result).toEqual({ id: 1, name: "a" });
    expectTypeOf(result).toEqualTypeOf<Omit<Data, "secret">>();
  });

  it("keeps symbol keys and ignores inherited ones", () => {
    const symbol = Symbol("meta");
    const input = Object.assign(Object.create({ inherited: true }), {
      id: 1,
      secret: "s",
      [symbol]: "m",
    }) as { id: number; secret: string; [symbol]: string };
    const result = omit<typeof input, "secret">("secret")(input);

    expect(result).toEqual({ id: 1, [symbol]: "m" });
    expect("inherited" in result).toBe(false);
  });

  it("returns a shallow copy for no keys", () => {
    const result = omit<Data, never>()(data);

    expect(result).toEqual(data);
    expect(result).not.toBe(data);
  });

  it("rejects unknown keys", () => {
    // @ts-expect-error missing is not a key of Data
    sculpt(data).derive(omit("missing"));
  });

  it("chains with transforms after derive", () => {
    const result = sculpt(data)
      .derive(omit("secret"))
      .transform((value) => ({ ...value, name: value.name.toUpperCase() }))
      .derive(pick("name"))
      .run();

    expect(result).toEqual({ name: "A" });
  });
});
