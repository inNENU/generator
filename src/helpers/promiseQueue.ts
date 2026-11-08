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

/**
 * 校验并发数
 *
 * @param capacity 并发数
 */
const assertCapacity = (capacity: number): void => {
  if (!Number.isInteger(capacity) || capacity <= 0)
    throw new RangeError(`并发数必须为正整数，当前值为 ${String(capacity)}`);
};

/** 一个队列，在上一个函数执行完毕后执行 `next()` 才会开始执行下一个函数。 */
export class Queue {
  constructor(
    /** 允许同时并行的任务数 */
    public capacity = 1,
  ) {
    assertCapacity(capacity);
  }

  /** 回调队列 */
  funcQueue: Task[] = [];

  /** 正在运行的数量 */
  running = 0;

  /** 执行下一个函数 */
  next(): void {
    /** 即将执行的任务 */
    const task = this.funcQueue.shift();

    if (task) {
      // oxlint-disable-next-line typescript/no-unsafe-assignment
      const { func, ctx, args } = task;

      /** 当前任务是否已经结算，保证 `next` 幂等，避免 running 被重复递减 */
      let settled = false;

      /** 归还当前任务占用的并发额度 */
      const settle = (): void => {
        if (settled) return;

        settled = true;
        this.running -= 1;
      };

      /** 任务完成回调，重复调用只会生效一次 */
      const handleNext = (): void => {
        settle();
        this.next();
      };

      this.running += 1;

      try {
        func.apply(ctx, [
          handleNext,
          // oxlint-disable-next-line typescript/no-unsafe-assignment
          ...Array.prototype.slice.call(args, 0),
        ]);
      } catch (err) {
        // 任务同步抛错时也必须归还并发额度并继续调度，否则队列会永久卡死
        settle();
        this.next();
        // 继续调度后再把错误交给调用方
        throw err;
      }
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
  add<T, Arguments extends any[]>(
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
  clear(): void {
    this.funcQueue = [];
  }
}

/**
 * 一个队列，在上一个函数执行完毕后执行 `next()` 才会开始执行下一个函数。
 *
 * 单个任务失败不会中断队列，所有任务执行结束后若存在失败会抛出 `AggregateError`。
 *
 * @param promiseList 需要执行的函数列表，每个函数都必须返回一个 Promise
 * @param capacity 允许同时并行的任务数，必须为正整数
 * @returns 当所有函数执行完毕时返回的 Promise，包含所有函数的结果
 */
export const createPromiseQueue = async <T>(
  promiseList: (() => Promise<T>)[],
  capacity = 1,
): Promise<T[]> => {
  assertCapacity(capacity);

  /** 预分配结果数组 */
  const results: T[] = Array.from({ length: promiseList.length });

  /** 带索引的任务队列 */
  const queue: { index: number; task: () => Promise<T> }[] = promiseList.map((task, index) => ({
    index,
    task,
  }));

  /** 执行失败的任务 */
  const failures: { index: number; error: unknown }[] = [];

  const runWorker = async (): Promise<void> => {
    while (queue.length > 0) {
      const item = queue.shift();

      if (item) {
        try {
          // oxlint-disable-next-line no-await-in-loop -- intentionally sequential execution
          results[item.index] = await item.task();
        } catch (err) {
          // 单个任务失败只记录错误，继续处理队列中剩余的任务
          failures.push({ index: item.index, error: err });
        }
      }
    }
  };

  const workers: Promise<void>[] = [];

  for (let i = 0; i < capacity; i += 1) workers.push(runWorker());

  await Promise.all(workers);

  if (failures.length > 0) {
    // 按任务原始顺序保留错误，保证结果可复现
    failures.sort((a, b) => a.index - b.index);

    throw new AggregateError(
      failures.map(({ error }) => error),
      `有 ${failures.length} 个任务执行失败`,
    );
  }

  return results;
};
