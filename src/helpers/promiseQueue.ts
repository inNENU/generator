/** @internal */
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

/** 数组压缩阈值：已消费任务数达到该值后才考虑压缩，避免小队列频繁搬移 */
const COMPACT_THRESHOLD = 1024;

/** 错误摘要的最大长度，避免嵌套的 AggregateError 生成过长的 message */
const MAX_ERROR_SUMMARY_LENGTH = 200;

/**
 * 获取错误的首行摘要
 *
 * @param error 错误原因
 * @returns 用于 message 的简短摘要
 */
const getErrorSummary = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  const summary = message.replaceAll(/\s+/gu, " ").trim();

  if (!summary) return "未知错误";

  return summary.length > MAX_ERROR_SUMMARY_LENGTH
    ? `${summary.slice(0, MAX_ERROR_SUMMARY_LENGTH)}…`
    : summary;
};

/**
 * 一个队列，在上一个函数执行完毕后执行 `next()` 才会开始执行下一个函数。
 *
 * @internal
 */
export class Queue {
  constructor(
    /** 允许同时并行的任务数 */
    public capacity = 1,
  ) {
    assertCapacity(capacity);
  }

  /**
   * 回调队列
   *
   * 已执行的任务不会立即从数组中删除，而是通过 `head` 游标跳过，避免 `shift()` 的 O(n) 搬移； 已消费的任务积累到一定比例后再压缩数组。
   */
  funcQueue: Task[] = [];

  /** 下一个待执行任务在 `funcQueue` 中的下标 */
  head = 0;

  /** 正在运行的数量 */
  running = 0;

  /** 执行下一个函数 */
  next(): void {
    // 防御其它路径（如任务重复调用回调）在额度已满时继续调度，保证 running 不超过 capacity
    if (this.running >= this.capacity) return;

    if (this.head >= this.funcQueue.length) {
      // 队列已空：释放对已执行任务的引用
      this.funcQueue = [];
      this.head = 0;
      return;
    }

    /** 即将执行的任务 */
    const task = this.funcQueue[this.head];

    this.head += 1;

    if (this.head >= this.funcQueue.length) {
      // 队列刚好被取空，直接释放整个数组
      this.funcQueue = [];
      this.head = 0;
    } else if (this.head >= COMPACT_THRESHOLD && this.head * 2 >= this.funcQueue.length) {
      // 已消费一半以上：压缩数组，均摊 O(1)，避免数组无限增长
      this.funcQueue = this.funcQueue.slice(this.head);
      this.head = 0;
    }

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
      // settle 已是幂等的，这里提前返回是为了避免重复调度下一个任务而突破并发上限
      if (settled) return;

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
    this.head = 0;
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
 * @internal
 */
export const createPromiseQueue = async <T>(
  promiseList: (() => Promise<T>)[],
  capacity = 1,
): Promise<T[]> => {
  assertCapacity(capacity);

  /** 预分配结果数组 */
  const results: T[] = Array.from({ length: promiseList.length });

  /** 下一个待执行任务的下标，多个 worker 共享；自增是同步的，不会重复领取任务 */
  let nextIndex = 0;

  /** 执行失败的任务 */
  const failures: { index: number; error: unknown }[] = [];

  const runWorker = async (): Promise<void> => {
    while (nextIndex < promiseList.length) {
      const index = nextIndex;

      nextIndex += 1;

      try {
        // oxlint-disable-next-line no-await-in-loop -- intentionally sequential execution
        results[index] = await promiseList[index]();
      } catch (err) {
        // 单个任务失败只记录错误，继续处理队列中剩余的任务
        failures.push({ index, error: err });
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
      `有 ${failures.length} 个任务执行失败（首个错误: ${getErrorSummary(failures[0].error)}）`,
    );
  }

  return results;
};
