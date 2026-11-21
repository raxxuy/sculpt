import { extend, omit, pick } from "../dist/derivations.js";
import { sculpt } from "../dist/index.js";
import { at, compose, each, when } from "../dist/transforms.js";

const WARMUP_MS = 200;
const SAMPLE_MS = 20;
const SAMPLES = 15;
const GATE = 1.15;

const weigh = (value) => (typeof value === "number" ? value : value ? 1 : 0);

// The checksum keeps V8 from optimizing the measured work away; a counted loop adds no allocations.
const repeat = (fn, times) => {
  let checksum = 0;
  for (let i = 0; i < times; i++) checksum += weigh(fn());
  return checksum;
};

const checksums = [];

const elapsed = (fn, times) => {
  const start = performance.now();
  checksums.push(repeat(fn, times));
  return performance.now() - start;
};

const calibrate = (fn, times = 1) =>
  elapsed(fn, times) >= SAMPLE_MS ? times : calibrate(fn, times * 2);

const warm = (fn) => {
  const end = performance.now() + WARMUP_MS;
  while (performance.now() < end) elapsed(fn, 100);
};

const median = (values) =>
  values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];

const nsPerOp = (fn, times) => (elapsed(fn, times) * 1e6) / times;

const compare = (a, b) => {
  warm(a);
  warm(b);
  const [timesA, timesB] = [calibrate(a), calibrate(b)];
  const samples = Array.from({ length: SAMPLES }, () => [
    nsPerOp(a, timesA),
    nsPerOp(b, timesB),
  ]);

  return [median(samples.map(([x]) => x)), median(samples.map(([, y]) => y))];
};

const rows = [];

const row = (name, lib, vanilla, { gate = GATE } = {}) => {
  const [libNs, vanillaNs] = compare(lib, vanilla);
  const ratio = libNs / vanillaNs;
  const status = gate === null ? "report" : ratio <= gate ? "PASS" : "FAIL";

  rows.push({
    case: name,
    "sculpt ns/op": libNs.toFixed(0),
    "vanilla ns/op": vanillaNs.toFixed(0),
    ratio: ratio.toFixed(2),
    status: gate === GATE || gate === null ? status : `${status} (≤ ${gate}x)`,
  });
};

const report = (name, lib, vanilla) => row(name, lib, vanilla, { gate: null });

// Runtime-keyed helpers can't match code written for one literal shape, so that is reported, not gated.
const gatedAndCeiling = (name, lib, generic, literal) => {
  row(name, lib, generic);
  report(`${name} vs literal`, lib, literal);
};

// V8 shares type feedback between closures from the same source, so each case loads its own module copies.
const isolated = async (name) => {
  const query = `?case=${encodeURIComponent(name)}`;
  const [{ sculpt }, { runAll }] = await Promise.all([
    import(`../dist/index.js${query}`),
    import(`./vanilla.mjs${query}`),
  ]);
  return { create: sculpt, runAll };
};

const inc = (n) => n + 1;
const identity = (x) => x;
const range = (n) => Array.from({ length: n }, (_, i) => i);

const runCase = async (name, fns, build) => {
  const { create, runAll } = await isolated(name);
  const pipeline = build(create);
  pipeline.run();
  row(
    name,
    () => pipeline.run(),
    () => runAll(fns, 0),
  );
};

for (const n of [10, 100, 1000]) {
  await runCase(
    `run ${n} increments`,
    range(n).map(() => inc),
    (create) => range(n).reduce((p) => p.transform(inc), create(0)),
  );
}

await runCase(
  "run 100 increments + 10 derives",
  range(100).flatMap((i) => (i % 10 === 9 ? [inc, identity] : [inc])),
  (create) =>
    range(100).reduce((p, i) => {
      const next = p.transform(inc);
      return i % 10 === 9 ? next.derive(identity) : next;
    }, create(0)),
);

await runCase(
  "run 100 chained after deps (reversed)",
  range(100).map(() => inc),
  (create) =>
    range(100).reduce(
      (p, i) =>
        p.transform(
          `t${i}`,
          inc,
          i < 99 ? { after: [`t${i + 1}`] } : undefined,
        ),
      create(0),
    ),
);

{
  const orders = range(1000).map((id) => ({
    id,
    price: id % 50,
    qty: (id % 7) + 1,
  }));
  const totalOf = (rows) =>
    rows.reduce((sum, row) => sum + row.price * row.qty, 0);
  const pipeline = sculpt(orders)
    .transform((rows) => rows.filter((row) => row.qty > 1))
    .transform((rows) =>
      rows.map((row) => ({ ...row, price: row.price * 1.1 })),
    )
    .derive((rows) => ({ rows, count: rows.length }))
    .derive((summary) => ({ ...summary, total: totalOf(summary.rows) }));

  row(
    "realistic: 1,000 rows filter/normalize/summarize/total",
    () => pipeline.run(),
    () => {
      const rows = orders
        .filter((row) => row.qty > 1)
        .map((row) => ({ ...row, price: row.price * 1.1 }));
      return { rows, count: rows.length, total: totalOf(rows) };
    },
  );
}

{
  const data = {
    a: 1,
    user: { name: "n", profile: { score: 1, tags: ["x"] } },
    other: { x: 1 },
  };
  const setIn = (target, keys, fn, depth = 0) => {
    const key = keys[depth];
    const value =
      depth < keys.length - 1
        ? setIn(target[key], keys, fn, depth + 1)
        : fn(target[key]);
    if (Object.is(value, target[key])) return target;
    const copy = Array.isArray(target) ? [...target] : { ...target };
    copy[key] = value;
    return copy;
  };
  const withScore = (source) => ({
    ...source.user,
    profile: { ...source.user.profile, score: inc(source.user.profile.score) },
  });

  const one = at("user.profile.score", inc);
  gatedAndCeiling(
    "at one deep path",
    () => one(data),
    () => setIn(data, ["user", "profile", "score"], inc),
    () => ({ ...data, user: withScore(data) }),
  );

  const paths = [["a"], ["user", "profile", "score"], ["other", "x"]];
  const three = at(["a", "user.profile.score", "other.x"], inc);
  gatedAndCeiling(
    "at three paths",
    () => three(data),
    () => paths.reduce((value, keys) => setIn(value, keys, inc), data),
    () => ({
      ...data,
      a: inc(data.a),
      user: withScore(data),
      other: { ...data.other, x: inc(data.other.x) },
    }),
  );

  const numbers = range(100);
  const incrementAll = each(inc);
  row(
    "each",
    () => incrementAll(numbers),
    () => numbers.map((n) => inc(n)),
  );

  const incrementPositive = when((n) => n > 0, inc);
  const five = numbers[5];
  row(
    "when",
    () => incrementPositive(five),
    () => (five > 0 ? inc(five) : five),
  );

  const { runAll } = await isolated("compose");
  const incrementThrice = compose(inc, inc, inc);
  gatedAndCeiling(
    "compose",
    () => incrementThrice(1),
    () => runAll([inc, inc, inc], 1),
    () => inc(inc(inc(1))),
  );
}

{
  const data = { a: 1, b: 2, c: 3, d: 4 };

  const pickAC = pick("a", "c");
  gatedAndCeiling(
    "pick",
    () => pickAC(data),
    () => {
      const result = {};
      for (const key of ["a", "c"])
        if (Object.hasOwn(data, key)) result[key] = data[key];
      return result;
    },
    () => ({ a: data.a, c: data.c }),
  );

  const omitted = new Set(["b"]);
  const omitB = omit("b");
  gatedAndCeiling(
    "omit",
    () => omitB(data),
    () => {
      const result = {};
      for (const key in data) {
        if (Object.hasOwn(data, key) && !omitted.has(key))
          result[key] = data[key];
      }
      for (const symbol of Object.getOwnPropertySymbols(data)) {
        if (Object.prototype.propertyIsEnumerable.call(data, symbol)) {
          result[symbol] = data[symbol];
        }
      }
      return result;
    },
    () => {
      const { b, ...rest } = data;
      return rest;
    },
  );

  const fields = { sum: (x) => x.a + x.b, double: (x) => x.c * 2 };
  const fieldEntries = Object.entries(fields);
  const extendFields = extend(fields);
  gatedAndCeiling(
    "extend object form",
    () => extendFields(data),
    () => {
      const result = { ...data };
      for (const [key, field] of fieldEntries) result[key] = field(data);
      return result;
    },
    () => ({ ...data, sum: data.a + data.b, double: data.c * 2 }),
  );

  const compute = (x) => ({ sum: x.a + x.b, double: x.c * 2 });
  const extendComputed = extend(compute);
  gatedAndCeiling(
    "extend function form",
    () => extendComputed(data),
    () => ({ ...data, ...compute(data) }),
    () => ({ ...data, sum: data.a + data.b, double: data.c * 2 }),
  );
}

{
  const { create, runAll } = await isolated("construction");
  const indexes = { 10: range(10), 100: range(100), 1000: range(1000) };
  const build = (n, add) => indexes[n].reduce(add, create(0)).run();

  for (const n of [10, 100, 1000]) {
    report(
      `construct + run ${n}`,
      () => build(n, (p) => p.transform(inc)),
      () => runAll(Array(n).fill(inc), 0),
    );
  }

  row(
    "construct + run 1,000 deps: reversed vs ordered",
    () =>
      build(1000, (p, i) =>
        p.transform(
          `t${i}`,
          inc,
          i < 999 ? { after: [`t${i + 1}`] } : undefined,
        ),
      ),
    () =>
      build(1000, (p, i) =>
        p.transform(`t${i}`, inc, i > 0 ? { after: [`t${i - 1}`] } : undefined),
      ),
    { gate: 2 },
  );

  // Stateless hash instead of a PRNG so the "random" dependencies are identical on every run.
  const hash = (n) => Math.imul(n ^ (n >>> 15), 0x2c1b3c6d) >>> 0;
  const dependencies = range(1000).map((i) =>
    range(Math.min(3, i)).map((j) => `t${hash(i * 3 + j) % i}`),
  );

  report(
    "construct + run 1,000 with 3 random deps vs unconstrained",
    () =>
      build(1000, (p, i) =>
        p.transform(`t${i}`, inc, { after: dependencies[i] }),
      ),
    () => build(1000, (p) => p.transform(inc)),
  );
}

console.table(rows);
console.log(`checksum: ${checksums.reduce((a, b) => (a + b) % 1e9, 0)}`);

if (rows.some((r) => r.status.startsWith("FAIL"))) {
  console.log("FAIL: at least one gate failed");
  process.exit(1);
}
