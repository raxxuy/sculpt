export const runAll = (fns, input) =>
  fns.reduce((value, fn) => fn(value), input);
