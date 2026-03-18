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

    expect(order).toEqual([1, 2, 3]);
  });

  it("should allow parallel execution with capacity > 1", async () => {
    const order: string[] = [];
    const queue = new Queue(2);

    await new Promise<void>((resolve) => {
      let completed = 0;
      const checkDone = (): void => {
        completed += 1;
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

    queue.funcQueue.push({
      func: (next) => {
        executed.push(1);
        next();
      },
      ctx: undefined,
      args: [],
    });
    queue.funcQueue.push({
      func: (next) => {
        executed.push(2);
        next();
      },
      ctx: undefined,
      args: [],
    });

    queue.clear();
    expect(queue.funcQueue).toEqual([]);
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

    expect(results).toEqual(["hello"]);
  });
});

describe(createPromiseQueue, () => {
  it("should execute all promises and return results", async () => {
    const results = await createPromiseQueue<number>([
      (): Promise<number> => Promise.resolve(1),
      (): Promise<number> => Promise.resolve(2),
      (): Promise<number> => Promise.resolve(3),
    ]);

    expect(results).toEqual([1, 2, 3]);
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

    expect(order).toEqual(["start-1", "end-1", "start-2", "end-2"]);
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

    await expect(result).resolves.toEqual([]);
  });

  it("should handle single task", async () => {
    const result = await createPromiseQueue<boolean>([
      (): Promise<boolean> => Promise.resolve(true),
    ]);

    expect(result).toEqual([true]);
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
    expect(results).toEqual([1, 2, 3]);
  });
});
