import { Pipeline } from "./pipeline";

export const sculpt = <T>(data: T): Pipeline<T> => new Pipeline<T>(data);
