import { Pipeline } from "./pipeline";

export function sculpt<T>(): Pipeline<T, T, false>;
export function sculpt<T>(data: T): Pipeline<T, T, true>;
export function sculpt<T>(data?: T): Pipeline<T, T, boolean> {
  return new Pipeline<T, T, boolean>(data);
}
