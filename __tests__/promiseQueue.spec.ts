// oxlint-disable node/callback-return
import { describe, expect, it } from "vitest";

import { Queue, createPromiseQueue } from "../src/helpers/promiseQueue.js";

describe(Queue, () => {
  it("should execute tasks sequentially with capacity 1", async () => {
    const order: number[] = [];
    const queue = new Queue(1);

    await new Promise<void>((resolve) => {
      queue.add((next) => {
        order.push(1);
        next();
      });
      queue.add((next) => {
        order.push(2);
        next();
      });
      queue.add((next) => {
        order.push(3);
        next();
        resolve();
      });
    });

    expect(order).toStrictEqual([1, 2, 3]);
  });

  it("should allow parallel execution with capacity > 1", async () => {
    const order: string[] = [];
    const queue = new Queue(2);

    await new Promise<void>((resolve) => {
      let completed = 0;
      const checkDone = (): void => {
        completed += 1;
        // oxlint-disable-next-line vitest/no-conditional-in-test
        if (completed === 3) resolve();
      };

      queue.add((next) => {
        order.push("start-1");
        setTimeout(() => {
          order.push("end-1");
          next();
          checkDone();
        }, 30);
      });
      queue.add((next) => {
        order.push("start-2");
        setTimeout(() => {
          order.push("end-2");
          next();
          checkDone();
        }, 10);
      });
      queue.add((next) => {
        order.push("start-3");
        setTimeout(() => {
          order.push("end-3");
          next();
          checkDone();
        }, 10);
      });
    });

    // Tasks 1 and 2 should start simultaneously
    expect(order[0]).toBe("start-1");
    expect(order[1]).toBe("start-2");
    // Task 3 should not start until one finishes
    expect(order.indexOf("start-3")).toBeGreaterThan(order.indexOf("end-2"));
  });

  it("should clear the queue", () => {
    const queue = new Queue(1);
    const executed: number[] = [];

    queue.funcQueue.push(
      {
        func: (next) => {
          executed.push(1);
          next();
        },
        ctx: undefined,
        args: [],
      },
      {
        func: (next) => {
          executed.push(2);
          next();
        },
        ctx: undefined,
        args: [],
      },
    );

    queue.clear();
    expect(queue.funcQueue).toStrictEqual([]);
  });

  it("should pass arguments to tasks", async () => {
    const queue = new Queue(1);
    const results: string[] = [];

    await new Promise<void>((resolve) => {
      queue.add(
        (next: () => void, msg: string) => {
          results.push(msg);
          next();
          resolve();
        },
        undefined,
        "hello",
      );
    });

    expect(results).toStrictEqual(["hello"]);
  });
});

describe(createPromiseQueue, () => {
  it("should execute all promises and return results", async () => {
    const results = await createPromiseQueue<number>([
      (): Promise<number> => Promise.resolve(1),
      (): Promise<number> => Promise.resolve(2),
      (): Promise<number> => Promise.resolve(3),
    ]);

    expect(results).toStrictEqual([1, 2, 3]);
  });

  it("should execute promises sequentially with capacity 1", async () => {
    const order: string[] = [];

    await createPromiseQueue(
      [
        (): Promise<void> =>
          new Promise<void>((resolve) => {
            order.push("start-1");
            setTimeout(() => {
              order.push("end-1");
              resolve();
            }, 30);
          }),
        (): Promise<void> =>
          new Promise<void>((resolve) => {
            order.push("start-2");
            setTimeout(() => {
              order.push("end-2");
              resolve();
            }, 10);
          }),
      ],
      1,
    );

    expect(order).toStrictEqual(["start-1", "end-1", "start-2", "end-2"]);
  });

  it("should execute promises in parallel with capacity > 1", async () => {
    const order: string[] = [];

    await createPromiseQueue(
      [
        (): Promise<void> =>
          new Promise<void>((resolve) => {
            order.push("start-1");
            setTimeout(() => {
              order.push("end-1");
              resolve();
            }, 30);
          }),
        (): Promise<void> =>
          new Promise<void>((resolve) => {
            order.push("start-2");
            setTimeout(() => {
              order.push("end-2");
              resolve();
            }, 10);
          }),
        (): Promise<void> =>
          new Promise<void>((resolve) => {
            order.push("start-3");
            setTimeout(() => {
              order.push("end-3");
              resolve();
            }, 10);
          }),
      ],
      2,
    );

    // Tasks 1 and 2 should start before either finishes
    expect(order[0]).toBe("start-1");
    expect(order[1]).toBe("start-2");
    // Task 3 should start after task 2 finishes (since capacity is 2)
    expect(order.indexOf("start-3")).toBeGreaterThan(order.indexOf("end-2"));
  });

  it("should resolve immediately for empty list", async () => {
    const result = createPromiseQueue<never>([]);

    await expect(result).resolves.toStrictEqual([]);
  });

  it("should handle single task", async () => {
    const result = await createPromiseQueue<boolean>([
      (): Promise<boolean> => Promise.resolve(true),
    ]);

    expect(result).toStrictEqual([true]);
  });

  it("should return results in order regardless of completion order", async () => {
    const results = await createPromiseQueue(
      [
        (): Promise<number> =>
          new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(1);
            }, 30);
          }),
        (): Promise<number> =>
          new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(2);
            }, 10);
          }),
        (): Promise<number> =>
          new Promise<number>((resolve) => {
            setTimeout(() => {
              resolve(3);
            }, 20);
          }),
      ],
      3,
    );

    // Results should be in original order, not completion order
    expect(results).toStrictEqual([1, 2, 3]);
  });
});

describe("capacity validation", () => {
  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "should throw RangeError when Queue capacity is %s",
    (capacity) => {
      expect(() => new Queue(capacity)).toThrow(RangeError);
      expect(() => new Queue(capacity)).toThrow(/正整数/u);
    },
  );

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "should reject with RangeError when createPromiseQueue capacity is %s",
    async (capacity) => {
      await expect(createPromiseQueue([], capacity)).rejects.toThrow(RangeError);
      await expect(createPromiseQueue([], capacity)).rejects.toThrow(/正整数/u);
    },
  );
});

describe("queue recovery", () => {
  it("should keep running after a task throws synchronously", async () => {
    const queue = new Queue(1);
    const executed: string[] = [];

    expect(() =>
      queue.add(() => {
        executed.push("throwing");
        throw new Error("boom");
      }),
    ).toThrow("boom");

    // 同步抛错的任务也必须归还并发额度
    expect(queue.running).toBe(0);

    await new Promise<void>((resolve) => {
      queue.add((next) => {
        executed.push("after");
        next();
        resolve();
      });
    });

    expect(executed).toStrictEqual(["throwing", "after"]);
    expect(queue.running).toBe(0);
  });

  it("should settle a task only once when next is called repeatedly", async () => {
    const queue = new Queue(1);
    const executed: number[] = [];

    await new Promise<void>((resolve) => {
      queue.add((next) => {
        executed.push(1);
        next();
        next();
        next();
      });
      queue.add((next) => {
        executed.push(2);
        next();
        resolve();
      });
    });

    expect(executed).toStrictEqual([1, 2]);
    expect(queue.running).toBe(0);
  });

  it("should not start more tasks than capacity", () => {
    const queue = new Queue(2);
    const started: number[] = [];
    const releases: (() => void)[] = [];

    queue.add((next) => {
      started.push(1);
      releases.push(next);
    });
    queue.add((next) => {
      started.push(2);
      releases.push(next);
    });
    queue.add((next) => {
      started.push(3);
      next();
    });

    expect(started).toStrictEqual([1, 2]);
    expect(queue.running).toBe(2);

    releases.forEach((release) => release());

    expect(started).toStrictEqual([1, 2, 3]);
    expect(queue.running).toBe(0);
  });
});

describe("createPromiseQueue resilience", () => {
  it("should execute all remaining tasks after a task rejects", async () => {
    const started: number[] = [];
    const finished: number[] = [];

    const run = (index: number, shouldFail: boolean) => async (): Promise<number> => {
      started.push(index);
      await Promise.resolve();
      finished.push(index);

      // oxlint-disable-next-line vitest/no-conditional-in-test
      if (shouldFail) throw new Error(`task-${index} failed`);

      return index;
    };

    const error = await createPromiseQueue(
      [run(0, false), run(1, true), run(2, false), run(3, true), run(4, false)],
      2,
    ).then(
      () => undefined,
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(AggregateError);
    expect(started.sort((a, b) => a - b)).toStrictEqual([0, 1, 2, 3, 4]);
    expect(finished.sort((a, b) => a - b)).toStrictEqual([0, 1, 2, 3, 4]);

    const aggregate = error as AggregateError;

    expect(aggregate.errors).toHaveLength(2);
    expect(aggregate.errors.map((item: unknown) => (item as Error).message)).toStrictEqual([
      "task-1 failed",
      "task-3 failed",
    ]);
  });

  it("should keep processing tasks when a task throws synchronously", async () => {
    const executed: string[] = [];

    const error = await createPromiseQueue<string>(
      [
        (): Promise<string> => {
          executed.push("first");
          return Promise.resolve("first");
        },
        (): Promise<string> => {
          executed.push("second");
          throw new Error("sync failure");
        },
        (): Promise<string> => {
          executed.push("third");
          return Promise.resolve("third");
        },
      ],
      1,
    ).then(
      () => undefined,
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(AggregateError);
    expect(executed).toStrictEqual(["first", "second", "third"]);
  });

  it("should resolve with all results when tasks succeed", async () => {
    const results = await createPromiseQueue(
      [
        (): Promise<number> => Promise.resolve(1),
        (): Promise<number> => Promise.resolve(2),
        (): Promise<number> => Promise.resolve(3),
      ],
      2,
    );

    expect(results).toStrictEqual([1, 2, 3]);
  });
});
