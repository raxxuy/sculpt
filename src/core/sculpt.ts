import { Pipeline } from "./pipeline";

type Sculpt = {
  <T>(): Pipeline<T, T, false>;
  <T>(data: T): Pipeline<T, T, true>;
};

export const sculpt: Sculpt = <T>(data?: T): Pipeline<T, T, boolean> => {
  return new Pipeline<T, T, boolean>(data);
};
