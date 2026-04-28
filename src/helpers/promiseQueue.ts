export interface Task {
  /** 函数本身 */
  // oxlint-disable-next-line typescript/no-explicit-any
  func: (next: () => void, ...args: any[]) => void;
  /** 函数的运行上下文 */
  // oxlint-disable-next-line typescript/no-explicit-any
  ctx: any;
  /** 函数的参数 */
  // oxlint-disable-next-line typescript/no-explicit-any
  args: any[];
}

/** 一个队列，在上一个函数执行完毕后执行 `next()` 才会开始执行下一个函数。 */
export class Queue {
  public constructor(
    /** 允许同时并行的任务数 */
    public capacity = 1,
  ) {}

  /** 回调队列 */
  public funcQueue: Task[] = [];

  /** 正在运行的数量 */
  public running = 0;

  /** 执行下一个函数 */
  public next(): void {
    /** 即将执行的任务 */
    const task = this.funcQueue.shift();

    if (task) {
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      const { func, ctx, args } = task;
      const taskFunc = (): void => {
        func.apply(ctx, [
          (): void => {
            this.running -= 1;
            this.next();
          },
          // oxlint-disable-next-line typescript/no-unsafe-assignment
          ...Array.prototype.slice.call(args, 0),
        ]);
      };

      this.running += 1;
      taskFunc();
    }
  }

  /**
   * 添加函数
   *
   * @param func 函数
   * @param ctx 函数运行上下文
   * @param args 函数参数
   */
  // oxlint-disable-next-line typescript/no-explicit-any, typescript/no-unnecessary-type-parameters
  public add<T, Arguments extends any[]>(
    func: (next: () => void, ...args: Arguments) => void,
    ctx?: T,
    ...args: Arguments
  ): void {
    this.funcQueue.push({
      func,
      ctx,
      args: Array.prototype.slice.call(args, 0),
    });

    // 开始第一个队列
    if (this.running < this.capacity) this.next();
  }

  /** 清除队列，不再执行尚未执行的函数 */
  public clear(): void {
    this.funcQueue = [];
  }
}

/**
 * 一个队列，在上一个函数执行完毕后执行 `next()` 才会开始执行下一个函数。
 *
 * @param promiseList 需要执行的函数列表，每个函数都必须返回一个 Promise
 * @param capacity 允许同时并行的任务数
 * @returns 当所有函数执行完毕时返回的 Promise，包含所有函数的结果
 */
export const createPromiseQueue = async <T>(
  promiseList: (() => Promise<T>)[],
  capacity = 1,
): Promise<T[]> => {
  /** 预分配结果数组 */
  const results: T[] = Array.from({ length: promiseList.length });

  /** 带索引的任务队列 */
  const queue: { index: number; task: () => Promise<T> }[] = promiseList.map((task, index) => ({
    index,
    task,
  }));

  const runWorker = async (): Promise<void> => {
    while (queue.length > 0) {
      const item = queue.shift();

      if (item) {
        // oxlint-disable-next-line no-await-in-loop -- intentionally sequential execution
        results[item.index] = await item.task();
      }
    }
  };

  const workers: Promise<void>[] = [];

  for (let i = 0; i < capacity; i += 1) workers.push(runWorker());

  await Promise.all(workers);

  return results;
};
