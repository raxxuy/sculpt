import type { Derive } from "../core/types";
import type { Extended } from "./extend";

export type Defaulted<T, V> = Extended<
  T,
  { [P in keyof V & keyof T]-?: Exclude<T[P], undefined> | V[P] }
>;

export const defaults =
  <T extends object, V extends Partial<NoInfer<T>>>(
    values: V,
  ): Derive<T, Defaulted<T, V>> =>
  (data) => {
    const result = { ...data } as Record<string, unknown>;

    for (const [key, value] of Object.entries(values)) {
      if (result[key] === undefined) result[key] = value;
    }

    return result as Defaulted<T, V>;
  };
