import { describe, expect, it } from "vitest";
import { sculpt } from "../src";

describe("sculpt - intensive integration", () => {
  it("handles a long multi-context pipeline", () => {
    const result = sculpt({
      users: [
        { id: 1, name: "bob", age: 22, active: true },
        { id: 2, name: "tea", age: 17, active: false },
        { id: 3, name: "luke", age: 31, active: true },
        { id: 4, name: "mia", age: 25, active: true },
        { id: 5, name: "peter", age: 15, active: false },
      ],
    })
      .transform("normalizeNames", (data) => ({
        ...data,
        users: data.users.map((user) => ({
          ...user,
          name: user.name[0]?.toUpperCase() + user.name.slice(1),
        })),
      }))
      .transform(
        "removeInactive",
        (data) => ({
          ...data,
          users: data.users.filter((user) => user.active),
        }),
        { after: ["normalizeNames"] },
      )
      .transform(
        "sortByAge",
        (data) => ({
          ...data,
          users: [...data.users].sort((a, b) => a.age - b.age),
        }),
        { after: ["removeInactive"] },
      )
      .derive((data) => ({
        users: data.users,
        adults: data.users.filter((user) => user.age >= 18),
      }))
      .derive((data) => ({
        userCount: data.users.length,
        adultCount: data.adults.length,
      }))
      .derive((data) => ({
        summary: {
          users: data.userCount,
          adults: data.adultCount,
          minors: data.userCount - data.adultCount,
        },
      }))
      .transform("addLabel", (data) => ({
        ...data,
        label: `${data.summary.adults}/${data.summary.users} adults`,
      }))
      .run();

    expect(result).toEqual({
      summary: {
        users: 3,
        adults: 3,
        minors: 0,
      },
      label: "3/3 adults",
    });
  });

  it("handles many transforms in a single context", () => {
    const transforms = Array.from({ length: 100 }, (_, index) => index);

    let pipeline = sculpt({ value: 0 });

    for (const index of transforms) {
      pipeline = pipeline.transform(`step-${index}`, (data) => ({
        value: data.value + 1,
      }));
    }

    const result = pipeline.run();

    expect(result).toEqual({ value: 100 });
  });

  it("handles many dependency relationships", () => {
    let pipeline = sculpt({ value: 0 });

    for (let index = 0; index < 100; index++) {
      const name = `step-${index}`;
      const dependency = index > 0 ? [`step-${index - 1}`] : [];

      pipeline = pipeline.transform(
        name,
        (data) => ({
          value: data.value + 1,
        }),
        { after: dependency },
      );
    }

    const result = pipeline.run();

    expect(result).toEqual({ value: 100 });
  });

  it("resolves a heavily shuffled dependency graph", () => {
    const operations = [
      ["step-9", 9],
      ["step-3", 3],
      ["step-7", 7],
      ["step-1", 1],
      ["step-8", 8],
      ["step-0", 0],
      ["step-6", 6],
      ["step-4", 4],
      ["step-2", 2],
      ["step-5", 5],
    ] as const;

    let pipeline = sculpt({ order: [] as number[] });

    for (const [name, index] of operations) {
      pipeline = pipeline.transform(
        name,
        (data) => ({
          order: [...data.order, index],
        }),
        {
          after: index === 0 ? [] : [`step-${index - 1}`],
        },
      );
    }

    const result = pipeline.run();

    expect(result.order).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("preserves registration order for a large number of independent transforms", () => {
    const executionOrder: number[] = [];

    let pipeline = sculpt({});

    for (let index = 0; index < 100; index++) {
      pipeline = pipeline.transform(() => {
        executionOrder.push(index);
        return {};
      });
    }

    pipeline.run();

    expect(executionOrder).toEqual(
      Array.from({ length: 100 }, (_, index) => index),
    );
  });

  it("supports many derive boundaries", () => {
    const result = sculpt({ value: 1 })
      .derive((data) => ({
        value: data.value + 1,
        step1: true,
      }))
      .derive((data) => ({
        value: data.value + 1,
        step2: true,
      }))
      .derive((data) => ({
        value: data.value + 1,
        step3: true,
      }))
      .derive((data) => ({
        value: data.value + 1,
        step4: true,
      }))
      .derive((data) => ({
        value: data.value + 1,
        step5: true,
      }))
      .derive((data) => ({
        value: data.value + 1,
        step6: true,
      }))
      .derive((data) => ({
        value: data.value + 1,
        step7: true,
      }))
      .derive((data) => ({
        value: data.value + 1,
        step8: true,
      }))
      .derive((data) => ({
        value: data.value + 1,
        step9: true,
      }))
      .derive((data) => ({
        value: data.value + 1,
        step10: true,
      }))
      .run();

    expect(result).toEqual({
      value: 11,
      step10: true,
    });
  });

  it("supports transforms between every derive boundary", () => {
    const result = sculpt({ value: 1 })
      .transform((data) => ({
        value: data.value + 1,
      }))
      .derive((data) => ({
        doubled: data.value * 2,
      }))
      .transform((data) => ({
        doubled: data.doubled + 10,
      }))
      .derive((data) => ({
        result: data.doubled * 3,
      }))
      .transform((data) => ({
        result: data.result + 100,
      }))
      .derive((data) => ({
        final: data.result,
      }))
      .run();

    expect(result).toEqual({
      final: 142,
    });
  });

  it("maintains correct context boundaries with named dependencies", () => {
    const result = sculpt({ value: 1 })
      .transform("a", (data) => ({
        value: data.value + 1,
      }))
      .transform(
        "b",
        (data) => ({
          value: data.value * 2,
        }),
        {
          after: ["a"],
        },
      )
      .derive((data) => ({
        value: data.value + 10,
      }))
      .transform(
        "c",
        (data) => ({
          value: data.value * 3,
        }),
        {
          after: ["d"],
        },
      )
      .transform("d", (data) => ({
        value: data.value + 100,
      }))
      .derive((data) => ({
        final: data.value,
      }))
      .run();

    expect(result).toEqual({
      final: 342,
    });
  });

  it("does not allow dependencies to leak across derive boundaries", () => {
    expect(() =>
      sculpt({ value: 1 })
        .transform("first", (data) => ({
          value: data.value + 1,
        }))
        .derive((data) => ({
          value: data.value * 2,
        }))
        .transform(
          "second",
          (data) => ({
            value: data.value + 1,
          }),
          {
            after: ["first"],
          },
        )
        .run(),
    ).toThrow();
  });

  it("supports multiple independent branches from one base", () => {
    const base = sculpt({
      value: 10,
    });

    const doubled = base
      .transform((data) => ({
        value: data.value * 2,
      }))
      .run();

    const incremented = base
      .transform((data) => ({
        value: data.value + 5,
      }))
      .run();

    const unchanged = base.run();

    expect(doubled).toEqual({ value: 20 });
    expect(incremented).toEqual({ value: 15 });
    expect(unchanged).toEqual({ value: 10 });
  });

  it("supports independent derived branches", () => {
    const base = sculpt({
      firstName: "Test",
      lastName: "Name",
    });

    const profile = base
      .derive((data) => ({
        fullName: `${data.firstName} ${data.lastName}`,
      }))
      .run();

    const initials = base
      .derive((data) => ({
        initials: `${data.firstName[0]}${data.lastName[0]}`,
      }))
      .run();

    expect(profile).toEqual({
      fullName: "Test Name",
    });

    expect(initials).toEqual({
      initials: "TN",
    });

    expect(base.run()).toEqual({
      firstName: "Test",
      lastName: "Name",
    });
  });

  it("supports branching after transformations", () => {
    const base = sculpt({
      values: [1, 2, 3],
    }).transform((data) => ({
      values: data.values.map((value) => value * 2),
    }));

    const sum = base
      .derive((data) => ({
        sum: data.values.reduce((total, value) => total + value, 0),
      }))
      .run();

    const maximum = base
      .derive((data) => ({
        max: Math.max(...data.values),
      }))
      .run();

    expect(sum).toEqual({ sum: 12 });
    expect(maximum).toEqual({ max: 6 });
  });

  it("does not mutate the original input", () => {
    const input = {
      value: 10,
      nested: {
        count: 5,
      },
    };

    const result = sculpt(input)
      .transform((data) => ({
        ...data,
        value: 20,
        nested: {
          count: 10,
        },
      }))
      .derive((data) => ({
        result: data.value + data.nested.count,
      }))
      .run();

    expect(input).toEqual({
      value: 10,
      nested: {
        count: 5,
      },
    });

    expect(result).toEqual({
      result: 30,
    });
  });

  it("is lazy", () => {
    let transformCalls = 0;
    let deriveCalls = 0;

    const pipeline = sculpt({ value: 10 })
      .transform((data) => {
        transformCalls++;

        return {
          value: data.value * 2,
        };
      })
      .derive((data) => {
        deriveCalls++;

        return {
          result: data.value + 5,
        };
      });

    expect(transformCalls).toBe(0);
    expect(deriveCalls).toBe(0);

    pipeline.run();

    expect(transformCalls).toBe(1);
    expect(deriveCalls).toBe(1);
  });

  it("runs each snapshot independently", () => {
    let firstCalls = 0;
    let secondCalls = 0;

    const base = sculpt({ value: 1 });

    const first = base.transform((data) => {
      firstCalls++;

      return {
        value: data.value + 1,
      };
    });

    const second = base.transform((data) => {
      secondCalls++;

      return {
        value: data.value + 10,
      };
    });

    expect(firstCalls).toBe(0);
    expect(secondCalls).toBe(0);

    expect(first.run()).toEqual({ value: 2 });

    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(0);

    expect(second.run()).toEqual({ value: 11 });

    expect(firstCalls).toBe(1);
    expect(secondCalls).toBe(1);

    expect(base.run()).toEqual({ value: 1 });
  });

  it("supports repeated runs", () => {
    let calls = 0;

    const pipeline = sculpt({ value: 10 }).transform((data) => {
      calls++;

      return {
        value: data.value * 2,
      };
    });

    expect(pipeline.run()).toEqual({ value: 20 });
    expect(pipeline.run()).toEqual({ value: 20 });
    expect(pipeline.run()).toEqual({ value: 20 });

    expect(calls).toBe(3);
  });

  it("does not share transform registration between snapshots", () => {
    const base = sculpt({ value: 1 });

    const first = base.transform("first", (data) => ({
      value: data.value + 1,
    }));

    const second = base.transform("second", (data) => ({
      value: data.value + 10,
    }));

    const firstAgain = first.transform("firstAgain", (data) => ({
      value: data.value * 10,
    }));

    expect(base.run()).toEqual({ value: 1 });
    expect(first.run()).toEqual({ value: 2 });
    expect(second.run()).toEqual({ value: 11 });
    expect(firstAgain.run()).toEqual({ value: 20 });
  });

  it("handles a large collection", () => {
    const users = Array.from({ length: 10_000 }, (_, index) => ({
      id: index,
      name: `user-${index}`,
      score: index % 100,
      active: index % 2 === 0,
    }));

    const result = sculpt({ users })
      .transform("active", (data) => ({
        users: data.users.filter((user) => user.active),
      }))
      .derive((data) => ({
        users: data.users,
        totalScore: data.users.reduce((total, user) => total + user.score, 0),
      }))
      .transform("sort", (data) => ({
        ...data,
        users: [...data.users].sort((a, b) => b.score - a.score),
      }))
      .derive((data) => ({
        count: data.users.length,
        totalScore: data.totalScore,
        topScore: data.users[0]?.score ?? 0,
      }))
      .run();

    expect(result.count).toBe(5_000);
    expect(result.totalScore).toBe(245_000);
    expect(result.topScore).toBe(98);
  });

  it("handles a deeply nested data structure", () => {
    const input = {
      company: {
        departments: [
          {
            name: "engineering",
            teams: [
              {
                name: "platform",
                members: [
                  { name: "Test", skills: ["typescript", "aws"] },
                  { name: "Luke", skills: ["react", "typescript"] },
                ],
              },
              {
                name: "frontend",
                members: [{ name: "Peter", skills: ["react", "css"] }],
              },
            ],
          },
        ],
      },
    };

    const result = sculpt(input)
      .derive((data) => ({
        departments: data.company.departments,
      }))
      .transform((data) => ({
        ...data,
        departments: data.departments.map((department) => ({
          ...department,
          teams: department.teams.map((team) => ({
            ...team,
            memberCount: team.members.length,
          })),
        })),
      }))
      .derive((data) => ({
        departmentCount: data.departments.length,
        totalTeams: data.departments.reduce(
          (total, department) => total + department.teams.length,
          0,
        ),
        totalMembers: data.departments.reduce(
          (total, department) =>
            total +
            department.teams.reduce(
              (teamTotal, team) => teamTotal + team.members.length,
              0,
            ),
          0,
        ),
      }))
      .run();

    expect(result).toEqual({
      departmentCount: 1,
      totalTeams: 2,
      totalMembers: 3,
    });
  });

  it("executes side effects only when run is called", () => {
    const events: string[] = [];

    const pipeline = sculpt({ value: 1 })
      .transform("first", (data) => {
        events.push("first");

        return {
          value: data.value + 1,
        };
      })
      .derive((data) => {
        events.push("derive");

        return {
          value: data.value * 2,
        };
      })
      .transform("second", (data) => {
        events.push("second");

        return {
          value: data.value + 1,
        };
      });

    expect(events).toEqual([]);

    const result = pipeline.run();

    expect(events).toEqual(["first", "derive", "second"]);
    expect(result).toEqual({ value: 5 });
  });

  it("maintains execution order across contexts", () => {
    const execution: string[] = [];

    const result = sculpt({ value: 1 })
      .transform("a", (data) => {
        execution.push("a");

        return {
          value: data.value + 1,
        };
      })
      .transform("b", (data) => {
        execution.push("b");

        return {
          value: data.value + 1,
        };
      })
      .derive((data) => {
        execution.push("derive-1");

        return {
          value: data.value * 2,
        };
      })
      .transform("c", (data) => {
        execution.push("c");

        return {
          value: data.value + 1,
        };
      })
      .derive((data) => {
        execution.push("derive-2");

        return {
          result: data.value,
        };
      })
      .transform("d", (data) => {
        execution.push("d");

        return {
          result: data.result + 1,
        };
      })
      .run();

    expect(execution).toEqual(["a", "b", "derive-1", "c", "derive-2", "d"]);

    expect(result).toEqual({
      result: 8,
    });
  });

  it("handles an empty pipeline", () => {
    const input = {
      value: 10,
    };

    const result = sculpt(input).run();

    expect(result).toEqual(input);
  });

  it("handles an empty context after derive", () => {
    const result = sculpt({ value: 10 })
      .derive((data) => ({
        doubled: data.value * 2,
      }))
      .run();

    expect(result).toEqual({
      doubled: 20,
    });
  });

  it("handles many branches from one snapshot", () => {
    const base = sculpt({
      value: 100,
    });

    const results = Array.from({ length: 100 }, (_, index) =>
      base
        .transform((data) => ({
          value: data.value + index,
        }))
        .run(),
    );

    expect(results).toHaveLength(100);
    expect(results[0]).toEqual({ value: 100 });
    expect(results[50]).toEqual({ value: 150 });
    expect(results[99]).toEqual({ value: 199 });
  });

  it("handles branching after a derive", () => {
    const base = sculpt({
      firstName: "Test",
      lastName: "Name",
    }).derive((data) => ({
      fullName: `${data.firstName} ${data.lastName}`,
    }));

    const upper = base
      .transform((data) => ({
        fullName: data.fullName.toUpperCase(),
      }))
      .run();

    const lower = base
      .transform((data) => ({
        fullName: data.fullName.toLowerCase(),
      }))
      .run();

    expect(upper).toEqual({
      fullName: "TEST NAME",
    });

    expect(lower).toEqual({
      fullName: "test name",
    });

    expect(base.run()).toEqual({
      fullName: "Test Name",
    });
  });

  it("handles a complex dependency graph in multiple contexts", () => {
    const execution: string[] = [];

    const result = sculpt({ value: 1 })
      .transform(
        "c",
        (data) => {
          execution.push("c");

          return { value: data.value + 10 };
        },
        { after: ["a", "b"] },
      )
      .transform("a", (data) => {
        execution.push("a");

        return { value: data.value + 1 };
      })
      .transform(
        "b",
        (data) => {
          execution.push("b");

          return { value: data.value * 2 };
        },
        { after: ["a"] },
      )
      .transform(
        "d",
        (data) => {
          execution.push("d");

          return { value: data.value * 3 };
        },
        { after: ["b", "c"] },
      )
      .derive((data) => ({
        value: data.value,
        label: `value:${data.value}`,
      }))
      .transform("e", (data) => {
        execution.push("e");

        return {
          ...data,
          label: `${data.label}:e`,
        };
      })
      .transform(
        "f",
        (data) => {
          execution.push("f");

          return {
            ...data,
            label: `${data.label}:f`,
          };
        },
        { after: ["e"] },
      )
      .run();

    expect(execution).toEqual(["a", "b", "c", "d", "e", "f"]);

    expect(result).toEqual({
      value: 42,
      label: "value:42:e:f",
    });
  });
});
