import { describe, expect, it } from "vitest";
import { sculpt } from "../src/sculpt";

describe("derive", () => {
  it("derives a new shape", () => {
    const result = sculpt({
      price: 10,
      quantity: 3,
    })
      .derive((data) => ({
        total: data.price * data.quantity,
      }))
      .run();

    expect(result).toEqual({ total: 30 });
  });

  it("can add derived properties to the current data", () => {
    const result = sculpt({
      price: 10,
      quantity: 3,
    })
      .derive((data) => ({
        ...data,
        total: data.price * data.quantity,
      }))
      .run();

    expect(result).toEqual({
      price: 10,
      quantity: 3,
      total: 30,
    });
  });

  it("applies transforms before derive", () => {
    const result = sculpt({
      price: 10,
      quantity: 3,
    })
      .transform((data) => ({
        ...data,
        price: data.price * 2,
      }))
      .derive((data) => ({
        total: data.price * data.quantity,
      }))
      .run();

    expect(result).toEqual({ total: 60 });
  });

  it("allows transforms to operate on the derived shape", () => {
    const result = sculpt({
      price: 10,
      quantity: 3,
    })
      .derive((data) => ({
        total: data.price * data.quantity,
      }))
      .transform((data) => ({
        total: data.total + 5,
      }))
      .run();

    expect(result).toEqual({ total: 35 });
  });

  it("supports multiple derived shapes", () => {
    const result = sculpt({
      firstName: "Test",
      lastName: "123456",
    })
      .derive((data) => ({
        fullName: `${data.firstName} ${data.lastName}`,
      }))
      .derive((data) => ({
        length: data.fullName.length,
      }))
      .run();

    expect(result).toEqual({
      length: 11,
    });
  });
});
