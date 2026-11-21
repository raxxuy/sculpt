# Sculpt

Sculpt is a small, domain-agnostic library for transforming structured data through ordered, composable steps.

Early development. The API may change.

## Usage

```ts
import { sculpt } from "sculpt";

const result = sculpt({ price: 10, qty: 3 })
  .transform((d) => ({ ...d, qty: d.qty + 1 }))
  .derive((d) => ({ total: d.price * d.qty }))
  .run(); // { total: 40 }
```

`sculpt(data)` creates an immutable pipeline with default data. `sculpt<T>()` has none, so you pass the input to `run`.
Every builder method returns a new pipeline; branching never affects the original.

### transform

A transform returns the same shape it received. Name it to depend on others with `after`:

```ts
sculpt(0)
  .transform("report", (n) => n * 2, { after: ["load"] })
  .transform("load", (n) => n + 1)
  .run(); // load runs first
```

Ordering: transforms with no unmet dependencies run in declaration order. A transform becomes ready when its last
dependency has run and is queued behind the ones already ready (FIFO). Dependencies only resolve within their own scope
(the run of transforms between two `derive` calls), and names must be unique within a scope.

### derive

`derive(fn)` may change the data's shape. Later transforms see the new shape. Each `derive` closes a scope.

### use

`use(other)` appends another pipeline's steps (its default data is ignored). Callbacks are not run while composing.

### params

`params<P>()` declares parameters; `with(params)` binds them and returns a new pipeline. Every step, including those
inside helpers, receives them as `context.params`. `run` and `trace` are type errors until params are bound. `use`
merges the other pipeline's params.

```ts
const scale = sculpt<number>()
  .params<{ factor: number }>()
  .transform((n, { params }) => n * params.factor);

scale.with({ factor: 2 }).run(3); // 6
```

### run, trace, inspect

- `run(input?)` runs the pipeline. An explicit `undefined` counts as input.
- `trace(input?)` returns `{ result, steps }`; each step has `index`, `kind`, `name?`, `durationMs`, `input`, `output`.
- `inspect()` returns the declared and execution order, scope and dependencies without running anything.

### Errors

Duplicate names, unknown dependencies and cycles throw. `.derive()` and `.use()` check every scope they close, so
they throw at that call. The last, still-open scope is checked on the first `run`, `trace` or `inspect` (a transform may
still name a dependency declared later). Calling `inspect()` once validates a whole pipeline without running it.

A step that throws during `run` or `trace` is rethrown as a `StepError` with `index`, `kind`, `step` (its name) and the
original error as `cause`. From `trace` it also carries the completed `steps`.

## Transforms

`sculpt/transforms`: `at`, `compose`, `each`, `eachWhen`, `when`, `validate`. They are pure and return the same
reference when nothing changes.

```ts
import { at, each, validate, when } from "sculpt/transforms";

sculpt({ user: { score: 1 }, tags: ["a"] })
  .transform(validate((d) => d.tags.length > 0, "tags required"))
  .transform(at("user.score", (n) => n + 1))
  .run();
```

## Derivations

`sculpt/derivations`: `pick`, `omit`, `extend`, `rename`, `defaults`, `parse`. They only read own properties and always return a new object.

```ts
import { extend, omit, pick } from "sculpt/derivations";

sculpt({ id: 1, items: [1, 2], secret: "s" })
  .derive(omit("secret"))
  .derive(extend({ count: (d) => d.items.length })) // one function per field
  .derive(
    extend((d) => {
      const total = d.items.reduce((a, b) => a + b, 0);
      return { total, avg: total / d.count }; // shared work, one call
    }),
  )
  .derive(pick("id", "total"))
  .run();
```

An arrow returning an object literal needs parentheses: `(d) => ({ a: 1 })`.
